import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getAssistantHistory } from './assistant-history';
import { listRowsMany } from './sheets';
import type { TaskItem, UserRole } from '../src/types';

export type TaskHistoryAction = 'task_created' | 'task_updated' | 'task_deleted';

export interface TaskHistoryEvent {
  id: string;
  userId: string;
  userName: string;
  role: UserRole;
  taskId: string;
  action: TaskHistoryAction;
  timestamp: string;
  before: TaskItem | null;
  after: TaskItem | null;
}

const historyPath = path.resolve(process.cwd(), 'data', 'task-history.json');
const backupPath = `${historyPath}.bak`;
let writeQueue: Promise<void> = Promise.resolve();

function isTaskItem(value: unknown): value is TaskItem {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      typeof value.id === 'string' &&
      'title' in value &&
      typeof value.title === 'string' &&
      'description' in value &&
      typeof value.description === 'string' &&
      'assignedTo' in value &&
      typeof value.assignedTo === 'string' &&
      'assignedToName' in value &&
      typeof value.assignedToName === 'string' &&
      'createdBy' in value &&
      typeof value.createdBy === 'string' &&
      'createdByName' in value &&
      typeof value.createdByName === 'string' &&
      'status' in value &&
      (value.status === 'todo' || value.status === 'in_progress' || value.status === 'done') &&
      'priority' in value &&
      (value.priority === 'low' || value.priority === 'medium' || value.priority === 'high') &&
      'dueDate' in value &&
      typeof value.dueDate === 'string' &&
      'createdAt' in value &&
      typeof value.createdAt === 'string' &&
      'updatedAt' in value &&
      typeof value.updatedAt === 'string'
  );
}

function parseHistory(contents: string): TaskHistoryEvent[] {
  const parsed: unknown = JSON.parse(contents.replace(/^\uFEFF/, ''));
  if (
    !Array.isArray(parsed) ||
    parsed.some(
      (event) =>
        !event ||
        typeof event !== 'object' ||
        typeof event.id !== 'string' ||
        typeof event.userId !== 'string' ||
        typeof event.userName !== 'string' ||
        (event.role !== 'admin' && event.role !== 'member') ||
        typeof event.taskId !== 'string' ||
        (event.action !== 'task_created' && event.action !== 'task_updated' && event.action !== 'task_deleted') ||
        typeof event.timestamp !== 'string' ||
        !(event.before === null || isTaskItem(event.before)) ||
        !(event.after === null || isTaskItem(event.after))
    )
  ) {
    throw new Error('Task history file contains invalid data.');
  }
  return parsed as TaskHistoryEvent[];
}

async function readFileIfPresent(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function writeAtomically(filePath: string, contents: string): Promise<void> {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, contents, { encoding: 'utf8', flag: 'wx' });
  try {
    await rename(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function readHistory(): Promise<TaskHistoryEvent[]> {
  const primaryContents = await readFileIfPresent(historyPath);
  if (primaryContents === undefined) {
    const backupContents = await readFileIfPresent(backupPath);
    if (backupContents === undefined) return [];
    const restored = parseHistory(backupContents);
    await writeAtomically(historyPath, backupContents);
    console.warn('Restored task history from its JSON backup.');
    return restored;
  }

  try {
    return parseHistory(primaryContents);
  } catch (primaryError) {
    const backupContents = await readFileIfPresent(backupPath);
    if (backupContents === undefined) {
      throw new Error('Task history is invalid and no backup is available at data/task-history.json.bak.', {
        cause: primaryError,
      });
    }
    let backup: TaskHistoryEvent[];
    try {
      backup = parseHistory(backupContents);
    } catch (backupError) {
      throw new Error('Both task history and its backup are invalid. Restore data/task-history.json from a valid backup.', {
        cause: backupError,
      });
    }
    await writeAtomically(historyPath, backupContents);
    console.warn('The invalid task history file was restored from data/task-history.json.bak.');
    return backup;
  }
}

async function saveHistory(events: TaskHistoryEvent[]): Promise<void> {
  await mkdir(path.dirname(historyPath), { recursive: true });
  const previous = await readFileIfPresent(historyPath);
  if (previous !== undefined) {
    parseHistory(previous);
    await writeAtomically(backupPath, previous);
  }
  await writeAtomically(historyPath, `${JSON.stringify(events, null, 2)}\n`);
}

export function appendTaskHistory(event: Omit<TaskHistoryEvent, 'id'> & { id?: string }): Promise<void> {
  const result = writeQueue.then(async () => {
    const events = await readHistory();
    if (event.id && events.some((existing) => existing.id === event.id)) return;
    events.push({ ...event, id: event.id || randomUUID() });
    await saveHistory(events);
  });
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

export function getTaskHistory(): Promise<TaskHistoryEvent[]> {
  return readHistory();
}

export function migrateAssistantTaskHistory(): Promise<void> {
  const result = writeQueue.then(async () => {
    const [assistantEvents, records] = await Promise.all([
      getAssistantHistory(),
      listRowsMany(['users', 'approvedUsers']),
    ]);
    const approvedByEmail = new Map(
      records.approvedUsers.map((approval) => [approval.email.trim().toLowerCase(), approval])
    );
    const rolesByUserId = new Map(
      records.users.flatMap((user) => {
        const approval = approvedByEmail.get(user.email.trim().toLowerCase());
        return approval && (approval.role === 'admin' || approval.role === 'member')
          ? [[user.uid, approval.role] as const]
          : [];
      })
    );
    const existing = await readHistory();
    const knownIds = new Set(existing.map((event) => event.id));
    const imported: TaskHistoryEvent[] = [];
    for (const event of assistantEvents) {
      if (
        knownIds.has(event.id) ||
        (event.action !== 'task_created' && event.action !== 'task_updated' && event.action !== 'task_deleted')
      ) continue;
      const task = getSnapshot(event.context?.task);
      const before = event.action === 'task_updated'
        ? getSnapshot(event.context?.before)
        : event.action === 'task_deleted'
          ? task
          : null;
      const after = event.action === 'task_updated'
        ? getSnapshot(event.context?.after)
        : event.action === 'task_created'
          ? task
          : null;
      const taskId = after?.id || before?.id;
      if (
        !taskId ||
        (event.action === 'task_updated' && (!before || !after)) ||
        (event.action === 'task_created' && !after) ||
        (event.action === 'task_deleted' && !before)
      ) continue;
      imported.push({
        id: event.id,
        userId: event.userId,
        userName: event.userName,
        role: event.role || rolesByUserId.get(event.userId) || 'member',
        taskId,
        action: event.action,
        timestamp: event.timestamp,
        before,
        after,
      });
      knownIds.add(event.id);
    }
    if (imported.length) {
      await saveHistory([...existing, ...imported]);
      console.info(`Imported ${imported.length} existing task activities into the permanent task history.`);
    }
  });
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

function getSnapshot(value: unknown): TaskItem | null {
  return isTaskItem(value) ? value : null;
}
