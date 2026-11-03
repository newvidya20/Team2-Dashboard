import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';
import type { SendMailOptions, Transporter } from 'nodemailer';
import { getAssistantHistory } from './assistant-history';
import { getDailyReportHistory } from './daily-report-history';
import { getTaskHistory } from './task-history';
import { listRowsMany, upsertRow } from './sheets';
import type { AssistantHistoryEvent } from './assistant-history';
import type { TaskHistoryEvent } from './task-history';
import type { DailyReportHistoryEntry } from './daily-report-history';
import type { DailyReport, TaskItem } from '../src/types';

interface NotificationState {
  sentEventIds: string[];
  sentSummaryDates: string[];
  sentReportKeys: string[];
}

interface MailConfiguration {
  transporter: Transporter;
  from: string;
}

const STATE_KEY = 'taskEmailState';
const statePath = path.resolve(process.cwd(), 'data', 'task-email-state.json');
const supportedActions = new Set([
  'task_created',
  'task_updated',
  'task_deleted',
  'report_submitted',
  'report_updated',
]);
let workQueue: Promise<void> = Promise.resolve();
let schedulerStarted = false;
let mailConfiguration: MailConfiguration | null | undefined;
const loggedFailures = new Set<string>();
const warnedConditions = new Set<string>();

function logFailure(key: string, message: string, error?: unknown): void {
  if (loggedFailures.has(key)) return;
  loggedFailures.add(key);
  console.error(message, error ?? '');
}

function clearFailure(key: string): void {
  loggedFailures.delete(key);
}

function getMailConfiguration(): MailConfiguration | null {
  if (mailConfiguration !== undefined) return mailConfiguration;

  const host = process.env.SMTP_HOST?.trim();
  const portValue = process.env.SMTP_PORT?.trim();
  const port = portValue ? Number(portValue) : 587;
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = (process.env.SMTP_FROM || user || '').trim();
  const secureValue = process.env.SMTP_SECURE?.trim().toLowerCase();

  if (!host && !portValue && !user && !password && !process.env.SMTP_FROM) {
    if (!warnedConditions.has('smtp-unconfigured')) {
      warnedConditions.add('smtp-unconfigured');
      console.warn('Task email notifications are disabled: configure SMTP_HOST, SMTP_FROM, and SMTP credentials.');
    }
    mailConfiguration = null;
    return mailConfiguration;
  }
  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !from ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from) ||
    ((user || password) && (!user || !password)) ||
    (secureValue && secureValue !== 'true' && secureValue !== 'false')
  ) {
    logFailure('smtp-configuration', 'Task email notifications are disabled: SMTP configuration is invalid.');
    mailConfiguration = null;
    return mailConfiguration;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: secureValue ? secureValue === 'true' : port === 465,
    ...(user && password ? { auth: { user, pass: password } } : {}),
  });
  mailConfiguration = { transporter, from };
  clearFailure('smtp-configuration');
  return mailConfiguration;
}

function createDefaultNotificationState(): NotificationState {
  return { sentEventIds: [], sentSummaryDates: [], sentReportKeys: [] };
}

function normalizeNotificationState(raw: unknown): NotificationState | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;

  if (
    !('sentEventIds' in record) ||
    !Array.isArray(record.sentEventIds) ||
    record.sentEventIds.some((id) => typeof id !== 'string') ||
    !('sentSummaryDates' in record) ||
    !Array.isArray(record.sentSummaryDates) ||
    record.sentSummaryDates.some((date) => typeof date !== 'string') ||
    ('sentReportKeys' in record &&
      (!Array.isArray(record.sentReportKeys) || record.sentReportKeys.some((key) => typeof key !== 'string')))
  ) {
    return null;
  }

  return {
    sentEventIds: [...record.sentEventIds as string[]],
    sentSummaryDates: [...record.sentSummaryDates as string[]],
    sentReportKeys: 'sentReportKeys' in record ? [...record.sentReportKeys as string[]] : [],
  };
}

