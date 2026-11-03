import { randomBytes, randomUUID, scryptSync, createHmac, timingSafeEqual } from 'node:crypto';
import type { Express, NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { archiveAssistantActivity, getAssistantHistory } from './assistant-history';
import type { AssistantHistoryEvent } from './assistant-history';
import { appendTaskHistory } from './task-history';
import { appendDailyReportHistory } from './daily-report-history';
import { notifyTaskActivity } from './task-email-notifications';
import {
  createCertificate,
  deleteCertificate,
  getCertificate,
  getCertificateFile,
  listCertificates,
  updateCertificate,
} from './certificates';
import type { CertificateFile, CertificateInput } from './certificates';
import {
  appendRows,
  bootstrapAdmin,
  deleteRow,
  listRows,
  listRowsMany,
  setSettings,
  upsertRow,
} from './sheets';
import type {
  ActionType,
  ActivityLog,
  AppSettings,
  DailyReport,
  CalendarNote,
  CalendarLeave,
  TaskItem,
  TaskPriority,
  TaskStatus,
  UserProfile,
  WeeklySummary,
} from '../src/types';
import type { CertificateRecord } from './certificates';

type UserRecord = SheetRecord & {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'member';
  capabilities: string;
  active: string;
  photoURL: string;
  linkedInUrl: string;
  whatsappNumber: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

type ApprovalRecord = SheetRecord & {
  email: string;
  displayName: string;
  role: 'admin' | 'member';
  capabilities: string;
  active: string;
};

type AuthenticatedRequest = Request & {
  member?: UserRecord;
  approval?: ApprovalRecord;
};

const INVITE_ONLY_MESSAGE = 'This email is not approved. Please contact the admin.';
const TOKEN_TTL_SECONDS = 60 * 60 * 8;
const ACTIVITY_LOG_LIMIT = 1000;
const certificateUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 4 },
});

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('SESSION_SECRET must be set to a random value of at least 32 bytes.');
  }
  return secret;
}

export function validateAuthConfiguration(): void {
  getSessionSecret();
}

function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function getConfiguredAdminEmail(): string | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return email && isValidEmail(email) ? email : null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function toProfile(user: UserRecord, approval: ApprovalRecord): UserProfile {
  return {
    uid: user.uid,
    email: approval.email,
    displayName: approval.displayName,
    role: approval.role,
    capabilities: parseArray(approval.capabilities),
    photoURL: user.photoURL || undefined,
    linkedInUrl: user.linkedInUrl || undefined,
    whatsappNumber: user.whatsappNumber || undefined,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function userProfileRecord(
  profile: Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'> & { uid?: string },
  existing?: UserRecord
): UserRecord {
  const now = new Date().toISOString();
  return {
    uid: profile.uid || randomUUID(),
    email: normalizeEmail(profile.email),
    displayName: profile.displayName.trim(),
    role: profile.role,
    capabilities: JSON.stringify(profile.capabilities || []),
    active: 'true',
    photoURL: profile.photoURL || '',
    linkedInUrl: profile.linkedInUrl?.trim() || '',
    whatsappNumber: profile.whatsappNumber?.trim() || '',
    passwordSalt: existing?.passwordSalt || '',
    passwordHash: existing?.passwordHash || '',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

function createToken(uid: string): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: uid, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS })
  ).toString('base64url');
  const signature = createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readToken(token: string): { uid: string; exp: number } | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', getSessionSecret()).update(payload).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: unknown;
      exp?: unknown;
    };
    if (typeof decoded.sub !== 'string' || typeof decoded.exp !== 'number' || decoded.exp <= Date.now() / 1000) {
      return null;
    }
    return { uid: decoded.sub, exp: decoded.exp };
  } catch {
    return null;
  }
}

export async function ensureCanonicalAdminAssignment(): Promise<void> {
  const configuredAdminEmail = getConfiguredAdminEmail();
  if (!configuredAdminEmail) return;

  const [users, approvals] = await Promise.all([
    listRows('users') as Promise<UserRecord[]>,
    listRows('approvedUsers') as Promise<ApprovalRecord[]>,
  ]);
  const now = new Date().toISOString();

  for (const approval of approvals) {
    const email = normalizeEmail(approval.email);
    const shouldBeAdmin = email === configuredAdminEmail;
    if (approval.role !== (shouldBeAdmin ? 'admin' : 'member') || approval.active !== 'true') {
      const nextApproval: ApprovalRecord = {
        ...approval,
        role: shouldBeAdmin ? 'admin' : 'member',
        active: shouldBeAdmin ? 'true' : approval.active,
        updatedAt: now,
      };
      await upsertRow('approvedUsers', approval.email, 'email', nextApproval);
    }
  }

  for (const user of users) {
    const email = normalizeEmail(user.email);
    const shouldBeAdmin = email === configuredAdminEmail;
    if (user.role !== (shouldBeAdmin ? 'admin' : 'member')) {
      const nextUser: UserRecord = {
        ...user,
        role: shouldBeAdmin ? 'admin' : 'member',
        active: shouldBeAdmin ? 'true' : user.active,
        updatedAt: now,
      };
      await upsertRow('users', user.uid, 'uid', nextUser);
    }
  }
}

async function activeUserForUid(uid: string): Promise<{ user: UserRecord; approval: ApprovalRecord } | null> {
  await ensureCanonicalAdminAssignment();
  const records = await listRowsMany(['users', 'approvedUsers']);
  const users = records.users as UserRecord[];
  const user = users.find((record) => record.uid === uid && record.active === 'true');
  if (!user) return null;
  const approval = (records.approvedUsers as ApprovalRecord[]).find(
    (record) =>
      normalizeEmail(record.email) === normalizeEmail(user.email) &&
      record.active === 'true'
  );
  if (!approval) return null;
  return { user, approval };
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.header('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    const claims = token ? readToken(token) : null;
    const active = claims ? await activeUserForUid(claims.uid) : null;
    if (!active) {
      res.status(401).json({ error: 'Your session is invalid or your access has been deactivated. Please sign in again.' });
      return;
    }
    req.member = active.user;
    req.approval = active.approval;
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.approval?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access is required.' });
    return;
  }
  next();
}

function asyncRoute(
  handler: (req: AuthenticatedRequest, res: Response) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) =>
    void handler(req as AuthenticatedRequest, res).catch(next);
}

function uploadCertificateFile(req: Request, res: Response, next: NextFunction): void {
  certificateUpload.single('file')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      res.status(status).json({
        error: status === 413
          ? 'Certificate files must be 10 MB or smaller.'
          : 'Upload one certificate file using the file field.',
      });
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
}

function certificateInput(body: unknown): CertificateInput | null {
  if (!body || typeof body !== 'object') return null;
  const values = body as Record<string, unknown>;
  const name = typeof values.name === 'string' ? values.name.trim() : '';
  const organization = typeof values.organization === 'string' ? values.organization.trim() : '';
  const issueDate = typeof values.issueDate === 'string' ? values.issueDate : '';
  const expiryDate = typeof values.expiryDate === 'string' ? values.expiryDate : '';
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

  if (
    !name ||
    name.length > 120 ||
    !organization ||
    organization.length > 160 ||
    !validDate(issueDate) ||
    (expiryDate !== '' && !validDate(expiryDate)) ||
    (expiryDate !== '' && expiryDate < issueDate)
  ) {
    return null;
  }
  return { name, organization, issueDate, expiryDate };
}

function validatedCertificateFile(req: Request): CertificateFile | null {
  const uploaded = req.file;
  if (!uploaded || !uploaded.buffer.length) return null;
  const extension = uploaded.originalname.toLowerCase().match(/\.(pdf|jpe?g|png)$/)?.[0];
  if (!extension) return null;

  let mimeType: string;
  if (
    extension === '.pdf' &&
    uploaded.mimetype === 'application/pdf' &&
    uploaded.buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  ) {
    mimeType = 'application/pdf';
  } else if (
    (extension === '.jpg' || extension === '.jpeg') &&
    uploaded.mimetype === 'image/jpeg' &&
    uploaded.buffer[0] === 0xff &&
    uploaded.buffer[1] === 0xd8 &&
    uploaded.buffer[2] === 0xff
  ) {
    mimeType = 'image/jpeg';
  } else if (
    extension === '.png' &&
    uploaded.mimetype === 'image/png' &&
    uploaded.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    mimeType = 'image/png';
  } else {
    return null;
  }

  return {
    buffer: uploaded.buffer,
    originalName: uploaded.originalname,
    mimeType,
    extension,
  };
}

function sendCertificateDownload(res: Response, record: CertificateRecord, file: Buffer): void {
  const encodedFileName = encodeURIComponent(record.originalFileName).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  res.set({
    'Content-Type': record.mimeType,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  res.send(file);
}

function currentProfile(req: AuthenticatedRequest): UserProfile {
  return toProfile(req.member!, req.approval!);
}

function getTaskSnapshot(value: unknown): TaskItem | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !('title' in value) ||
    typeof value.title !== 'string' ||
    !('description' in value) ||
    typeof value.description !== 'string' ||
    !('assignedTo' in value) ||
    typeof value.assignedTo !== 'string' ||
    !('assignedToName' in value) ||
    typeof value.assignedToName !== 'string' ||
    !('createdBy' in value) ||
    typeof value.createdBy !== 'string' ||
    !('createdByName' in value) ||
    typeof value.createdByName !== 'string' ||
    !('status' in value) ||
    (value.status !== 'todo' && value.status !== 'in_progress' && value.status !== 'done') ||
    !('priority' in value) ||
    (value.priority !== 'low' && value.priority !== 'medium' && value.priority !== 'high') ||
    !('dueDate' in value) ||
    typeof value.dueDate !== 'string' ||
    !('createdAt' in value) ||
    typeof value.createdAt !== 'string' ||
    !('updatedAt' in value) ||
    typeof value.updatedAt !== 'string'
  ) return null;
  return value as TaskItem;
}

