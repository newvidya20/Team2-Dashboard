import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface CertificateRecord {
  id: string;
  userId: string;
  name: string;
  organization: string;
  issueDate: string;
  expiryDate: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateInput {
  name: string;
  organization: string;
  issueDate: string;
  expiryDate: string;
}

export interface CertificateFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  extension: string;
}

const certificateDirectory = path.resolve(process.cwd(), 'data', 'certificate-files');
const metadataPath = path.resolve(process.cwd(), 'data', 'certificates.json');
let writeQueue: Promise<void> = Promise.resolve();
let storageInitialization: Promise<void> | null = null;

async function ensureStorage(): Promise<void> {
  if (!storageInitialization) {
    storageInitialization = (async () => {
      await mkdir(certificateDirectory, { recursive: true });
      try {
        await writeFile(metadataPath, '[]', { encoding: 'utf8', flag: 'wx' });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
    })().catch((error) => {
      storageInitialization = null;
      throw error;
    });
  }
  await storageInitialization;
}

function serializeWrites<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function saveRecords(records: CertificateRecord[]): Promise<void> {
  const temporaryPath = `${metadataPath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(records, null, 2), { encoding: 'utf8', flag: 'wx' });
  try {
    await rename(temporaryPath, metadataPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function readRecords(): Promise<CertificateRecord[]> {
  await ensureStorage();
  const contents = await readFile(metadataPath, 'utf8');
  const records: unknown = JSON.parse(contents);
  if (
    !Array.isArray(records) ||
    records.some(
      (record) =>
        !record ||
        typeof record !== 'object' ||
        typeof record.id !== 'string' ||
        typeof record.userId !== 'string' ||
        typeof record.name !== 'string' ||
        typeof record.organization !== 'string' ||
        typeof record.issueDate !== 'string' ||
        typeof record.expiryDate !== 'string' ||
        typeof record.fileName !== 'string' ||
        typeof record.originalFileName !== 'string' ||
        typeof record.mimeType !== 'string'
    )
  ) {
    throw new Error('Certificate metadata file is invalid. Restore data/certificates.json from a valid backup.');
  }
  return records as CertificateRecord[];
}

async function persistFile(file: CertificateFile): Promise<string> {
  await ensureStorage();
  const fileName = `${randomUUID()}${file.extension}`;
  const destination = path.join(certificateDirectory, fileName);
  const temporaryPath = `${destination}.tmp`;
  await writeFile(temporaryPath, file.buffer, { flag: 'wx' });
  try {
    await rename(temporaryPath, destination);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
  return fileName;
}

function toRecord(
  userId: string,
  input: CertificateInput,
  file: CertificateFile,
  fileName: string,
  existing?: CertificateRecord
): CertificateRecord {
  const now = new Date().toISOString();
  return {
    id: existing?.id || randomUUID(),
    userId,
    name: input.name,
    organization: input.organization,
    issueDate: input.issueDate,
    expiryDate: input.expiryDate,
    fileName,
    originalFileName: path.basename(file.originalName).slice(0, 255),
    mimeType: file.mimeType,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

export function listCertificates(userId?: string): Promise<CertificateRecord[]> {
  return readRecords().then((records) =>
    records
      .filter((record) => !userId || record.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  );
}

export async function getCertificate(id: string): Promise<CertificateRecord | undefined> {
  return (await readRecords()).find((record) => record.id === id);
}

export async function getCertificateFile(record: CertificateRecord): Promise<Buffer> {
  const filePath = path.join(certificateDirectory, path.basename(record.fileName));
  return readFile(filePath);
}

export function createCertificate(
  userId: string,
  input: CertificateInput,
  file: CertificateFile
): Promise<CertificateRecord> {
  return serializeWrites(async () => {
    const fileName = await persistFile(file);
    const record = toRecord(userId, input, file, fileName);
    try {
      await saveRecords([...(await readRecords()), record]);
    } catch (error) {
      await unlink(path.join(certificateDirectory, fileName)).catch(() => undefined);
      throw error;
    }
    return record;
  });
}

export function updateCertificate(
  id: string,
  input: CertificateInput,
  file?: CertificateFile
): Promise<CertificateRecord | undefined> {
  return serializeWrites(async () => {
    const records = await readRecords();
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) return undefined;

    const existing = records[index];
    const newFileName = file ? await persistFile(file) : existing.fileName;
    const updated = file
      ? toRecord(existing.userId, input, file, newFileName, existing)
      : { ...existing, ...input, updatedAt: new Date().toISOString() };
    records[index] = updated;
    try {
      await saveRecords(records);
    } catch (error) {
      if (file) await unlink(path.join(certificateDirectory, newFileName)).catch(() => undefined);
      throw error;
    }

    if (file) await unlink(path.join(certificateDirectory, existing.fileName));
    return updated;
  });
}

export function deleteCertificate(id: string): Promise<CertificateRecord | undefined> {
  return serializeWrites(async () => {
    const records = await readRecords();
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) return undefined;
    const [removed] = records.splice(index, 1);
    await saveRecords(records);
    await unlink(path.join(certificateDirectory, removed.fileName));
    return removed;
  });
}
