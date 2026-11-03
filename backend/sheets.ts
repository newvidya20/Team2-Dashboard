import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type SheetRecord = Record<string, string>;

const sheetDefinitions: Record<string, string[]> = {
  approvedUsers: ['email', 'displayName', 'role', 'capabilities', 'active', 'createdAt', 'updatedAt'],
  users: ['uid', 'email', 'displayName', 'role', 'capabilities', 'active', 'photoURL', 'passwordSalt', 'passwordHash', 'createdAt', 'updatedAt', 'linkedInUrl', 'whatsappNumber'],
  tasks: ['id', 'title', 'description', 'assignedTo', 'assignedToName', 'assigneeEmail', 'createdBy', 'createdByName', 'status', 'priority', 'dueDate', 'createdAt', 'updatedAt'],
  dailyReports: ['id', 'userId', 'userName', 'userEmail', 'date', 'whatIDid', 'leadsHandled', 'blockers', 'planTomorrow', 'createdAt', 'updatedAt'],
  weeklyReports: ['weekId', 'summary', 'totalLeads', 'updatedBy', 'updatedAt', 'sentAt'],
  calendarLeaves: ['id', 'userId', 'startDate', 'endDate', 'note', 'createdAt', 'updatedAt'],
  calendarNotes: ['id', 'date', 'userId', 'userName', 'title', 'note', 'createdAt', 'updatedAt'],
  activityLogs: ['id', 'userId', 'userName', 'userEmail', 'action', 'details', 'timestamp'],
  settings: ['key', 'value'],
};

interface BridgeResponse<T> {
  ok: boolean;
  result?: T;
  error?: string;
}

interface LocalStore {
  [sheetName: string]: SheetRecord[];
}

let localQueue: Promise<void> = Promise.resolve();

function isLocalMode(): boolean {
  const mode = (process.env.DATA_STORE || 'local').trim().toLowerCase();
  if (mode !== 'local' && mode !== 'apps-script') {
    throw new Error('DATA_STORE must be either "local" or "apps-script".');
  }
  if (mode === 'local') return true;

  const endpoint = process.env.APPS_SCRIPT_URL?.trim();
  const secret = process.env.SHEETS_API_SECRET?.trim();
  return !endpoint || !secret || Buffer.byteLength(secret) < 32;
}

function isBridgeUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('not authorized') ||
    message.includes('not configured') ||
    message.includes('denied access') ||
    message.includes('bridge request failed')
  );
}

async function withBridgeFallback<T>(operation: () => Promise<T>, fallback: () => Promise<T> | T): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isBridgeUnavailableError(error)) return await fallback();
    throw error;
  }
}

function getLocalStorePath(): string {
  return path.resolve(process.env.LOCAL_DATA_FILE || path.join(process.cwd(), 'data', 'dashboard-data.json'));
}

async function withLocalStore<T>(operation: (store: LocalStore) => T | Promise<T>): Promise<T> {
  const result = localQueue.then(async () => {
    const filePath = getLocalStorePath();
    let store: LocalStore;
    try {
      const content = await readFile(filePath, 'utf8');
      const parsed: unknown = JSON.parse(content);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Local app data file must contain a JSON object.');
      }
      store = parsed as LocalStore;
      for (const [sheetName, rows] of Object.entries(store)) {
        if (!sheetDefinitions[sheetName] || !Array.isArray(rows)) {
          throw new Error(`Local app data file contains invalid data for "${sheetName}".`);
        }
      }
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }
      store = {};
    }

    for (const sheetName of Object.keys(sheetDefinitions)) {
      if (!store[sheetName]) store[sheetName] = [];
    }
    const value = await operation(store);
    const targetPath = getLocalStorePath();
    const tempPath = `${targetPath}.${process.pid}.tmp`;
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    await rename(tempPath, targetPath);
    return value;
  });
  localQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function callBridge<T>(operation: string, payload: Record<string, unknown> = {}): Promise<T> {
  const endpoint = process.env.APPS_SCRIPT_URL;
  const secret = process.env.SHEETS_API_SECRET;
  if (!endpoint || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(endpoint)) {
    throw new Error('Google Sheets bridge is not configured. Set APPS_SCRIPT_URL to the deployed Apps Script web app URL.');
  }
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('Google Sheets bridge is not configured. Set SHEETS_API_SECRET to a random value of at least 32 bytes.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, secret, ...payload }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Google Sheets bridge denied access (HTTP ${response.status}). Check the Apps Script deployment access setting and verify that SHEETS_API_SECRET matches the Apps Script property.`
      );
    }
    throw new Error(`Google Sheets bridge request failed with HTTP ${response.status}.`);
  }

  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || !('ok' in result)) {
    throw new Error('Google Sheets bridge returned an invalid response.');
  }
  const bridgeResponse = result as BridgeResponse<T>;
  if (!bridgeResponse.ok) {
    throw new Error(bridgeResponse.error || 'Google Sheets bridge request failed.');
  }
  return bridgeResponse.result as T;
}