async function appendActivity(
  profile: UserProfile,
  action: ActionType,
  details: string,
  context?: Record<string, unknown>,
  eventId?: string
): Promise<AssistantHistoryEvent> {
  const logs = await listRows('activityLogs');
  const record = {
    id: eventId || `log_${randomUUID()}`,
    userId: profile.uid,
    userName: profile.displayName,
    userEmail: profile.email,
    action,
    details,
    timestamp: new Date().toISOString(),
  };
  const event: AssistantHistoryEvent = {
    id: record.id,
    userId: profile.uid,
    userName: profile.displayName,
    role: profile.role,
    action,
    details,
    timestamp: record.timestamp,
    ...(context ? { context } : {}),
  };
  if (action === 'task_created' || action === 'task_updated' || action === 'task_deleted') {
    const task = getTaskSnapshot(context?.task);
    const beforeTask = action === 'task_updated'
      ? getTaskSnapshot(context?.before)
      : action === 'task_deleted'
        ? task
        : null;
    const afterTask = action === 'task_updated'
      ? getTaskSnapshot(context?.after)
      : action === 'task_created'
        ? task
        : null;
    const taskId = afterTask?.id || beforeTask?.id;
    if (
      !taskId ||
      (action === 'task_updated' && (!beforeTask || !afterTask)) ||
      (action === 'task_created' && !afterTask) ||
      (action === 'task_deleted' && !beforeTask)
    ) {
      throw new Error(`Cannot archive ${action}: task snapshot is missing.`);
    }
    await appendTaskHistory({
      id: record.id,
      userId: profile.uid,
      userName: profile.displayName,
      role: profile.role,
      taskId,
      action,
      timestamp: record.timestamp,
      before: beforeTask,
      after: afterTask,
    });
  }
  if (logs.length >= ACTIVITY_LOG_LIMIT) {
    const oldest = logs[logs.length - 1];
    if (oldest?.id) await deleteRow('activityLogs', oldest.id, 'id');
  }
  await appendRows('activityLogs', [record]);
  await archiveAssistantActivity(event);
  return event;
}

async function getActiveProfiles(): Promise<UserProfile[]> {
  await ensureCanonicalAdminAssignment();
  const rows = await listRowsMany(['users', 'approvedUsers']);
  const users = rows.users as UserRecord[];
  const approvals = rows.approvedUsers as ApprovalRecord[];
  const approvalsByEmail = new Map(
    approvals
      .filter((approval) => approval.active === 'true')
      .map((approval) => [normalizeEmail(approval.email), approval])
  );
  return users
    .filter((user) => user.active === 'true' && user.uid && user.email)
    .flatMap((user) => {
      const approval = approvalsByEmail.get(normalizeEmail(user.email));
      return approval ? [toProfile(user, approval)] : [];
    });
}

function hasValidPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 6 && password.length <= 1024;
}

function hashPassword(password: string, salt = randomBytes(16).toString('hex')): {
  salt: string;
  hash: string;
} {
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') };
}