async function readStateFromLocalFile(): Promise<NotificationState | null> {
  let contents: string;
  try {
    contents = await readFile(statePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  const parsed: unknown = JSON.parse(contents);
  const normalized = normalizeNotificationState(parsed);
  if (!normalized) {
    throw new Error('Task email state file is invalid. Restore data/task-email-state.json from a valid backup.');
  }
  return normalized;
}

async function readStateFromSettings(): Promise<NotificationState | null> {
  const rows = await listRowsMany(['settings']);
  const settings = rows.settings ?? [];
  const row = settings.find((entry) => entry.key === STATE_KEY)
    ?? settings.find((entry) => entry.key === 'task-email-state');
  if (!row || typeof row.value !== 'string' || row.value.trim() === '') return null;

  const parsed: unknown = JSON.parse(row.value);
  const normalized = normalizeNotificationState(parsed);
  if (!normalized) {
    throw new Error('Task email state in Google Sheets is invalid. Restore or reset the taskEmailState setting.');
  }
  return normalized;
}

async function readState(): Promise<NotificationState> {
  if (process.env.DATA_STORE === 'apps-script') {
    const state = await readStateFromSettings().catch((error) => {
      throw error;
    });
    return state ?? createDefaultNotificationState();
  }

  return (await readStateFromLocalFile()) ?? createDefaultNotificationState();
}

async function writeStateToLocalFile(state: NotificationState): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  try {
    await rename(temporaryPath, statePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function writeState(state: NotificationState): Promise<void> {
  if (process.env.DATA_STORE === 'apps-script') {
    await upsertRow('settings', STATE_KEY, 'key', { key: STATE_KEY, value: JSON.stringify(state) });
    return;
  }
  await writeStateToLocalFile(state);
}

async function initializeNotificationState(): Promise<void> {
  const existingState = await readStateFromSettings().catch(() => null);
  if (process.env.DATA_STORE === 'apps-script') {
    if (existingState) return;
  } else {
    try {
      await readFile(statePath, 'utf8');
      await readState();
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  const [taskHistory, reportHistory, assistantHistory] = await Promise.all([
    getTaskHistory(),
    getDailyReportHistory(),
    getAssistantHistory(),
  ]);
  const sentEventIds = [
    ...taskHistory.map((event) => event.id),
    ...reportHistory.map((event) => event.id),
    ...assistantHistory
      .filter((event) => event.action === 'report_submitted' || event.action === 'report_updated')
      .map((event) => event.id),
  ];
  await writeState({
    sentEventIds: [...new Set(sentEventIds)],
    sentSummaryDates: [],
    sentReportKeys: [],
  });
}

function getTimeZone(): string {
  const timeZone = process.env.TASK_EMAIL_TIMEZONE || process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
  new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
  return timeZone;
}

function getDateInTimeZone(value: string | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function getHourInTimeZone(value: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value).find((part) => part.type === 'hour')?.value;
  return Number(hour);
}

function getDailySummaryHour(): number {
  const value = process.env.TASK_DAILY_SUMMARY_HOUR;
  const hour = value === undefined ? 18 : Number(value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error('TASK_DAILY_SUMMARY_HOUR must be an integer between 0 and 23.');
  }
  return hour;
}

function getRecipients(settings: Record<string, string>, approvedUsers: Array<Record<string, string>>): string[] {
  const configuredRecipient = settings.reportRecipientEmail?.trim().toLowerCase();
  const environmentRecipient = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (environmentRecipient) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(environmentRecipient)) {
      throw new Error('ADMIN_EMAIL is invalid. Configure a valid Admin recipient address.');
    }
    return [environmentRecipient];
  }
  if (configuredRecipient) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredRecipient)) {
      throw new Error('The configured Admin report recipient email is invalid. Update it in dashboard settings.');
    }
    return [configuredRecipient];
  }
  return [...new Set(
    approvedUsers
      .filter((user) => user.active === 'true' && user.role === 'admin')
      .map((user) => user.email.trim().toLowerCase())
      .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  )];
}

async function sendMail(
  subject: string,
  text: string,
  messageId: string,
  html?: string
): Promise<void> {
  const configuration = getMailConfiguration();
  if (!configuration) return;
  const records = await listRowsMany(['settings', 'approvedUsers']);
  const settings = Object.fromEntries(records.settings.map((row) => [row.key, row.value]));
  const recipients = getRecipients(settings, records.approvedUsers);
  if (!recipients.length) {
    throw new Error('No Admin email is configured. Set the report recipient in dashboard settings or activate an Admin account.');
  }
  const options: SendMailOptions = {
    from: configuration.from,
    to: recipients,
    subject,
    text,
    ...(html ? { html } : {}),
    messageId: `<${messageId}@team-dashboard.local>`,
  };
  await configuration.transporter.sendMail(options);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatReportDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) return date;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(value);
}