export function initializeSheets(): Promise<void> {
  if (isLocalMode()) return withLocalStore(() => undefined);
  return withBridgeFallback(
    () => callBridge<void>('initialize'),
    () => withLocalStore(() => undefined)
  );
}

export function bootstrapAdmin(approval: SheetRecord, user: SheetRecord): Promise<boolean> {
  if (isLocalMode()) {
    return withLocalStore((store) => {
      if (store.approvedUsers.length || store.users.length) return false;
      store.approvedUsers.push(approval);
      store.users.push(user);
      return true;
    });
  }
  return withBridgeFallback(
    () => callBridge<boolean>('bootstrapAdmin', { approval, user }),
    () => withLocalStore((store) => {
      if (store.approvedUsers.length || store.users.length) return false;
      store.approvedUsers.push(approval);
      store.users.push(user);
      return true;
    })
  );
}

export async function listRows(sheetName: string): Promise<SheetRecord[]> {
  return (await listRowsMany([sheetName]))[sheetName];
}

export async function listRowsMany(sheetNames: string[]): Promise<Record<string, SheetRecord[]>> {
  for (const sheetName of sheetNames) {
    if (!sheetDefinitions[sheetName]) throw new Error(`Unknown spreadsheet tab "${sheetName}".`);
  }
  if (isLocalMode()) {
    return withLocalStore((store) => Object.fromEntries(
      sheetNames.map((sheetName) => [sheetName, store[sheetName].map((record) => ({ ...record }))])
    ));
  }
  return withBridgeFallback(
    () => callBridge<Record<string, SheetRecord[]>>('listRowsMany', { sheetNames }),
    () => withLocalStore((store) => Object.fromEntries(
      sheetNames.map((sheetName) => [sheetName, store[sheetName].map((record) => ({ ...record }))])
    ))
  );
}

export async function appendRows(sheetName: string, records: SheetRecord[]): Promise<void> {
  if (!sheetDefinitions[sheetName]) throw new Error(`Unknown spreadsheet tab "${sheetName}".`);
  if (!records.length) return;
  if (isLocalMode()) {
    await withLocalStore((store) => {
      store[sheetName].push(...records.map((record) => ({ ...record })));
    });
    return;
  }
  await withBridgeFallback(
    () => callBridge<void>('appendRows', { sheetName, records }),
    () => withLocalStore((store) => {
      store[sheetName].push(...records.map((record) => ({ ...record })));
    })
  );
}

export async function upsertRow(
  sheetName: string,
  key: string,
  keyField: string,
  record: SheetRecord
): Promise<void> {
  const headers = sheetDefinitions[sheetName];
  if (!headers || !headers.includes(keyField)) {
    throw new Error(`Invalid key field "${keyField}" for spreadsheet tab "${sheetName}".`);
  }
  if (isLocalMode()) {
    await withLocalStore((store) => {
      const index = store[sheetName].findIndex((row) => row[keyField] === key);
      if (index < 0) store[sheetName].push({ ...record });
      else store[sheetName][index] = { ...record };
    });
    return;
  }
  await withBridgeFallback(
    () => callBridge<void>('upsertRow', { sheetName, key, keyField, record }),
    () => withLocalStore((store) => {
      const index = store[sheetName].findIndex((row) => row[keyField] === key);
      if (index < 0) store[sheetName].push({ ...record });
      else store[sheetName][index] = { ...record };
    })
  );
}

export async function deleteRow(sheetName: string, key: string, keyField: string): Promise<boolean> {
  const headers = sheetDefinitions[sheetName];
  if (!headers || !headers.includes(keyField)) {
    throw new Error(`Invalid key field "${keyField}" for spreadsheet tab "${sheetName}".`);
  }
  if (isLocalMode()) {
    return withLocalStore((store) => {
      const index = store[sheetName].findIndex((row) => row[keyField] === key);
      if (index < 0) return false;
      store[sheetName].splice(index, 1);
      return true;
    });
  }
  return withBridgeFallback(
    () => callBridge<boolean>('deleteRow', { sheetName, key, keyField }),
    () => withLocalStore((store) => {
      const index = store[sheetName].findIndex((row) => row[keyField] === key);
      if (index < 0) return false;
      store[sheetName].splice(index, 1);
      return true;
    })
  );
}

export async function setSettings(settings: Record<string, string>): Promise<void> {
  if (isLocalMode()) {
    await withLocalStore((store) => {
      store.settings = Object.entries(settings).map(([key, value]) => ({ key, value }));
    });
    return;
  }
  await withBridgeFallback(
    () => callBridge<void>('setSettings', { settings }),
    () => withLocalStore((store) => {
      store.settings = Object.entries(settings).map(([key, value]) => ({ key, value }));
    })
  );
}