function passwordMatches(password: string, salt: string, expectedHex: string): boolean {
  if (!salt || !/^[a-f0-9]{128}$/i.test(expectedHex)) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function validRole(role: unknown): role is UserProfile['role'] {
  return role === 'admin' || role === 'member';
}

function parseTask(row: SheetRecord): TaskItem {
  const status: TaskStatus =
    row.status === 'in_progress' || row.status === 'done' ? row.status : 'todo';
  const priority: TaskPriority =
    row.priority === 'low' || row.priority === 'high' ? row.priority : 'medium';
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    assignedTo: row.assignedTo,
    assignedToName: row.assignedToName,
    assigneeEmail: row.assigneeEmail,
    createdBy: row.createdBy,
    createdByName: row.createdByName,
    status,
    priority,
    dueDate: row.dueDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseDailyReport(row: SheetRecord): DailyReport {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    date: row.date,
    whatIDid: row.whatIDid,
    leadsHandled: Number(row.leadsHandled) || 0,
    blockers: row.blockers,
    planTomorrow: row.planTomorrow,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseWeeklySummary(row: SheetRecord): WeeklySummary {
  return {
    weekId: row.weekId,
    summary: row.summary,
    totalLeads: Number(row.totalLeads) || 0,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
    sentAt: row.sentAt || undefined,
  };
}

function parseCalendarLeave(row: SheetRecord): Omit<CalendarLeave, 'userName' | 'userRole'> {
  return {
    id: row.id,
    userId: row.userId,
    startDate: row.startDate,
    endDate: row.endDate,
    note: row.note || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isValidCalendarDate(value: unknown): value is string {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function calendarLeaveInput(body: unknown): Omit<CalendarLeave, 'id' | 'userId' | 'userName' | 'userRole' | 'createdAt' | 'updatedAt'> | null {
  if (!body || typeof body !== 'object') return null;
  const values = body as Record<string, unknown>;
  const startDate = values.startDate;
  const endDate = values.endDate;
  const note = typeof values.note === 'string' ? values.note.trim() : '';
  if (
    !isValidCalendarDate(startDate) ||
    !isValidCalendarDate(endDate) ||
    startDate > endDate ||
    note.length > 240
  ) return null;
  return { startDate, endDate, note };
}

function calendarNoteInput(body: unknown): Pick<CalendarNote, 'date' | 'title' | 'note'> | null {
  if (!body || typeof body !== 'object') return null;
  const values = body as Record<string, unknown>;
  const date = values.date;
  const title = typeof values.title === 'string' ? values.title.trim() : '';
  const note = typeof values.note === 'string' ? values.note.trim() : '';
  if (!isValidCalendarDate(date) || !title || title.length > 100 || note.length > 1000) return null;
  return { date, title, note };
}

function parseActivityLog(row: SheetRecord): ActivityLog {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    action: row.action as ActionType,
    details: row.details,
    timestamp: row.timestamp,
  };
}

function validCapabilities(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null;
  return [...new Set(value.map((item: string) => item.trim()).filter(Boolean))].slice(0, 30);
}

function indiaDate(value: string | Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function isValidPhotoURL(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length <= 3 * 1024 * 1024 &&
    (value === '' || /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value));
}

function isValidLinkedInUrl(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length <= 256 &&
    (value === '' ||
      /^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_%.-]+\/?$/i.test(value) ||
      /^[A-Za-z0-9][A-Za-z0-9-]{1,99}$/.test(value));
}

function isValidWhatsAppNumber(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length <= 32 &&
    (value === '' ||
      (/^\+?[0-9\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 7 &&
        value.replace(/\D/g, '').length <= 15));
}

async function upsertApproval(approval: ApprovalRecord): Promise<void> {
  const oldEmail = approval.email;
  await upsertRow('approvedUsers', oldEmail, 'email', approval);
}

export function registerApiRoutes(app: Express): void {
  app.post(
    '/api/auth/signup',
    asyncRoute(async (req, res) => {
      const email = normalizeEmail(req.body?.email);
      const password = req.body?.password;
      const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
      const configuredAdminEmail = getConfiguredAdminEmail();
      if (!isValidEmail(email) || !hasValidPassword(password)) {
        res.status(400).json({ error: 'Enter a valid email and password of at least 6 characters.' });
        return;
      }
      let [approvals, users] = await Promise.all([
        listRows('approvedUsers') as Promise<ApprovalRecord[]>,
        listRows('users') as Promise<UserRecord[]>,
      ]);
      if (configuredAdminEmail && email !== configuredAdminEmail && !approvals.length && !users.length) {
        res.status(403).json({ error: `The configured admin email is ${configuredAdminEmail}. Use that email to create the first administrator account.` });
        return;
      }
      let approval = approvals.find(
        (record) => normalizeEmail(record.email) === email && record.active === 'true'
      );
      let user: UserRecord | undefined;
      const credentials = hashPassword(password);

      if (!approval) {
        if (approvals.length || users.length) {
          res.status(403).json({ error: INVITE_ONLY_MESSAGE });
          return;
        }
        if (!displayName) {
          res.status(400).json({ error: 'Enter your name to create the first administrator account.' });
          return;
        }
        if (displayName.length > 100) {
          res.status(400).json({ error: 'Your name must be 100 characters or fewer.' });
          return;
        }
        const now = new Date().toISOString();
        approval = {
          email,
          displayName,
          role: 'admin',
          capabilities: '[]',
          active: 'true',
          createdAt: now,
          updatedAt: now,
        };
        user = {
          ...userProfileRecord({
            email,
            displayName,
            role: 'admin',
            capabilities: [],
          }),
          passwordSalt: credentials.salt,
          passwordHash: credentials.hash,
          createdAt: now,
          updatedAt: now,
        };
        if (!(await bootstrapAdmin(approval, user))) {
          res.status(409).json({ error: 'Initial setup has already been completed. Sign in or ask the admin to approve your email.' });
          return;
        }
      } else {
        const existing = users.find((record) => normalizeEmail(record.email) === email);
        if (existing?.passwordHash) {
          res.status(409).json({ error: 'This email is already registered. Please sign in instead.' });
          return;
        }
        user = existing
          ? { ...existing, passwordSalt: credentials.salt, passwordHash: credentials.hash, active: 'true', updatedAt: new Date().toISOString() }
          : {
              ...userProfileRecord({
                email,
                displayName: approval.displayName,
                role: approval.role,
                capabilities: parseArray(approval.capabilities),
              }),
              passwordSalt: credentials.salt,
              passwordHash: credentials.hash,
            };
        await upsertRow('users', email, 'email', user);
      }
      const profile = toProfile(user, approval);
      res.status(201).json({ token: createToken(user.uid), profile });
    })
  );

  app.post(
    '/api/auth/login',
    asyncRoute(async (req, res) => {
      const email = normalizeEmail(req.body?.email);
      const password = req.body?.password;
      const configuredAdminEmail = getConfiguredAdminEmail();
      if (!isValidEmail(email) || typeof password !== 'string') {
        res.status(400).json({ error: 'Enter a valid email and password.' });
        return;
      }
      if (configuredAdminEmail && email !== configuredAdminEmail) {
        const rows = await listRowsMany(['users', 'approvedUsers']);
        const hasExistingUsers = (rows.users as UserRecord[]).length > 0 || (rows.approvedUsers as ApprovalRecord[]).length > 0;
        if (!hasExistingUsers) {
          res.status(403).json({ error: `The configured admin email is ${configuredAdminEmail}. Use that email to create the first administrator account.` });
          return;
        }
      }
      const records = await listRowsMany(['approvedUsers', 'users']);
      const approval = (records.approvedUsers as ApprovalRecord[]).find(
        (record) => normalizeEmail(record.email) === email && record.active === 'true'
      );
      const users = records.users as UserRecord[];
      const user = users.find((record) => normalizeEmail(record.email) === email);
      if (!approval || !user || user.active !== 'true' || !passwordMatches(password, user.passwordSalt, user.passwordHash)) {
        res.status(401).json({ error: 'Incorrect email or password.' });
        return;
      }
      const profile = toProfile(user, approval);
      res.json({ token: createToken(user.uid), profile });
    })
  );

  app.get(
    '/api/auth/me',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json({ profile: currentProfile(req) });
    })
  );

  app.get(
    '/api/certificates',
    requireAuth,
    asyncRoute(async (req, res) => {
      res.json(await listCertificates(req.member!.uid));
    })
  );

  app.get(
    '/api/team/certificates',
    requireAuth,
    asyncRoute(async (req, res) => {
      const [records, profiles] = await Promise.all([
        listCertificates(),
        getActiveProfiles(),
      ]);
      const profilesById = new Map(profiles.map((profile) => [profile.uid, profile]));
      res.json(
        records.flatMap((record) => {
          const owner = profilesById.get(record.userId);
          return owner && record.userId !== req.member!.uid
            ? [{
                ...record,
                ownerName: owner.displayName,
                ownerEmail: owner.email,
                ownerRole: owner.role,
              }]
            : [];
        })
      );
    })
  );

  app.post(
    '/api/certificates',
    requireAuth,
    uploadCertificateFile,
    asyncRoute(async (req, res) => {
      const input = certificateInput(req.body);
      const file = validatedCertificateFile(req);
      if (!input || !file) {
        res.status(400).json({
          error: 'Enter a valid certificate name, organization, and issue date, and upload a valid PDF, JPG, JPEG, or PNG file.',
        });
        return;
      }
      const certificate = await createCertificate(req.member!.uid, input, file);
      await appendActivity(currentProfile(req), 'certificate_created', `Added certificate "${certificate.name}"`, {
        ownerId: certificate.userId,
        certificate,
      });
      res.status(201).json(certificate);
    })
  );

  app.get(
    '/api/certificates/:id/file',
    requireAuth,
    asyncRoute(async (req, res) => {
      const record = await getCertificate(req.params.id);
      const owner = record && (await getActiveProfiles()).find(
        (profile) => profile.uid === record.userId
      );
      if (!record || !owner) {
        res.status(404).json({ error: 'Certificate not found.' });
        return;
      }
      sendCertificateDownload(res, record, await getCertificateFile(record));
    })
  );

  app.patch(
    '/api/certificates/:id',
    requireAuth,
    uploadCertificateFile,
    asyncRoute(async (req, res) => {
      const record = await getCertificate(req.params.id);
      if (!record || record.userId !== req.member!.uid) {
        res.status(record ? 403 : 404).json({ error: record ? 'You can only edit your own certificates.' : 'Certificate not found.' });
        return;
      }
      const input = certificateInput(req.body);
      const file = req.file ? validatedCertificateFile(req) : undefined;
      if (!input || (req.file && !file)) {
        res.status(400).json({
          error: 'Enter a valid certificate name, organization, and issue date, and upload a valid PDF, JPG, JPEG, or PNG file.',
        });
        return;
      }
      const updated = await updateCertificate(record.id, input, file || undefined);
      if (!updated) {
        res.status(404).json({ error: 'Certificate not found.' });
        return;
      }
      await appendActivity(currentProfile(req), 'certificate_updated', `Updated certificate "${updated.name}"`, {
        ownerId: updated.userId,
        before: record,
        after: updated,
      });
      res.json(updated);
    })
  );

  app.delete(
    '/api/certificates/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      const record = await getCertificate(req.params.id);
      if (!record || record.userId !== req.member!.uid) {
        res.status(record ? 403 : 404).json({ error: record ? 'You can only delete your own certificates.' : 'Certificate not found.' });
        return;
      }
      await deleteCertificate(record.id);
      await appendActivity(currentProfile(req), 'certificate_deleted', `Deleted certificate "${record.name}"`, {
        ownerId: record.userId,
        certificate: record,
      });
      res.status(204).end();
    })
  );

  app.get(
    '/api/admin/certificates',
    requireAuth,
    requireAdmin,
    asyncRoute(async (_req, res) => {
      const members = (await getActiveProfiles()).filter((profile) => profile.role === 'member');
      const profilesById = new Map(members.map((profile) => [profile.uid, profile]));
      const records = await listCertificates();
      res.json(
        records.flatMap((record) => {
          const owner = profilesById.get(record.userId);
          return owner
            ? [{ ...record, ownerName: owner.displayName, ownerEmail: owner.email }]
            : [];
        })
      );
    })
  );

  app.post(
    '/api/admin/certificates/:uid',
    requireAuth,
    requireAdmin,
    uploadCertificateFile,
    asyncRoute(async (req, res) => {
      const owner = (await getActiveProfiles()).find(
        (profile) => profile.uid === req.params.uid && profile.role === 'member'
      );
      if (!owner) {
        res.status(404).json({ error: 'Active employee not found.' });
        return;
      }
      const input = certificateInput(req.body);
      const file = validatedCertificateFile(req);
      if (!input || !file) {
        res.status(400).json({
          error: 'Enter a valid certificate name, organization, and issue date, and upload a valid PDF, JPG, JPEG, or PNG file.',
        });
        return;
      }
      const certificate = await createCertificate(owner.uid, input, file);
      await appendActivity(currentProfile(req), 'certificate_created', `Added certificate "${certificate.name}" for ${owner.displayName}`, {
        ownerId: owner.uid,
        certificate,
      });
      res.status(201).json(certificate);
    })
  );

  app.get(
    '/api/admin/certificates/:id/file',
    requireAuth,
    requireAdmin,
    asyncRoute(async (req, res) => {
      const record = await getCertificate(req.params.id);
      const owner = record && (await getActiveProfiles()).find(
        (profile) => profile.uid === record.userId && profile.role === 'member'
      );
      if (!record || !owner) {
        res.status(404).json({ error: 'Employee certificate not found.' });
        return;
      }
      sendCertificateDownload(res, record, await getCertificateFile(record));
    })
  );

  app.patch(
    '/api/admin/certificates/:id',
    requireAuth,
    requireAdmin,
    uploadCertificateFile,
    asyncRoute(async (req, res) => {
      const record = await getCertificate(req.params.id);
      const owner = record && (await getActiveProfiles()).find(
        (profile) => profile.uid === record.userId && profile.role === 'member'
      );
      if (!record || !owner) {
        res.status(404).json({ error: 'Employee certificate not found.' });
        return;
      }
      const input = certificateInput(req.body);
      const file = req.file ? validatedCertificateFile(req) : undefined;
      if (!input || (req.file && !file)) {
        res.status(400).json({
          error: 'Enter a valid certificate name, organization, and issue date, and upload a valid PDF, JPG, JPEG, or PNG file.',
        });
        return;
      }
      const updated = await updateCertificate(record.id, input, file || undefined);
      if (!updated) {
        res.status(404).json({ error: 'Employee certificate not found.' });
        return;
      }
      await appendActivity(currentProfile(req), 'certificate_updated', `Updated certificate "${updated.name}" for ${owner.displayName}`, {
        ownerId: owner.uid,
        before: record,
        after: updated,
      });
      res.json(updated);
    })
  );

  app.delete(
    '/api/admin/certificates/:id',
    requireAuth,
    requireAdmin,
    asyncRoute(async (req, res) => {
      const record = await getCertificate(req.params.id);
      const owner = record && (await getActiveProfiles()).find(
        (profile) => profile.uid === record.userId && profile.role === 'member'
      );
      if (!record || !owner) {
        res.status(404).json({ error: 'Employee certificate not found.' });
        return;
      }
      await deleteCertificate(record.id);
      await appendActivity(currentProfile(req), 'certificate_deleted', `Deleted certificate "${record.name}" for ${owner.displayName}`, {
        ownerId: owner.uid,
        certificate: record,
      });
      res.status(204).end();
    })
  );

  app.get(
    '/api/data',
    requireAuth,
    asyncRoute(async (req, res) => {
      const rows = await listRowsMany([
        'users',
        'approvedUsers',
        'tasks',
        'dailyReports',
        'activityLogs',
        'calendarLeaves',
        'calendarNotes',
        'weeklyReports',
      ]);
      const users = rows.users as UserRecord[];
      const approvals = rows.approvedUsers as ApprovalRecord[];
      const approvedByEmail = new Map(
        approvals.filter((approval) => approval.active === 'true')
          .map((approval) => [normalizeEmail(approval.email), approval])
      );
      const profiles = users
        .filter((user) => user.active === 'true' && user.uid && user.email)
        .flatMap((user) => {
          const approval = approvedByEmail.get(normalizeEmail(user.email));
          return approval ? [toProfile(user, approval)] : [];
        });
      const taskRows = rows.tasks.map(parseTask);
      const reportRows = rows.dailyReports.map(parseDailyReport);
      const logRows = rows.activityLogs.map(parseActivityLog);
      const activeIds = new Set(profiles.map((profile) => profile.uid));
      const profilesById = new Map(profiles.map((profile) => [profile.uid, profile]));
      const tasks = taskRows
        .filter((task) => activeIds.has(task.assignedTo))
        .map((task) => {
          const assignee = profilesById.get(task.assignedTo)!;
          return { ...task, assignedToName: assignee.displayName, assigneeEmail: assignee.email };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const dailyReports = reportRows
        .filter((report) => activeIds.has(report.userId))
        .map((report) => {
          const profile = profilesById.get(report.userId)!;
          return { ...report, userName: profile.displayName, userEmail: profile.email };
        })
        .sort((a, b) => b.date.localeCompare(a.date));
      const activityLogs = logRows
        .filter((log) => log.action !== 'user_login')
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const calendarLeaves = rows.calendarLeaves
        .map(parseCalendarLeave)
        .flatMap((leave) => {
          const owner = profilesById.get(leave.userId);
          return owner ? [{ ...leave, userName: owner.displayName, userRole: owner.role }] : [];
        })
        .sort((left, right) => left.startDate.localeCompare(right.startDate));
      const calendarNotes = rows.calendarNotes
        .flatMap((row) => {
          const owner = profilesById.get(row.userId);
          return owner ? [{
            id: row.id,
            date: row.date,
            userId: row.userId,
            userName: owner.displayName,
            title: row.title,
            note: row.note || '',
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          }] : [];
        })
        .sort((left, right) => left.date.localeCompare(right.date));
      const weeklySummaries = rows.weeklyReports
        .map(parseWeeklySummary)
        .filter((summary) => Boolean(summary.updatedAt));
      res.json({ teamMembers: profiles, tasks, dailyReports, activityLogs, calendarLeaves, calendarNotes, weeklySummaries });
    })
  );

  app.get(
    '/api/settings',
    requireAuth,
    asyncRoute(async (req, res) => {
      const rows = await listRows('settings');
      const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
      res.json({
        reportRecipientEmail: req.approval?.role === 'admin' ? settings.reportRecipientEmail || '' : '',
        teamName: settings.teamName || '',
        updatedBy: settings.updatedBy || '',
        updatedAt: settings.updatedAt || '',
      } satisfies AppSettings);
    })
  );

  app.put(
    '/api/settings',
    requireAuth,
    requireAdmin,
    asyncRoute(async (req, res) => {
      const profile = currentProfile(req);
      const settings = {
        reportRecipientEmail: typeof req.body?.reportRecipientEmail === 'string' ? req.body.reportRecipientEmail.trim() : '',
        teamName: typeof req.body?.teamName === 'string' ? req.body.teamName.trim() : '',
        updatedBy: profile.displayName,
        updatedAt: new Date().toISOString(),
      };
      await setSettings(settings);
      await appendActivity(profile, 'settings_updated', 'Updated report recipient and team settings');
      res.json(settings);
    })
  );

  app.post(
    '/api/tasks',
    requireAuth,
    asyncRoute(async (req, res) => {
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const assignedTo = typeof req.body?.assignedTo === 'string' ? req.body.assignedTo : '';
      const profiles = await getActiveProfiles();
      const assignee = profiles.find((profile) => profile.uid === assignedTo);
      if (!title || !assignee) {
        res.status(400).json({ error: 'A task title and active approved assignee are required.' });
        return;
      }
      if (req.approval?.role !== 'admin' && assignedTo !== req.member?.uid) {
        res.status(403).json({ error: 'Members can only assign tasks to themselves.' });
        return;
      }
      const now = new Date().toISOString();
      const task: TaskItem = {
        id: `task_${randomUUID()}`,
        title,
        description: typeof req.body.description === 'string' ? req.body.description : '',
        assignedTo: assignee.uid,
        assignedToName: assignee.displayName,
        assigneeEmail: assignee.email,
        createdBy: req.member!.uid,
        createdByName: currentProfile(req).displayName,
        status: req.body.status === 'in_progress' || req.body.status === 'done' ? req.body.status : 'todo',
        priority: req.body.priority === 'low' || req.body.priority === 'high' ? req.body.priority : 'medium',
        dueDate: typeof req.body.dueDate === 'string' ? req.body.dueDate : '',
        createdAt: now,
        updatedAt: now,
      };
      await appendRows('tasks', [task as unknown as SheetRecord]);
      const event = await appendActivity(currentProfile(req), 'task_created', `Created task "${task.title}" assigned to ${task.assignedToName}`, {
        task,
      });
      notifyTaskActivity(event);
      res.status(201).json(task);
    })
  );

  app.patch(
    '/api/tasks/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      const rows = (await listRows('tasks')).map(parseTask);
      const existing = rows.find((task) => task.id === req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Task not found.' });
        return;
      }
      if (req.approval?.role !== 'admin' && existing.assignedTo !== req.member?.uid) {
        res.status(403).json({ error: 'Members can only update their own tasks.' });
        return;
      }
      const update = req.body || {};
      const updated: TaskItem = { ...existing, updatedAt: new Date().toISOString() };
      if (typeof update.title === 'string') updated.title = update.title;
      if (typeof update.description === 'string') updated.description = update.description;
      if (update.status === 'todo' || update.status === 'in_progress' || update.status === 'done') {
        updated.status = update.status;
      }
      if (update.priority === 'low' || update.priority === 'medium' || update.priority === 'high') {
        updated.priority = update.priority;
      }
      if (typeof update.dueDate === 'string') updated.dueDate = update.dueDate;
      if (typeof update.assignedTo === 'string') {
        if (req.approval?.role !== 'admin' && update.assignedTo !== req.member?.uid) {
          res.status(403).json({ error: 'Members can only assign tasks to themselves.' });
          return;
        }
        const assignee = (await getActiveProfiles()).find((profile) => profile.uid === update.assignedTo);
        if (!assignee) {
          res.status(400).json({ error: 'The assignee must be an active approved user.' });
          return;
        }
        updated.assignedTo = assignee.uid;
        updated.assignedToName = assignee.displayName;
        updated.assigneeEmail = assignee.email;
      }
      await upsertRow('tasks', updated.id, 'id', updated as unknown as SheetRecord);
      const detail = update.status
        ? `status changed to ${updated.status.toUpperCase()}`
        : 'details updated';
      const event = await appendActivity(currentProfile(req), 'task_updated', `Task "${existing.title}": ${detail}`, {
        before: existing,
        after: updated,
      });
      notifyTaskActivity(event);
      res.json(updated);
    })
  );

  app.delete(
    '/api/tasks/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      const rows = (await listRows('tasks')).map(parseTask);
      const task = rows.find((item) => item.id === req.params.id);
      if (!task) {
        res.status(404).json({ error: 'Task not found.' });
        return;
      }
      if (req.approval?.role !== 'admin' && task.assignedTo !== req.member?.uid) {
        res.status(403).json({ error: 'Members can only delete their own tasks.' });
        return;
      }
      await deleteRow('tasks', task.id, 'id');
      const event = await appendActivity(currentProfile(req), 'task_deleted', `Deleted task "${task.title}"`, {
        task,
      });
      notifyTaskActivity(event);
      res.json({ success: true });
    })
  );

  app.post(
    '/api/daily-reports',
    requireAuth,
    asyncRoute(async (req, res) => {
      const profile = currentProfile(req);
      const date = typeof req.body?.date === 'string' ? req.body.date : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ error: 'A valid report date is required.' });
        return;
      }
      const id = `${profile.uid}_${date}`;
      const existing = (await listRows('dailyReports')).map(parseDailyReport).find((report) => report.id === id);
      const now = new Date().toISOString();
      const report: DailyReport = {
        id,
        userId: profile.uid,
        userName: profile.displayName,
        userEmail: profile.email,
        date,
        whatIDid: typeof req.body.whatIDid === 'string' ? req.body.whatIDid : '',
        leadsHandled: existing?.leadsHandled || 0,
        blockers: typeof req.body.blockers === 'string' ? req.body.blockers : '',
        planTomorrow: typeof req.body.planTomorrow === 'string' ? req.body.planTomorrow : '',
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      const reportEventId = `log_${randomUUID()}`;
      await upsertRow('dailyReports', id, 'id', report as unknown as SheetRecord);
      await appendDailyReportHistory({
        id: reportEventId,
        userId: profile.uid,
        userName: profile.displayName,
        role: profile.role,
        reportDate: date,
        timestamp: now,
        before: existing || null,
        after: report,
      });
      const event = await appendActivity(
        profile,
        existing ? 'report_updated' : 'report_submitted',
        `${existing ? 'Updated' : 'Submitted'} daily report for ${date}`,
        { report, before: existing || null, after: report },
        reportEventId
      );
      notifyTaskActivity(event);
      res.json(report);
    })
  );

  app.get(
    '/api/calendar/leaves',
    requireAuth,
    asyncRoute(async (_req, res) => {
      const [rows, profiles] = await Promise.all([
        listRows('calendarLeaves'),
        getActiveProfiles(),
      ]);
      const profilesById = new Map(profiles.map((profile) => [profile.uid, profile]));
      const leaves = rows
        .map(parseCalendarLeave)
        .flatMap((leave) => {
          const owner = profilesById.get(leave.userId);
          return owner ? [{ ...leave, userName: owner.displayName, userRole: owner.role }] : [];
        })
        .sort((left, right) => left.startDate.localeCompare(right.startDate));
      res.json(leaves);
    })
  );

  app.post(
    '/api/calendar/leaves',
    requireAuth,
    asyncRoute(async (req, res) => {
      const input = calendarLeaveInput(req.body);
      if (!input) {
        res.status(400).json({ error: 'Enter valid leave dates and a note of 240 characters or fewer.' });
        return;
      }
      const actor = currentProfile(req);
      const requestedUserId = typeof req.body?.userId === 'string' ? req.body.userId : actor.uid;
      if (requestedUserId !== actor.uid && actor.role !== 'admin') {
        res.status(403).json({ error: 'You can only create leave entries for yourself.' });
        return;
      }
      const owner = (await getActiveProfiles()).find((profile) => profile.uid === requestedUserId);
      if (!owner) {
        res.status(404).json({ error: 'The selected team member is not active.' });
        return;
      }
      const now = new Date().toISOString();
      const leave: CalendarLeave = {
        id: randomUUID(),
        userId: owner.uid,
        userName: owner.displayName,
        userRole: owner.role,
        ...input,
        createdAt: now,
        updatedAt: now,
      };
      await appendRows('calendarLeaves', [{
        id: leave.id,
        userId: leave.userId,
        startDate: leave.startDate,
        endDate: leave.endDate,
        note: leave.note,
        createdAt: leave.createdAt,
        updatedAt: leave.updatedAt,
      }]);
      await appendActivity(actor, 'leave_created', `Added leave for ${owner.displayName} from ${leave.startDate} to ${leave.endDate}`);
      res.status(201).json(leave);
    })
  );

  app.patch(
    '/api/calendar/leaves/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      const actor = currentProfile(req);
      const record = (await listRows('calendarLeaves')).find((row) => row.id === req.params.id);
      if (!record) {
        res.status(404).json({ error: 'Leave entry not found.' });
        return;
      }
      if (actor.role !== 'admin' && record.userId !== actor.uid) {
        res.status(403).json({ error: 'You can only edit your own leave entries.' });
        return;
      }
      const input = calendarLeaveInput(req.body);
      if (!input) {
        res.status(400).json({ error: 'Enter valid leave dates and a note of 240 characters or fewer.' });
        return;
      }
      const requestedUserId = typeof req.body?.userId === 'string' ? req.body.userId : record.userId;
      if (requestedUserId !== record.userId && actor.role !== 'admin') {
        res.status(403).json({ error: 'You can only edit your own leave entries.' });
        return;
      }
      const owner = (await getActiveProfiles()).find((profile) => profile.uid === requestedUserId);
      if (!owner) {
        res.status(404).json({ error: 'The selected team member is not active.' });
        return;
      }
      const updated: CalendarLeave = {
        ...parseCalendarLeave(record),
        ...input,
        userId: owner.uid,
        userName: owner.displayName,
        userRole: owner.role,
        updatedAt: new Date().toISOString(),
      };
      await upsertRow('calendarLeaves', updated.id, 'id', {
        id: updated.id,
        userId: updated.userId,
        startDate: updated.startDate,
        endDate: updated.endDate,
        note: updated.note,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
      await appendActivity(actor, 'leave_updated', `Updated leave for ${owner.displayName} from ${updated.startDate} to ${updated.endDate}`);
      res.json(updated);
    })
  );

  app.delete(
    '/api/calendar/leaves/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      const actor = currentProfile(req);
      const record = (await listRows('calendarLeaves')).find((row) => row.id === req.params.id);
      if (!record) {
        res.status(404).json({ error: 'Leave entry not found.' });
        return;
      }
      if (actor.role !== 'admin' && record.userId !== actor.uid) {
        res.status(403).json({ error: 'You can only remove your own leave entries.' });
        return;
      }
      await deleteRow('calendarLeaves', record.id, 'id');
      const owner = (await getActiveProfiles()).find((profile) => profile.uid === record.userId);
      await appendActivity(actor, 'leave_deleted', `Removed leave for ${owner?.displayName || 'a team member'} from ${record.startDate} to ${record.endDate}`);
      res.status(204).end();
    })
  );

  app.post(
    '/api/calendar/notes',
    requireAuth,
    asyncRoute(async (req, res) => {
      const input = calendarNoteInput(req.body);
      if (!input) {
        res.status(400).json({ error: 'Enter a valid date, a title of 100 characters or fewer, and a note of 1000 characters or fewer.' });
        return;
      }
      const actor = currentProfile(req);
      const note: CalendarNote = {
        id: randomUUID(),
        ...input,
        userId: actor.uid,
        userName: actor.displayName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await appendRows('calendarNotes', [{
        id: note.id,
        date: note.date,
        userId: note.userId,
        userName: note.userName,
        title: note.title,
        note: note.note,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      }]);
      await appendActivity(actor, 'calendar_note_created', `Added calendar note "${note.title}" for ${note.date}`);
      res.status(201).json(note);
    })
  );

  app.patch(
    '/api/calendar/notes/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      const actor = currentProfile(req);
      const record = (await listRows('calendarNotes')).find((row) => row.id === req.params.id);
      if (!record) {
        res.status(404).json({ error: 'Calendar note not found.' });
        return;
      }
      if (actor.role !== 'admin' && record.userId !== actor.uid) {
        res.status(403).json({ error: 'You can only edit your own calendar notes.' });
        return;
      }
      const input = calendarNoteInput(req.body);
      if (!input) {
        res.status(400).json({ error: 'Enter a valid date, a title of 100 characters or fewer, and a note of 1000 characters or fewer.' });
        return;
      }
      const updated: CalendarNote = {
        id: record.id,
        userId: record.userId,
        userName: record.userName,
        createdAt: record.createdAt,
        ...input,
        updatedAt: new Date().toISOString(),
      };
      await upsertRow('calendarNotes', updated.id, 'id', {
        id: updated.id,
        date: updated.date,
        userId: updated.userId,
        userName: updated.userName,
        title: updated.title,
        note: updated.note,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
      await appendActivity(actor, 'calendar_note_updated', `Updated calendar note "${updated.title}" for ${updated.date}`);
      res.json(updated);
    })
  );

  app.delete(
    '/api/calendar/notes/:id',
    requireAuth,
    asyncRoute(async (req, res) => {
      const actor = currentProfile(req);
      const record = (await listRows('calendarNotes')).find((row) => row.id === req.params.id);
      if (!record) {
        res.status(404).json({ error: 'Calendar note not found.' });
        return;
      }
      if (actor.role !== 'admin' && record.userId !== actor.uid) {
        res.status(403).json({ error: 'You can only remove your own calendar notes.' });
        return;
      }
      await deleteRow('calendarNotes', record.id, 'id');
      await appendActivity(actor, 'calendar_note_deleted', `Removed calendar note "${record.title}" for ${record.date}`);
      res.status(204).end();
    })
  );

  app.get(
    '/api/weekly-reports/:weekId',
    requireAuth,
    asyncRoute(async (req, res) => {
      const rows = (await listRows('weeklyReports')).map(parseWeeklySummary);
      res.json(rows.find((item) => item.weekId === req.params.weekId) || null);
    })
  );

  app.put(
    '/api/weekly-reports/:weekId',
    requireAuth,
    asyncRoute(async (req, res) => {
      const weekId = req.params.weekId;
      if (req.approval?.role !== 'admin') {
        res.status(403).json({ error: 'Only admins can prepare or save weekly reports.' });
        return;
      }
      const summary = typeof req.body?.summary === 'string' ? req.body.summary : '';
      const totalLeads = Number.isFinite(Number(req.body?.totalLeads)) ? Math.max(0, Number(req.body.totalLeads)) : 0;
      const existing = (await listRows('weeklyReports')).map(parseWeeklySummary).find((item) => item.weekId === weekId);
      const updated: WeeklySummary = {
        weekId,
        summary,
        totalLeads,
        updatedBy: currentProfile(req).displayName,
        updatedAt: new Date().toISOString(),
        sentAt: typeof req.body?.sentAt === 'string' ? req.body.sentAt : existing?.sentAt,
      };
      await upsertRow('weeklyReports', weekId, 'weekId', updated as unknown as SheetRecord);
      await appendActivity(currentProfile(req), 'settings_updated', `Saved weekly report summary for ${weekId}`, {
        weeklySummary: updated,
      });
      res.json(updated);
    })
  );

  app.post(
    '/api/activity',
    requireAuth,
    asyncRoute(async (req, res) => {
      const action = req.body?.action as ActionType;
      const details = typeof req.body?.details === 'string' ? req.body.details.trim().slice(0, 1000) : '';
      if (action !== 'ai_task_created' || !details) {
        res.status(400).json({ error: 'Unsupported activity action.' });
        return;
      }
      await appendActivity(currentProfile(req), action, details);
      res.status(201).json({ success: true });
    })
  );

  app.post(
    '/api/members',
    requireAuth,
    requireAdmin,
    asyncRoute(async (req, res) => {
      const email = normalizeEmail(req.body?.email);
      const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
      const configuredAdminEmail = getConfiguredAdminEmail();
      const role = configuredAdminEmail && email === configuredAdminEmail ? 'admin' : req.body?.role;
      const capabilities = validCapabilities(req.body?.capabilities);
      const linkedInUrl = req.body?.linkedInUrl === undefined ? '' : req.body.linkedInUrl;
      const whatsappNumber = req.body?.whatsappNumber === undefined ? '' : req.body.whatsappNumber;
      if (
        !isValidEmail(email) || !displayName || !validRole(role) || !capabilities ||
        !isValidLinkedInUrl(linkedInUrl) || !isValidWhatsAppNumber(whatsappNumber)
      ) {
        res.status(400).json({ error: 'Enter valid member details, including a LinkedIn profile and WhatsApp number if provided.' });
        return;
      }
      if (configuredAdminEmail && role === 'admin' && email !== configuredAdminEmail) {
        res.status(400).json({ error: `Only the configured admin email (${configuredAdminEmail}) can be an admin. Other members must remain members.` });
        return;
      }
      if ((await listRows('approvedUsers') as ApprovalRecord[]).some((item) => normalizeEmail(item.email) === email)) {
        res.status(409).json({ error: 'A member with this email is already approved.' });
        return;
      }
      const now = new Date().toISOString();
      const approval: ApprovalRecord = {
        email,
        displayName,
        role,
        capabilities: JSON.stringify(capabilities),
        active: 'true',
        createdAt: now,
        updatedAt: now,
      };
      const user = userProfileRecord({ email, displayName, role, capabilities, linkedInUrl, whatsappNumber });
      await appendRows('approvedUsers', [approval]);
      await appendRows('users', [user]);
      await appendActivity(currentProfile(req), 'member_added', `Added ${role} member ${displayName} (${email})`, {
        member: toProfile(user, approval),
      });
      res.status(201).json(toProfile(user, approval));
    })
  );

  app.post(
    '/api/members/:uid/password',
    requireAuth,
    requireAdmin,
    asyncRoute(async (req, res) => {
      const uid = req.params.uid;
      const password = req.body?.password;
      if (!hasValidPassword(password)) {
        res.status(400).json({ error: 'Password must be between 6 and 1024 characters.' });
        return;
      }

      const active = await activeUserForUid(uid);
      if (!active) {
        res.status(404).json({ error: 'Active team member not found.' });
        return;
      }

      const user = active.user;
      const credentials = hashPassword(password);
      await upsertRow('users', uid, 'uid', {
        ...user,
        passwordSalt: credentials.salt,
        passwordHash: credentials.hash,
        updatedAt: new Date().toISOString(),
      });
      await appendActivity(
        currentProfile(req),
        'member_password_reset',
        `Changed the password for ${user.displayName} (${user.email})`,
        { memberId: user.uid, memberName: user.displayName }
      );
      res.json({ success: true });
    })
  );

  app.patch(
    '/api/members/:uid',
    requireAuth,
    asyncRoute(async (req, res) => {
      const uid = req.params.uid;
      const isAdmin = req.approval?.role === 'admin';
      const isSelf = uid === req.member?.uid;
      if (!isAdmin && !isSelf) {
        res.status(403).json({ error: 'You can only update your own photo and contact details.' });
        return;
      }
      if (!isAdmin && Object.keys(req.body || {}).some(
        (key) => !['photoURL', 'linkedInUrl', 'whatsappNumber'].includes(key)
      )) {
        res.status(403).json({ error: 'You can only update your own photo and contact details.' });
        return;
      }
      if (req.body?.photoURL !== undefined && !isValidPhotoURL(req.body.photoURL)) {
        res.status(400).json({ error: 'Choose a supported image file up to 2 MB.' });
        return;
      }
      if (req.body?.linkedInUrl !== undefined && !isValidLinkedInUrl(req.body.linkedInUrl)) {
        res.status(400).json({ error: 'Enter a LinkedIn profile URL or profile ID.' });
        return;
      }
      if (req.body?.whatsappNumber !== undefined && !isValidWhatsAppNumber(req.body.whatsappNumber)) {
        res.status(400).json({ error: 'Enter a valid WhatsApp phone number.' });
        return;
      }
      const [users, approvals] = await Promise.all([
        listRows('users') as Promise<UserRecord[]>,
        listRows('approvedUsers') as Promise<ApprovalRecord[]>,
      ]);
      const user = users.find((item) => item.uid === uid);
      const oldApproval = user && approvals.find((item) => normalizeEmail(item.email) === normalizeEmail(user.email));
      if (!user || !oldApproval || oldApproval.active !== 'true') {
        res.status(404).json({ error: 'Active approved member not found.' });
        return;
      }
      if (uid === req.member?.uid && req.body?.role !== undefined && req.body.role !== oldApproval.role) {
        res.status(400).json({ error: 'You cannot change your own role.' });
        return;
      }
      if (uid === req.member?.uid && req.body?.active === false) {
        res.status(400).json({ error: 'You cannot deactivate your own account.' });
        return;
      }

      const email = req.body?.email === undefined ? normalizeEmail(user.email) : normalizeEmail(req.body.email);
      const displayName = req.body?.displayName === undefined ? oldApproval.displayName : String(req.body.displayName).trim();
      const configuredAdminEmail = getConfiguredAdminEmail();
      const role = req.body?.role === undefined ? oldApproval.role : req.body.role;
      const capabilities = req.body?.capabilities === undefined
        ? parseArray(oldApproval.capabilities)
        : validCapabilities(req.body.capabilities);
      const isActive = req.body?.active === false ? false : true;
      if (configuredAdminEmail && role === 'admin' && email !== configuredAdminEmail) {
        res.status(400).json({ error: `Only the configured admin email (${configuredAdminEmail}) can be an admin. Other members must remain members.` });
        return;
      }
      if (!isValidEmail(email) || !displayName || !validRole(role) || !capabilities) {
        res.status(400).json({ error: 'Enter a valid name, email, role, and capabilities list.' });
        return;
      }
      const emailConflict = approvals.some(
        (item) => normalizeEmail(item.email) === email && normalizeEmail(item.email) !== normalizeEmail(oldApproval.email)
      );
      if (emailConflict) {
        res.status(409).json({ error: 'A member with this email is already approved.' });
        return;
      }
      if (oldApproval.role === 'admin' && (role !== 'admin' || !isActive)) {
        const activeAdmins = approvals.filter(
          (item) => item.active === 'true' && item.role === 'admin'
        ).length;
        if (activeAdmins <= 1) {
          res.status(400).json({ error: 'At least one active admin must remain.' });
          return;
        }
      }

      const now = new Date().toISOString();
      const approval: ApprovalRecord = {
        ...oldApproval,
        email,
        displayName,
        role,
        capabilities: JSON.stringify(capabilities),
        active: isActive ? 'true' : 'false',
        updatedAt: now,
      };
      const updatedUser: UserRecord = {
        ...user,
        email,
        displayName,
        role,
        capabilities: JSON.stringify(capabilities),
        active: approval.active,
        photoURL: typeof req.body?.photoURL === 'string' ? req.body.photoURL : user.photoURL,
        linkedInUrl: typeof req.body?.linkedInUrl === 'string' ? req.body.linkedInUrl.trim() : user.linkedInUrl || '',
        whatsappNumber: typeof req.body?.whatsappNumber === 'string' ? req.body.whatsappNumber.trim() : user.whatsappNumber || '',
        updatedAt: now,
      };
      if (email !== normalizeEmail(oldApproval.email)) {
        await upsertApproval(approval);
        await deleteRow('approvedUsers', oldApproval.email, 'email');
      } else {
        await upsertApproval(approval);
      }
      await upsertRow('users', uid, 'uid', updatedUser);

      if (!isActive) {
        await appendActivity(currentProfile(req), 'member_deactivated', `Deactivated member ${oldApproval.displayName} (${oldApproval.email})`, {
          memberId: uid,
          memberName: oldApproval.displayName,
          previousRole: oldApproval.role,
        });
        res.json({ success: true });
        return;
      }
      if (role !== oldApproval.role) {
        await appendActivity(currentProfile(req), 'role_changed', `Changed ${displayName}'s role from ${oldApproval.role} to ${role}`, {
          member: toProfile(updatedUser, approval),
        });
      } else if (
        displayName !== oldApproval.displayName ||
        email !== normalizeEmail(oldApproval.email) ||
        JSON.stringify(capabilities) !== oldApproval.capabilities ||
        req.body?.photoURL !== undefined ||
        req.body?.linkedInUrl !== undefined ||
        req.body?.whatsappNumber !== undefined
      ) {
        await appendActivity(currentProfile(req), 'profile_updated', `Updated profile for ${displayName}`, {
          member: toProfile(updatedUser, approval),
        });
      }
      res.json(toProfile(updatedUser, approval));
    })
  );

  app.post(
    '/api/chat',
    requireAuth,
    asyncRoute(async (req, res) => {
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required.' });
        return;
      }
      if (prompt.length > 4_000) {
        res.status(400).json({ error: 'Chat messages must be 4,000 characters or fewer.' });
        return;
      }
      const [rows, allCertificates, archivedHistory] = await Promise.all([
        listRowsMany([
          'users',
          'approvedUsers',
          'tasks',
          'dailyReports',
          'activityLogs',
          'weeklyReports',
        ]),
        listCertificates(),
        getAssistantHistory(),
      ]);
      const users = rows.users as UserRecord[];
      const approvals = rows.approvedUsers as ApprovalRecord[];
      const approvedByEmail = new Map(
        approvals.filter((approval) => approval.active === 'true')
          .map((approval) => [normalizeEmail(approval.email), approval])
      );
      const teamMembers = users
        .filter((user) => user.active === 'true' && user.uid && user.email)
        .flatMap((user) => {
          const approval = approvedByEmail.get(normalizeEmail(user.email));
          return approval ? [toProfile(user, approval)] : [];
        });
      const currentUser = currentProfile(req);
      const isAdmin = req.approval?.role === 'admin';
      const accessibleMembers = isAdmin
        ? teamMembers
        : teamMembers.filter((member) => member.uid === currentUser.uid);
      const accessibleIds = new Set(accessibleMembers.map((member) => member.uid));
      const profilesById = new Map(teamMembers.map((member) => [member.uid, member]));
      const today = indiaDate(new Date());
      const tasks = rows.tasks.map(parseTask);
      const activeTasks = tasks
        .filter((task) =>
          accessibleIds.has(task.assignedTo) &&
          (isAdmin || task.assignedTo === currentUser.uid || task.createdBy === currentUser.uid)
        )
        .map((task) => {
          const assignee = profilesById.get(task.assignedTo)!;
          return { ...task, assignedToName: assignee.displayName, assigneeEmail: assignee.email };
        });
      const dailyReports = rows.dailyReports.map(parseDailyReport);
      const activeReports = dailyReports
        .filter((report) => accessibleIds.has(report.userId))
        .map((report) => {
          const profile = profilesById.get(report.userId)!;
          return { ...report, userName: profile.displayName, userEmail: profile.email };
        });
      const activityLogs = rows.activityLogs
        .map(parseActivityLog)
        .filter((log) => log.action !== 'user_login' && (isAdmin || log.userId === currentUser.uid));
      const accessibleCertificates = allCertificates
        .filter((certificate) =>
          isAdmin
            ? certificate.userId === currentUser.uid ||
              profilesById.get(certificate.userId)?.role === 'member'
            : certificate.userId === currentUser.uid
        )
        .map((certificate) => ({
          ...certificate,
          ownerName: profilesById.get(certificate.userId)?.displayName || currentUser.displayName,
        }));
      const visibleHistoryById = new Map<string, AssistantHistoryEvent>();
      for (const event of archivedHistory) {
        if (event.action === 'user_login') continue;
        if (isAdmin || event.userId === currentUser.uid) {
          visibleHistoryById.set(event.id, event);
          continue;
        }
        const context = event.context || {};
        const task = context.task as TaskItem | undefined;
        const before = context.before as { assignedTo?: string } | undefined;
        const after = context.after as { assignedTo?: string } | undefined;
        const report = context.report as DailyReport | undefined;
        const member = context.member as UserProfile | undefined;
        const isVisible = (
          context.ownerId === currentUser.uid ||
          context.memberId === currentUser.uid ||
          task?.assignedTo === currentUser.uid ||
          before?.assignedTo === currentUser.uid ||
          after?.assignedTo === currentUser.uid ||
          report?.userId === currentUser.uid ||
          member?.uid === currentUser.uid
        );
        if (isAdmin || event.userId === currentUser.uid || isVisible) {
          visibleHistoryById.set(event.id, event);
        }
      }
      for (const log of activityLogs) {
        if (!visibleHistoryById.has(log.id)) {
          visibleHistoryById.set(log.id, {
            id: log.id,
            userId: log.userId,
            userName: log.userName,
            action: log.action,
            details: log.details,
            timestamp: log.timestamp,
          });
        }
      }
      const visibleHistory = [...visibleHistoryById.values()];
      const reportHistory = new Map<string, DailyReport>();
      for (const event of visibleHistory) {
        const report = event.context?.report as DailyReport | undefined;
        if (report && accessibleIds.has(report.userId)) {
          const previous = reportHistory.get(report.id);
          if (!previous || report.updatedAt > previous.updatedAt) {
            reportHistory.set(report.id, report);
          }
        }
      }
      for (const report of activeReports) reportHistory.set(report.id, report);
      const blockerCounts = new Map<string, { count: number; examples: string[] }>();
      for (const report of reportHistory.values()) {
        const blocker = report.blockers?.trim();
        if (!blocker || /^(none|no blockers?|n\/a|na|nil|no issues?)\.?$/i.test(blocker)) continue;
        const key = blocker.toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
        const summary = blockerCounts.get(key) || { count: 0, examples: [] };
        summary.count += 1;
        if (summary.examples.length < 3) {
          summary.examples.push(
            `${report.userName || profilesById.get(report.userId)?.displayName || 'Employee'} (${report.date}): ${blocker}`
          );
        }
        blockerCounts.set(key, summary);
      }
      const overdueTasks = activeTasks.filter(
        (task) => task.status !== 'done' && task.dueDate && task.dueDate < today
      );
      const dueSoonTasks = activeTasks.filter(
        (task) => task.status !== 'done' && task.dueDate >= today &&
          task.dueDate <= new Date(Date.parse(`${today}T00:00:00.000Z`) + 7 * 86_400_000)
            .toISOString()
            .slice(0, 10)
      );
      const weekStartDate = new Date(`${today}T00:00:00.000Z`);
      weekStartDate.setUTCDate(weekStartDate.getUTCDate() - ((weekStartDate.getUTCDay() + 6) % 7));
      const weekStart = weekStartDate.toISOString().slice(0, 10);
      const weekReports = activeReports.filter((report) => report.date >= weekStart && report.date <= today);
      const weekTasks = activeTasks.filter(
        (task) => indiaDate(task.updatedAt) >= weekStart && indiaDate(task.updatedAt) <= today
      );
      const completedTasksThisWeek = visibleHistory
        .filter((event) => {
          if (event.action !== 'task_updated' || indiaDate(event.timestamp) < weekStart || indiaDate(event.timestamp) > today) {
            return false;
          }
          const before = event.context?.before as TaskItem | undefined;
          const after = event.context?.after as TaskItem | undefined;
          return after?.status === 'done' && before?.status !== 'done';
        })
        .map((event) => event.context?.after as TaskItem)
        .filter((task, index, tasksForWeek) =>
          task && tasksForWeek.findIndex((candidate) => candidate.id === task.id) === index
        );
      const employeeProgress = accessibleMembers.map((member) => {
        const memberTasks = activeTasks.filter((task) => task.assignedTo === member.uid);
        const memberReports = activeReports.filter((report) => report.userId === member.uid);
        return {
          name: member.displayName,
          skills: member.capabilities,
          tasks: {
            total: memberTasks.length,
            todo: memberTasks.filter((task) => task.status === 'todo').length,
            inProgress: memberTasks.filter((task) => task.status === 'in_progress').length,
            completed: memberTasks.filter((task) => task.status === 'done').length,
            overdue: overdueTasks.filter((task) => task.assignedTo === member.uid).length,
            completedThisWeek: completedTasksThisWeek.filter((task) => task.assignedTo === member.uid).length,
          },
          reportsSubmitted: memberReports.length,
          blockersReported: memberReports.filter((report) => Boolean(report.blockers.trim())).length,
          certificates: accessibleCertificates.filter((certificate) => certificate.userId === member.uid).length,
        };
      });
      const dashboardContext = {
        dataAsOf: new Date().toISOString(),
        localDate: today,
        weekStart,
        viewer: {
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          role: currentUser.role,
          accessScope: isAdmin ? 'all active team members' : 'only the signed-in employee',
        },
        visibleEmployees: accessibleMembers.map((member) => ({
          uid: member.uid,
          displayName: member.displayName,
          email: member.email,
          role: member.role,
          capabilities: member.capabilities,
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
        })),
        employeeProgress,
        taskTotals: {
          total: activeTasks.length,
          todo: activeTasks.filter((task) => task.status === 'todo').length,
          inProgress: activeTasks.filter((task) => task.status === 'in_progress').length,
          done: activeTasks.filter((task) => task.status === 'done').length,
          overdue: overdueTasks.length,
          updatedToday: activeTasks.filter((task) => indiaDate(task.updatedAt) === today).length,
          updatedThisWeek: weekTasks.length,
          completedThisWeek: completedTasksThisWeek.length,
        },
        overdueTasks,
        dueSoonTasks,
        completedTasksThisWeek,
        recentTasks: [...activeTasks]
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, 200),
        reportTotals: {
          available: activeReports.length,
          thisWeek: weekReports.length,
          withReportedBlockers: activeReports.filter((report) => Boolean(report.blockers.trim())).length,
        },
        recentReports: [...activeReports]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 180),
        recurringBlockers: [...blockerCounts.entries()]
          .map(([blocker, value]) => ({ blocker, ...value }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20),
        recentActivity: [...activityLogs]
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
          .slice(0, 100),
        historicalChanges: [...visibleHistory]
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
          .slice(0, 150),
        certificates: accessibleCertificates.map((certificate) => ({
          id: certificate.id,
          userId: certificate.userId,
          ownerName: certificate.ownerName,
          name: certificate.name,
          organization: certificate.organization,
          issueDate: certificate.issueDate,
          expiryDate: certificate.expiryDate,
          originalFileName: certificate.originalFileName,
          mimeType: certificate.mimeType,
          createdAt: certificate.createdAt,
          updatedAt: certificate.updatedAt,
        })),
        weeklySummaries: rows.weeklyReports
          .map(parseWeeklySummary)
          .filter((summary) => isAdmin || summary.updatedBy === currentUser.displayName),
      };
      const query = prompt.toLowerCase();
      const chatHistory = Array.isArray(req.body?.history)
        ? req.body.history.flatMap((entry: unknown) => {
            if (
              !entry ||
              typeof entry !== 'object' ||
              !('role' in entry) ||
              entry.role !== 'user' ||
              !('text' in entry) ||
              typeof entry.text !== 'string'
            ) return [];
            return [entry.text.slice(0, 4_000)];
          }).slice(-8)
        : [];
      const findMentionedMember = (text: string) =>
        accessibleMembers
          .filter((member) =>
            [member.displayName, member.email].some((identifier) => {
              const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              return new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, 'i').test(text);
            })
          )
          .sort((a, b) => b.displayName.length - a.displayName.length)[0];
      const personQuestion =
        /\b(task|tasks|assigned|workload|blocker|blockers|problem|problems|issue|issues|challenge|challenges|facing|working on|complete|finish)\b/i.test(prompt);
      const asksAboutBlockers =
        /\b(blocker|blockers|problem|problems|issue|issues|challenge|challenges|facing|complete|finish)\b/i.test(prompt);
      const directMember = personQuestion ? findMentionedMember(prompt) : undefined;
      const refersToPreviousMember =
        !directMember &&
        /\b(they|them|their|he|him|his|she|her)\b/i.test(prompt);
      const previousMember = refersToPreviousMember
        ? [...chatHistory].reverse().map(findMentionedMember).find(Boolean)
        : undefined;
      const requestedMember = isAdmin ? directMember || previousMember : undefined;
      const formatTask = (task: TaskItem) =>
        `• ${task.title} — ${task.assignedToName}; ${task.status.replace('_', ' ')}${task.dueDate ? `; due ${task.dueDate}` : ''}`;
      const formatReport = (report: DailyReport) =>
        `• ${report.userName} (${report.date}): ${report.whatIDid || 'No work summary entered'}${report.blockers.trim() ? ` — blocker reported: ${report.blockers.trim()}` : ''}`;
      const todaysActivity = visibleHistory
        .filter((event) => indiaDate(event.timestamp) === today)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const completedToday = visibleHistory
        .filter((event) => {
          if (event.action !== 'task_updated' || indiaDate(event.timestamp) !== today) return false;
          const before = event.context?.before as TaskItem | undefined;
          const after = event.context?.after as TaskItem | undefined;
          return after?.status === 'done' && before?.status !== 'done';
        })
        .map((event) => event.context?.after as TaskItem)
        .filter((task, index, tasksToday) =>
          task && tasksToday.findIndex((candidate) => candidate.id === task.id) === index
        );
      const isMeaningfulDashboardChange = (event: AssistantHistoryEvent) =>
        event.action !== 'user_login' && event.action !== 'assistant_interaction';
      const recentAdditionCutoff = new Date(
        Date.parse(`${today}T00:00:00.000Z`) - 6 * 86_400_000
      ).toISOString().slice(0, 10);
      const recentCertificateAdditions = accessibleCertificates
        .filter((certificate) => {
          const addedDate = indiaDate(certificate.createdAt);
          return addedDate >= recentAdditionCutoff && addedDate <= today;
        })
        .map((certificate) => ({
          timestamp: certificate.createdAt,
          text: `Certificate added: ${certificate.name} — ${certificate.organization} for ${certificate.ownerName} (${indiaDate(certificate.createdAt)})`,
        }));
      const recentOtherAdditions = visibleHistory
        .filter((event) =>
          ['task_created', 'member_added', 'report_submitted'].includes(event.action) &&
          indiaDate(event.timestamp) >= recentAdditionCutoff &&
          indiaDate(event.timestamp) <= today
        )
        .map((event) => ({
          timestamp: event.timestamp,
          text: `${event.details} (${indiaDate(event.timestamp)})`,
        }));
      const asksDashboardAdditions =
        /\b(?:new|add(?:ed|itions?)?|recent(?:ly)?)\b/i.test(query) &&
        /\b(?:dashboard|feature|features|add(?:ed|itions?)?)\b/i.test(query) &&
        !/\btoday\b/i.test(query);
      let reply = '';
      let createdTask: {
        title: string;
        description: string;
        assignedToName: string;
        priority: TaskPriority;
        dueDate: string;
      } | null = null;
      const taskIntent = prompt.match(
        /^\s*(?:please\s+)?(?:create|add|make)\s+(?:a\s+)?task(?:\s+for\s+([^:]+?))?\s*(?::|-|called|titled|named)\s*(.+)\s*$/i
      );
      if (taskIntent) {
        const requestedAssignee = taskIntent[1]?.trim();
        const requestedTitle = taskIntent[2].trim();
        if (!requestedTitle) {
          reply = 'Please include a title, for example: “Create task: Review pending applications”.';
        } else {
          const assignee = requestedAssignee && !isAdmin
            ? (requestedAssignee.toLowerCase() === currentUser.displayName.toLowerCase() ||
                requestedAssignee.toLowerCase() === currentUser.email.toLowerCase())
              ? currentUser
              : undefined
            : isAdmin && requestedAssignee
              ? teamMembers.find((member) =>
                  member.role === 'member' &&
                  (member.displayName.toLowerCase() === requestedAssignee.toLowerCase() ||
                    member.email.toLowerCase() === requestedAssignee.toLowerCase())
                )
              : currentUser;
          if (!assignee) {
            reply = isAdmin
              ? 'I could not find that active employee by exact name or email. Please check the team roster and try again.'
              : 'You can only create tasks assigned to yourself.';
          } else {
            const requestedDate = prompt.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
            const dueDate = requestedDate ||
              (/\btomorrow\b/i.test(prompt)
                ? new Date(Date.parse(`${today}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10)
                : today);
            const priority: TaskPriority = /\b(high|urgent)\b/i.test(prompt)
              ? 'high'
              : /\blow\b/i.test(prompt)
                ? 'low'
                : 'medium';
            const title = requestedTitle
              .replace(/\s+(?:due|by)\s+(?:20\d{2}-\d{2}-\d{2}|tomorrow)\b.*$/i, '')
              .replace(/\s+(?:high|medium|low|urgent)\s+priority\b.*$/i, '')
              .trim();
            if (!title) {
              reply = 'Please include a task title, for example: “Create task: Review pending applications”.';
            } else {
              createdTask = {
                title,
                description: 'Created via Team 2 AI Assistant',
                assignedToName: assignee.displayName,
                priority,
                dueDate,
              };
              reply = `I’m adding “${title}” for ${assignee.displayName}, due ${dueDate}.`;
            }
          }
        }
      } else if (/\b(create|add|make)\b.*\btask\b/i.test(prompt)) {
        reply = 'I can add a task when you provide a title. Use “Create task: [title]” or, as an admin, “Create task for [employee name]: [title]”.';
      } else if (asksDashboardAdditions) {
        const additions = [...recentCertificateAdditions, ...recentOtherAdditions]
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
          .slice(0, 10);
        reply = additions.length
          ? `Recently added to the dashboard:\n${additions.map((addition) => `• ${addition.text}`).join('\n')}`
          : 'No recent dashboard additions were recorded in the last 7 days.';
      } else if (requestedMember && personQuestion) {
        const asksAboutMemberTasks =
          /\b(task|tasks|assigned|workload|working on)\b/i.test(prompt);
        const memberAnswer: string[] = [];
        if (asksAboutMemberTasks) {
          const memberTasks = activeTasks
            .filter((task) => task.assignedTo === requestedMember.uid)
            .sort((a, b) =>
              (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) ||
              a.dueDate.localeCompare(b.dueDate)
            );
          memberAnswer.push(
            memberTasks.length
              ? `Tasks assigned to ${requestedMember.displayName} (${memberTasks.length}):\n${memberTasks.slice(0, 20).map(formatTask).join('\n')}`
              : `No tasks are currently assigned to ${requestedMember.displayName}.`
          );
        }
        if (asksAboutBlockers) {
          const memberBlockers = [...reportHistory.values()]
            .filter((report) =>
              report.userId === requestedMember.uid &&
              report.blockers.trim() &&
              !/^(none|no blockers?|n\/a|na|nil|no issues?)\.?$/i.test(report.blockers.trim())
            )
            .sort((a, b) => b.date.localeCompare(a.date));
          memberAnswer.push(memberBlockers.length
            ? `Reported problems for ${requestedMember.displayName}:\n${memberBlockers.slice(0, 8).map((report) => `• ${report.date}: ${report.blockers.trim()}`).join('\n')}`
            : `No blockers are recorded in the available daily reports for ${requestedMember.displayName}.`);
        }
        reply = memberAnswer.join('\n\n');
      } else if (/\b(blocker|blockers|problem|problems|issue|issues|challenge|challenges)\b/i.test(query)) {
        const blockerReports = [...activeReports]
          .filter((report) =>
            report.blockers.trim() &&
            !/^(none|no blockers?|n\/a|na|nil|no issues?)\.?$/i.test(report.blockers.trim())
          )
          .sort((a, b) => b.date.localeCompare(a.date));
        const grouped = [...blockerCounts.entries()]
          .sort((a, b) => b[1].count - a[1].count);
        const lines = blockerReports.slice(0, 10).map(
          (report) => `• ${report.userName} (${report.date}): ${report.blockers.trim()}`
        );
        const recurring = grouped.filter(([, value]) => value.count > 1).slice(0, 5);
        const recurringLines = recurring.map(
          ([blocker, value]) => `• Reported ${value.count} times: ${blocker}`
        );
        reply = `Reported blockers in the available reports (${activeReports.length} reports checked):\n${lines.length ? lines.join('\n') : '• No blockers are recorded in the available reports.'}${recurringLines.length ? `\n\nRepeated reports:\n${recurringLines.join('\n')}` : ''}\n\nA report records that a blocker was raised; it does not confirm whether it is still unresolved. Data checked ${today}.`;
      } else if (/\b(overdue|late|delayed|delay|past due)\b/i.test(query)) {
        reply = `Overdue open tasks as of ${today} (${overdueTasks.length}):\n${overdueTasks.length ? overdueTasks.slice(0, 15).map(formatTask).join('\n') : '• No open tasks are past their due date.'}`;
      } else if (/\b(due soon|due next|coming due)\b/i.test(query)) {
        reply = `Open tasks due within the next 7 days (${dueSoonTasks.length}):\n${dueSoonTasks.length ? dueSoonTasks.slice(0, 15).map(formatTask).join('\n') : '• No open tasks are due in the next 7 days.'}`;
      } else if (/\b(certificate|certificates|qualification|qualifications)\b/i.test(query)) {
        reply = `Certificates currently on file (${accessibleCertificates.length}):\n${accessibleCertificates.length ? accessibleCertificates.slice(0, 30).map((certificate) => `• ${certificate.ownerName}: ${certificate.name} — ${certificate.organization}${certificate.expiryDate ? `; expires ${certificate.expiryDate}` : ''}`).join('\n') : '• No certificates are on file.'}`;
      } else if (/\b(skill|skills|capabilit|specialist|specializ)\b/i.test(query)) {
        reply = `Team skills and task progress${isAdmin ? '' : ' (your profile)'}:\n${employeeProgress.length ? employeeProgress.map((member) => `• ${member.name}: ${member.skills.length ? member.skills.join(', ') : 'No skills listed'}; ${member.tasks.completed} completed, ${member.tasks.inProgress} in progress, ${member.tasks.todo} to do, ${member.tasks.overdue} overdue.`).join('\n') : '• No profile data is available.'}`;
      } else if (/\b(complete|completed|finish|finished|done)\b/i.test(query)) {
        const completedTasks = /\b(today|new today)\b/i.test(query)
          ? completedToday
          : completedTasksThisWeek;
        const period = completedTasks === completedToday ? `today (${today})` : `this week (${weekStart} to ${today})`;
        const reports = activeReports.filter((report) =>
          completedTasks === completedToday ? report.date === today : report.date >= weekStart && report.date <= today
        );
        reply = `Tasks changed from open to done ${period} (${completedTasks.length}):\n${completedTasks.length ? completedTasks.slice(0, 15).map(formatTask).join('\n') : '• No task completion transitions are recorded for this period.'}${reports.length ? `\n\nWork described in daily reports:\n${reports.slice(0, 10).map(formatReport).join('\n')}` : ''}`;
      } else if (/\b(week|weekly|changed|change|history|historical|progress|summary|summarize)\b/i.test(query)) {
        const weekChanges = visibleHistory
          .filter(
            (event) =>
              isMeaningfulDashboardChange(event) &&
              indiaDate(event.timestamp) >= weekStart &&
              indiaDate(event.timestamp) <= today
          )
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        const weekReportList = activeReports.filter((report) => report.date >= weekStart && report.date <= today);
        const changes = weekChanges.slice(0, 12).map(
          (event) => `• ${event.userName}: ${event.details} (${indiaDate(event.timestamp)})`
        );
        reply = `Dashboard summary for ${weekStart} to ${today} (latest data checked now):\n• Tasks changed: ${weekTasks.length}; marked done: ${completedTasksThisWeek.length}; overdue now: ${overdueTasks.length}.\n• Daily reports in this period: ${weekReportList.length}; reports containing blockers: ${weekReportList.filter((report) => Boolean(report.blockers.trim())).length}.\n${changes.length ? `Recent recorded changes:\n${changes.join('\n')}` : 'No dashboard activity is recorded for this week.'}`;
      } else if (/\b(new|today|happening|happened)\b/i.test(query)) {
        const activity = todaysActivity.filter(isMeaningfulDashboardChange).slice(0, 8).map(
          (event) => `• ${event.userName}: ${event.details}`
        );
        reply = activity.length
          ? `What’s new today:\n${activity.join('\n')}`
          : 'No new dashboard updates were recorded today.';
      } else if (/\b(task|tasks|pending|assigned|workload)\b/i.test(query)) {
        reply = `Your task snapshot as of ${today}:\n• To do: ${activeTasks.filter((task) => task.status === 'todo').length}; in progress: ${activeTasks.filter((task) => task.status === 'in_progress').length}; done: ${activeTasks.filter((task) => task.status === 'done').length}; overdue: ${overdueTasks.length}.\n${activeTasks.length ? activeTasks.slice(0, 15).map(formatTask).join('\n') : '• No tasks are currently assigned within your access scope.'}`;
      } else if (/\b(report|reports|work|worked)\b/i.test(query)) {
        reply = `Daily reports available within your access scope (${activeReports.length}):\n${activeReports.length ? [...activeReports].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map(formatReport).join('\n') : '• No daily reports are available.'}`;
      } else {
        reply = `I’m connected to the latest dashboard data (checked ${today}). I can summarize today’s activity, task status and overdue work, daily reports, reported blockers, weekly changes, team skills and progress, and certificates. Ask a specific question to see the matching records.`;
      }

      await archiveAssistantActivity({
        userId: currentUser.uid,
        userName: currentUser.displayName,
        action: 'assistant_interaction',
        details: `Asked the dashboard assistant: ${prompt.slice(0, 500)}`,
        timestamp: new Date().toISOString(),
        context: {
          question: prompt,
          answer: reply.slice(0, 10_000),
        },
      });
      res.json({
        reply,
        createdTask,
      });
    })
  );
}

type SheetRecord = Record<string, string>;