function formatReportTimestamp(timestamp: string): string {
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) return timestamp;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: getTimeZone(),
  }).format(value);
}

function buildReportEmailHtml(report: DailyReport, event: AssistantHistoryEvent): string {
  const action = event.action === 'report_updated' ? 'Report updated' : 'Report submitted';
  const employeeName = escapeHtml(report.userName || event.userName);
  const role = escapeHtml(event.role || 'Team member');
  const userId = escapeHtml(event.userId);
  const reportDate = escapeHtml(formatReportDate(report.date));
  const timestamp = escapeHtml(formatReportTimestamp(event.timestamp));
  const progress = escapeHtml(report.whatIDid?.trim() || 'No progress details provided.').replace(/\n/g, '<br>');
  const blockers = escapeHtml(report.blockers?.trim() || 'No blockers reported.').replace(/\n/g, '<br>');
  const plan = escapeHtml(report.planTomorrow?.trim() || 'No plan provided.').replace(/\n/g, '<br>');
  const section = (title: string, content: string, accent: string): string => `
    <tr>
      <td style="padding:0 32px 18px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5eaf1;border-radius:8px;">
          <tr>
            <td style="padding:16px 18px;border-left:4px solid ${accent};">
              <h2 style="margin:0 0 8px;color:#172b4d;font-family:Arial,sans-serif;font-size:15px;line-height:22px;">${title}</h2>
              <div style="color:#42526e;font-family:Arial,sans-serif;font-size:14px;line-height:22px;white-space:normal;">${content}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:24px 12px;background:#f3f5f9;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${action} from ${employeeName} for ${reportDate}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5eaf1;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:24px 32px;background:#17365d;">
          <p style="margin:0 0 8px;color:#b9d5f4;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;">Team Dashboard</p>
          <h1 style="margin:0;color:#ffffff;font-family:Arial,sans-serif;font-size:23px;line-height:30px;">Daily Progress Report</h1>
          <p style="margin:8px 0 0;color:#d9e6f5;font-family:Arial,sans-serif;font-size:14px;">${reportDate}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 20px;">
          <span style="display:inline-block;padding:6px 10px;border-radius:20px;background:#e8f2ff;color:#175ea8;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;">${action}</span>
          <h2 style="margin:16px 0 4px;color:#172b4d;font-family:Arial,sans-serif;font-size:20px;line-height:26px;">${employeeName}</h2>
          <p style="margin:0;color:#62718a;font-family:Arial,sans-serif;font-size:13px;line-height:20px;">${role} &nbsp;&bull;&nbsp; User ID: ${userId}</p>
          <p style="margin:12px 0 0;color:#62718a;font-family:Arial,sans-serif;font-size:13px;line-height:20px;">Received ${timestamp}</p>
        </td>
      </tr>
      ${section('Work completed', progress, '#2e7d32')}
      ${section('Blockers and challenges', blockers, '#d97706')}
      ${section("Plan for tomorrow", plan, '#2563eb')}
      <tr>
        <td style="padding:4px 32px 24px;">
          <p style="margin:0;border-top:1px solid #e5eaf1;padding-top:16px;color:#8995a8;font-family:Arial,sans-serif;font-size:12px;line-height:18px;">This is an automated notification from Team Dashboard.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildTaskEmailHtml(
  task: TaskItem,
  event: AssistantHistoryEvent,
  action: string,
  changes: string
): string {
  const assignee = escapeHtml(task.assignedToName || 'Unassigned');
  const title = escapeHtml(task.title);
  const taskId = escapeHtml(task.id);
  const actor = escapeHtml(event.userName || 'Team member');
  const role = escapeHtml(event.role || 'Team member');
  const userId = escapeHtml(event.userId);
  const actionLabel = escapeHtml(action);
  const timestamp = escapeHtml(formatReportTimestamp(event.timestamp));
  const description = escapeHtml(task.description?.trim() || 'No description provided.').replace(/\n/g, '<br>');
  const status = escapeHtml((task.status || 'unknown').replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()));
  const priority = escapeHtml(task.priority || 'Not specified');
  const dueDate = escapeHtml(task.dueDate ? formatReportDate(task.dueDate) : 'Not specified');
  const section = (heading: string, content: string, accent: string): string => `
    <tr>
      <td style="padding:0 32px 18px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5eaf1;border-radius:8px;">
          <tr>
            <td style="padding:16px 18px;border-left:4px solid ${accent};">
              <h2 style="margin:0 0 8px;color:#172b4d;font-family:Arial,sans-serif;font-size:15px;line-height:22px;">${heading}</h2>
              <div style="color:#42526e;font-family:Arial,sans-serif;font-size:14px;line-height:22px;">${content}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
  const metadataRow = (label: string, value: string): string => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e5eaf1;color:#62718a;font-family:Arial,sans-serif;font-size:13px;">${label}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5eaf1;color:#172b4d;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;text-align:right;">${value}</td>
    </tr>`;
  const changesContent = escapeHtml(changes).replace(/\n/g, '<br>');
  const detailsContent = escapeHtml(event.details || action);

  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:24px 12px;background:#f3f5f9;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${actionLabel}: ${title}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5eaf1;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:24px 32px;background:#17365d;">
          <p style="margin:0 0 8px;color:#b9d5f4;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;">Team Dashboard</p>
          <h1 style="margin:0;color:#ffffff;font-family:Arial,sans-serif;font-size:23px;line-height:30px;">Task Activity</h1>
          <p style="margin:8px 0 0;color:#d9e6f5;font-family:Arial,sans-serif;font-size:14px;">${title}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 20px;">
          <span style="display:inline-block;padding:6px 10px;border-radius:20px;background:#e8f2ff;color:#175ea8;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;">${actionLabel}</span>
          <h2 style="margin:16px 0 4px;color:#172b4d;font-family:Arial,sans-serif;font-size:20px;line-height:26px;">${assignee}</h2>
          <p style="margin:0;color:#62718a;font-family:Arial,sans-serif;font-size:13px;line-height:20px;">Assigned task &nbsp;&bull;&nbsp; Task ID: ${taskId}</p>
          <p style="margin:12px 0 0;color:#62718a;font-family:Arial,sans-serif;font-size:13px;line-height:20px;">Updated by ${actor} (${role}) &nbsp;&bull;&nbsp; ${timestamp}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5eaf1;border-radius:8px;">
            ${metadataRow('Status', status)}
            ${metadataRow('Priority', priority)}
            ${metadataRow('Due date', dueDate)}
            ${metadataRow('User ID', userId)}
          </table>
        </td>
      </tr>
      ${section('Task description', description, '#2563eb')}
      ${changes ? section('Changes', changesContent, '#d97706') : ''}
      ${section('Activity details', detailsContent, '#2e7d32')}
      <tr>
        <td style="padding:4px 32px 24px;">
          <p style="margin:0;border-top:1px solid #e5eaf1;padding-top:16px;color:#8995a8;font-family:Arial,sans-serif;font-size:12px;line-height:18px;">This is an automated notification from Team Dashboard.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function isTaskItem(value: unknown): value is TaskItem {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'id' in value &&
    typeof value.id === 'string' &&
    'title' in value &&
    typeof value.title === 'string'
  );
}

function taskFromEvent(event: AssistantHistoryEvent): TaskItem | undefined {
  if (event.action === 'task_updated') {
    if (isTaskItem(event.context?.after)) return event.context.after;
    if (isTaskItem(event.context?.before)) return event.context.before;
  }
  const value = event.context?.task;
  if (isTaskItem(value)) return value;
  if (isTaskItem(event.context?.after)) return event.context.after;
  if (isTaskItem(event.context?.before)) return event.context.before;
  return undefined;
}

function formatTaskChanges(event: AssistantHistoryEvent): string {
  const before = event.context?.before;
  const after = event.context?.after;
  if (!isTaskItem(before) || !isTaskItem(after)) return '';
  const fields: Array<[keyof TaskItem, string]> = [
    ['title', 'Title'],
    ['description', 'Description'],
    ['assignedToName', 'Assignee'],
    ['status', 'Status'],
    ['priority', 'Priority'],
    ['dueDate', 'Due date'],
  ];
  const changes = fields
    .filter(([field]) => before[field] !== after[field])
    .map(([field, label]) => `${label}: "${String(before[field] || '—')}" → "${String(after[field] || '—')}"`);
  return changes.length ? `Previous and updated values:\n${changes.join('\n')}` : 'No task field values changed.';
}

function formatReport(value: unknown): DailyReport | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    !('userId' in value) ||
    typeof value.userId !== 'string' ||
    !('date' in value) ||
    typeof value.date !== 'string'
  ) return undefined;
  return value as DailyReport;
}

function buildEventEmail(event: AssistantHistoryEvent): { subject: string; text: string; html?: string } | undefined {
  const task = taskFromEvent(event);
  const report = formatReport(event.context?.report);
  if (report) {
    const text = [
      `Employee: ${report.userName || event.userName}`,
      `Submitted by: ${event.userName} (${event.role || 'unknown'}; user ID ${event.userId})`,
      `Activity: ${event.action === 'report_updated' ? 'Daily progress report updated' : 'Daily progress report submitted'}`,
      `Report date: ${report.date}`,
      `Date/time recorded: ${event.timestamp}`,
      `Progress: ${report.whatIDid || 'No progress details provided.'}`,
      `Reported problem: ${report.blockers || 'None reported.'}`,
      `Plan: ${report.planTomorrow || 'Not provided.'}`,
    ].join('\n');
    return {
      subject: `[Team Dashboard] ${event.action === 'report_updated' ? 'Progress report updated' : 'Daily progress report'}: ${report.userName || event.userName}`,
      text,
      html: buildReportEmailHtml(report, event),
    };
  }
  if (!task) return undefined;
  const action = event.action === 'task_created'
    ? 'New task created'
    : event.action === 'task_deleted'
      ? 'Task deleted'
      : isTaskItem(event.context?.before) && task.status === 'done' && event.context?.before.status !== 'done'
        ? 'Task completed'
        : 'Task updated';
  const creator = task.assignedToName || event.userName;
  const before = event.context?.before;
  const text = [
    `Employee: ${creator}`,
    `Performed by: ${event.userName} (${event.role || 'unknown'}; user ID ${event.userId})`,
    `Task ID: ${task.id}`,
    `Task: ${task.title}`,
    `Description: ${task.description || 'No description provided.'}`,
    `Action: ${action}`,
    `Status: ${task.status || 'unknown'}`,
    `Priority: ${task.priority || 'unknown'}`,
    `Date/time: ${event.timestamp}`,
    ...(before && isTaskItem(before) ? [formatTaskChanges(event)] : []),
    `Details: ${event.details}`,
  ].filter(Boolean).join('\n');
  const changes = before && isTaskItem(before) ? formatTaskChanges(event) : '';
  return {
    subject: `[Team Dashboard] ${action}: ${task.title}`,
    text,
    html: buildTaskEmailHtml(task, event, action, changes),
  };
}

async function sendEventNotification(event: AssistantHistoryEvent): Promise<void> {
  if (!supportedActions.has(event.action)) return;
  const email = buildEventEmail(event);
  if (!email) {
    throw new Error(`Task activity ${event.id} did not contain a valid task or report.`);
  }
  const state = await readState();
  const report = formatReport(event.context?.report);
  const reportKey = report ? `${report.userId}:${report.date}` : undefined;
  if (state.sentEventIds.includes(event.id)) {
    if (reportKey && !state.sentReportKeys.includes(reportKey)) {
      state.sentReportKeys.push(reportKey);
      await writeState(state);
    }
    return;
  }
  if (reportKey && state.sentReportKeys.includes(reportKey)) {
    state.sentEventIds.push(event.id);
    await writeState(state);
    return;
  }
  const configuration = getMailConfiguration();
  if (!configuration) return;

  const failureKey = `event:${event.id}`;
  try {
    const messageId = reportKey
      ? `daily-report-${createHash('sha256').update(reportKey).digest('hex')}`
      : `task-event-${event.id}`;
    await sendMail(email.subject, email.text, messageId, email.html);
    state.sentEventIds.push(event.id);
    if (reportKey) state.sentReportKeys.push(reportKey);
    await writeState(state);
    clearFailure(failureKey);
  } catch (error) {
    logFailure(failureKey, `Could not send Admin notification for dashboard activity ${event.id}:`, error);
  }
}

function formatTask(task: TaskItem): string {
  return `- ${task.title} | ${task.assignedToName || 'Unassigned'} | ${task.status.toUpperCase()} | Due: ${task.dueDate || 'not set'}${task.description ? `\n  ${task.description}` : ''}`;
}

function toAssistantEvent(event: TaskHistoryEvent): AssistantHistoryEvent {
  const task = event.after || event.before;
  const details = event.action === 'task_created'
    ? `Created task "${task?.title || event.taskId}"`
    : event.action === 'task_deleted'
      ? `Deleted task "${task?.title || event.taskId}"`
      : `Updated task "${task?.title || event.taskId}"`;
  return {
    id: event.id,
    userId: event.userId,
    userName: event.userName,
    role: event.role,
    action: event.action,
    details,
    timestamp: event.timestamp,
    context: {
      before: event.before,
      after: event.after,
      taskId: event.taskId,
    },
  };
}

function toReportAssistantEvent(entry: DailyReportHistoryEntry): AssistantHistoryEvent {
  const action = entry.before ? 'report_updated' : 'report_submitted';
  return {
    id: entry.id,
    userId: entry.userId,
    userName: entry.userName,
    role: entry.role,
    action,
    details: `${entry.before ? 'Updated' : 'Submitted'} daily report for ${entry.reportDate}`,
    timestamp: entry.timestamp,
    context: {
      report: entry.after,
      before: entry.before,
      after: entry.after,
    },
  };
}

async function sendDailySummary(date: string, timeZone: string): Promise<void> {
  const state = await readState();
  if (state.sentSummaryDates.includes(date)) return;
  const configuration = getMailConfiguration();
  if (!configuration) return;

  const records = await listRowsMany(['tasks', 'dailyReports', 'users', 'approvedUsers']);
  const [taskHistory, reportHistory] = await Promise.all([getTaskHistory(), getDailyReportHistory()]);
  const events = taskHistory
    .filter((event) => getDateInTimeZone(event.timestamp, timeZone) === date)
    .map(toAssistantEvent);
  const tasks = records.tasks as unknown as TaskItem[];
  const reports = records.dailyReports as unknown as DailyReport[];
  const approvalsByEmail = new Map(
    records.approvedUsers
      .filter((approval) => approval.active === 'true')
      .map((approval) => [approval.email.trim().toLowerCase(), approval])
  );
  const employees = records.users
    .filter((user) => user.active === 'true' && user.uid && user.email)
    .flatMap((user) => {
      const approval = approvalsByEmail.get(user.email.trim().toLowerCase());
      return approval ? [{ id: user.uid, name: approval.displayName, role: approval.role }] : [];
    });
  const created = events.filter((event) => event.action === 'task_created').map(taskFromEvent).filter((task): task is TaskItem => Boolean(task));
  const updatedEvents = events.filter((event) => event.action === 'task_updated' || event.action === 'task_deleted');
  const updated = updatedEvents.map(taskFromEvent).filter((task): task is TaskItem => Boolean(task));
  const completedById = new Map(events
    .filter((event) => {
      if (event.action !== 'task_updated') return false;
      const before = event.context?.before;
      const after = event.context?.after;
      return isTaskItem(before) && isTaskItem(after) && before.status !== 'done' && after.status === 'done';
    })
    .map(taskFromEvent)
    .filter((task): task is TaskItem => Boolean(task))
    .map((task) => [task.id, task]));
  const completed = [...completedById.values()];
  const pending = tasks.filter((task) => task.status !== 'done');
  const todayReports = reports.filter((report) => report.date === date);
  const problems = todayReports.filter((report) => report.blockers?.trim());
  const employeeIds = new Set([
    ...employees.map((employee) => employee.id),
    ...todayReports.map((report) => report.userId),
    ...created.map((task) => task.assignedTo),
    ...updated.map((task) => task.assignedTo),
  ]);
  const employeeProgress = [...employeeIds].map((employeeId) => {
    const report = todayReports.find((item) => item.userId === employeeId);
    const employeeName = employees.find((employee) => employee.id === employeeId)?.name ||
      report?.userName ||
      created.find((task) => task.assignedTo === employeeId)?.assignedToName ||
      updated.find((task) => task.assignedTo === employeeId)?.assignedToName ||
      'Team member';
    const employeeTasks = tasks.filter((task) => task.assignedTo === employeeId);
    return [
      `${employeeName} (${employees.find((employee) => employee.id === employeeId)?.role || 'member'}; user ID ${employeeId}):`,
      `  Reported progress: ${report?.whatIDid?.trim() || 'No daily report submitted.'}`,
      `  Completed today: ${completed.filter((task) => task.assignedTo === employeeId).map((task) => task.title).join(', ') || 'None'}`,
      `  In progress: ${employeeTasks.filter((task) => task.status === 'in_progress').map((task) => task.title).join(', ') || 'None'}`,
    ].join('\n');
  });
  const taskActions = events.map((event) => {
    const task = taskFromEvent(event);
    if (!task) return '';
    return `- ${event.timestamp} | ${event.userName} (${event.role}; user ID ${event.userId}) | ${event.action.replace('task_', '')} | task ${task.id}: ${task.title}${event.action === 'task_updated' ? `\n  ${formatTaskChanges(event)}` : ''}`;
  }).filter(Boolean);
  const reportActions = reportHistory
    .filter((entry) => getDateInTimeZone(entry.timestamp, timeZone) === date)
    .map((entry) => {
      const event = toReportAssistantEvent(entry);
      return `- ${entry.timestamp} | ${entry.userName} (${entry.role}; user ID ${entry.userId}) | ${event.details}`;
    });
  const section = (title: string, lines: string[]): string => `${title}\n${lines.length ? lines.join('\n') : '- None'}`;
  const text = [
    `Team task activity summary for ${date} (${timeZone})`,
    '',
    section('All user activities', [...taskActions, ...reportActions]),
    '',
    section('New tasks', created.map(formatTask)),
    '',
    section('Updated or deleted tasks', updatedEvents.flatMap((event) => {
      const task = taskFromEvent(event);
      return task ? [`${event.action === 'task_deleted' ? 'Deleted' : 'Updated'}: ${formatTask(task)}`] : [];
    })),
    '',
    section('Tasks completed today', completed.map(formatTask)),
    '',
    section('Current pending tasks', pending.map(formatTask)),
    '',
    section('Reported problems', problems.map((report) => `- ${report.userName}: ${report.blockers}`)),
    '',
    section('Employee-wise progress', employeeProgress),
  ].join('\n');
  try {
    await sendMail(`[Team Dashboard] Daily task summary: ${date}`, text, `task-daily-summary-${date}`);
    state.sentSummaryDates.push(date);
    state.sentSummaryDates = state.sentSummaryDates.slice(-365);
    await writeState(state);
    clearFailure(`summary:${date}`);
  } catch (error) {
    logFailure(`summary:${date}`, `Could not send the Admin daily task summary for ${date}:`, error);
  }
}

function enqueue(operation: () => Promise<void>): void {
  const result = workQueue.then(operation);
  workQueue = result.catch((error) => {
    console.error('Task email notification processing failed:', error);
  });
}

export function notifyTaskActivity(event: AssistantHistoryEvent): void {
  enqueue(() => sendEventNotification(event));
}

async function processPendingNotifications(): Promise<void> {
  const configuration = getMailConfiguration();
  if (!configuration) return;
  const timeZone = getTimeZone();
  const hour = getDailySummaryHour();
  const now = new Date();
  const today = getDateInTimeZone(now, timeZone);
  const [taskHistory, reportHistory, assistantHistory] = await Promise.all([
    getTaskHistory(),
    getDailyReportHistory(),
    getAssistantHistory(),
  ]);
  for (const event of taskHistory) {
    await sendEventNotification(toAssistantEvent(event));
  }
  for (const entry of reportHistory) {
    await sendEventNotification(toReportAssistantEvent(entry));
  }
  for (const event of assistantHistory) {
    if (event.action === 'report_submitted' || event.action === 'report_updated') {
      await sendEventNotification(event);
    }
  }
  if (getHourInTimeZone(now, timeZone) >= hour) {
    await sendDailySummary(today, timeZone);
  }
}

export function startTaskEmailNotifications(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  enqueue(async () => {
    await initializeNotificationState();
    await processPendingNotifications();
  });
  setInterval(() => enqueue(processPendingNotifications), 60_000).unref();
}
