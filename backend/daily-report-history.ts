import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DailyReport, UserRole } from '../src/types';

export interface DailyReportHistoryEntry {
  id: string;
  userId: string;
  userName: string;
  role: UserRole;
  reportDate: string;
  timestamp: string;
  before: DailyReport | null;
  after: DailyReport;
}

const historyPath = path.resolve(process.cwd(), 'data', 'daily-report-history.json');
const backupPath = `${historyPath}.bak`;
let writeQueue: Promise<void> = Promise.resolve();

function isDailyReport(value: unknown): value is DailyReport {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value && typeof value.id === 'string' &&
      'userId' in value && typeof value.userId === 'string' &&
      'userName' in value && typeof value.userName === 'string' &&
      'userEmail' in value && typeof value.userEmail === 'string' &&
      'date' in value && typeof value.date === 'string' &&
      'whatIDid' in value && typeof value.whatIDid === 'string' &&
      'blockers' in value && typeof value.blockers === 'string' &&
      'planTomorrow' in value && typeof value.planTomorrow === 'string' &&
      'createdAt' in value && typeof value.createdAt === 'string' &&
      'updatedAt' in value && typeof value.updatedAt === 'string'
  );
}

function parseHistory(contents: string): DailyReportHistoryEntry[] {
  const parsed: unknown = JSON.parse(contents.replace(/^\uFEFF/, ''));
  if (
    !Array.isArray(parsed) ||
    parsed.some(
      (entry) =>
        !entry ||
        typeof entry !== 'object' ||
        typeof entry.id !== 'string' ||
        typeof entry.userId !== 'string' ||
        typeof entry.userName !== 'string' ||
        (entry.role !== 'admin' && entry.role !== 'member') ||
        typeof entry.reportDate !== 'string' ||
        typeof entry.timestamp !== 'string' ||
        !(entry.before === null || isDailyReport(entry.before)) ||
        !isDailyReport(entry.after)
    )
  ) {
    throw new Error('Daily report history file contains invalid data.');
  }
  return parsed as DailyReportHistoryEntry[];
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

async function readHistory(): Promise<DailyReportHistoryEntry[]> {
  const contents = await readFileIfPresent(historyPath);
  if (contents !== undefined) return parseHistory(contents);
  const backup = await readFileIfPresent(backupPath);
  if (backup === undefined) return [];
  const entries = parseHistory(backup);
  await writeAtomically(historyPath, backup);
  console.warn('Restored daily report history from its JSON backup.');
  return entries;
}

async function saveHistory(entries: DailyReportHistoryEntry[]): Promise<void> {
  await mkdir(path.dirname(historyPath), { recursive: true });
  const previous = await readFileIfPresent(historyPath);
  if (previous !== undefined) {
    parseHistory(previous);
    await writeAtomically(backupPath, previous);
  }
  await writeAtomically(historyPath, `${JSON.stringify(entries, null, 2)}\n`);
}

export function appendDailyReportHistory(
  entry: Omit<DailyReportHistoryEntry, 'id'> & { id?: string }
): Promise<void> {
  const result = writeQueue.then(async () => {
    const entries = await readHistory();
    if (entry.id && entries.some((existing) => existing.id === entry.id)) return;
    entries.push({ ...entry, id: entry.id || randomUUID() });
    await saveHistory(entries);
  });
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

export function getDailyReportHistory(): Promise<DailyReportHistoryEntry[]> {
  return readHistory();
}
