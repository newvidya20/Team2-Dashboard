import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface AssistantHistoryEvent {
  id: string;
  userId: string;
  userName: string;
  role?: 'admin' | 'member';
  action: string;
  details: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

const historyPath = path.resolve(process.cwd(), 'data', 'assistant-history.json');
let writeQueue: Promise<void> = Promise.resolve();

async function readEvents(): Promise<AssistantHistoryEvent[]> {
  let contents: string;
  try {
    contents = await readFile(historyPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const parsed: unknown = JSON.parse(contents);
  if (
    !Array.isArray(parsed) ||
    parsed.some(
      (event) =>
        !event ||
        typeof event !== 'object' ||
        typeof event.id !== 'string' ||
        typeof event.userId !== 'string' ||
        typeof event.action !== 'string' ||
        typeof event.details !== 'string' ||
        typeof event.timestamp !== 'string'
    )
  ) {
    throw new Error('Assistant history file is invalid. Restore data/assistant-history.json from a valid backup.');
  }
  return parsed as AssistantHistoryEvent[];
}

async function saveEvents(events: AssistantHistoryEvent[]): Promise<void> {
  await mkdir(path.dirname(historyPath), { recursive: true });
  const temporaryPath = `${historyPath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(events, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  try {
    await rename(temporaryPath, historyPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export function archiveAssistantActivity(
  event: Omit<AssistantHistoryEvent, 'id'> & { id?: string }
): Promise<void> {
  const result = writeQueue.then(async () => {
    const events = await readEvents();
    events.push({ ...event, id: event.id || randomUUID() });
    await saveEvents(events.slice(-20_000));
  });
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

export function getAssistantHistory(): Promise<AssistantHistoryEvent[]> {
  return readEvents();
}
