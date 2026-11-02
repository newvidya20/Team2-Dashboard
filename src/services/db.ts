import {
  UserProfile,
  TaskItem,
  DailyReport,
  WeeklySummary,
  ActivityLog,
  AppSettings,
  ActionType,
  CalendarNote,
  CalendarLeave,
} from '../types';
import { apiRequest } from './api';

interface DashboardData {
  teamMembers: UserProfile[];
  tasks: TaskItem[];
  dailyReports: DailyReport[];
  activityLogs: ActivityLog[];
  calendarLeaves: CalendarLeave[];
  calendarNotes: CalendarNote[];
  weeklySummaries: WeeklySummary[];
}

async function getDashboardData(): Promise<DashboardData> {
  const data = await apiRequest<DashboardData>('/api/data');
  return {
    ...data,
    calendarLeaves: data.calendarLeaves || [],
    calendarNotes: data.calendarNotes || [],
    weeklySummaries: data.weeklySummaries || [],
  };
}

const dashboardSubscribers = new Set<(data: DashboardData) => void>();
let dashboardTimer: number | undefined;
let dashboardRefreshInProgress = false;

async function refreshDashboardData(): Promise<void> {
  if (dashboardRefreshInProgress || dashboardSubscribers.size === 0) return;
  dashboardRefreshInProgress = true;
  try {
    const data = await getDashboardData();
    dashboardSubscribers.forEach((subscriber) => subscriber(data));
  } catch (error) {
    console.error('Could not refresh dashboard data:', error);
  } finally {
    dashboardRefreshInProgress = false;
  }
}

function subscribeTo<T>(select: (data: DashboardData) => T, onData: (value: T) => void): () => void {
  const subscriber = (data: DashboardData) => onData(select(data));
  dashboardSubscribers.add(subscriber);
  if (dashboardSubscribers.size === 1) {
    void refreshDashboardData();
    dashboardTimer = window.setInterval(() => void refreshDashboardData(), 10_000);
  }
  return () => {
    dashboardSubscribers.delete(subscriber);
    if (dashboardSubscribers.size === 0 && dashboardTimer !== undefined) {
      window.clearInterval(dashboardTimer);
      dashboardTimer = undefined;
    }
  };
}

export async function logActivity(
  _user: { uid: string; displayName?: string; email?: string },
  action: ActionType,
  details: string
): Promise<void> {
  await apiRequest('/api/activity', {
    method: 'POST',
    body: JSON.stringify({ action, details }),
  });
}

export function subscribeToActivityLogs(onData: (logs: ActivityLog[]) => void): () => void {
  return subscribeTo((data) => data.activityLogs, onData);
}

export function subscribeToCalendarLeaves(onData: (leaves: CalendarLeave[]) => void): () => void {
  return subscribeTo((data) => data.calendarLeaves, onData);
}

export function subscribeToCalendarNotes(onData: (notes: CalendarNote[]) => void): () => void {
  return subscribeTo((data) => data.calendarNotes, onData);
}

export function subscribeToWeeklySummaries(onData: (summaries: WeeklySummary[]) => void): () => void {
  return subscribeTo((data) => data.weeklySummaries, onData);
}

export async function saveCalendarNote(
  note: Pick<CalendarNote, 'date' | 'title' | 'note'>,
  noteId?: string
): Promise<CalendarNote> {
  const saved = await apiRequest<CalendarNote>(
    noteId ? `/api/calendar/notes/${encodeURIComponent(noteId)}` : '/api/calendar/notes',
    {
      method: noteId ? 'PATCH' : 'POST',
      body: JSON.stringify(note),
    }
  );
  void refreshDashboardData();
  return saved;
}

export async function deleteCalendarNote(noteId: string): Promise<void> {
  await apiRequest(`/api/calendar/notes/${encodeURIComponent(noteId)}`, { method: 'DELETE' });
  void refreshDashboardData();
}

export async function saveCalendarLeave(
  leave: Pick<CalendarLeave, 'startDate' | 'endDate' | 'note' | 'userId'>,
  leaveId?: string
): Promise<CalendarLeave> {
  const saved = await apiRequest<CalendarLeave>(
    leaveId ? `/api/calendar/leaves/${encodeURIComponent(leaveId)}` : '/api/calendar/leaves',
    {
      method: leaveId ? 'PATCH' : 'POST',
      body: JSON.stringify(leave),
    }
  );
  void refreshDashboardData();
  return saved;
}

export async function deleteCalendarLeave(leaveId: string): Promise<void> {
  await apiRequest(`/api/calendar/leaves/${encodeURIComponent(leaveId)}`, { method: 'DELETE' });
  void refreshDashboardData();
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const data = await getDashboardData();
  return data.teamMembers.find((profile) => profile.uid === uid) || null;
}

export async function getUserProfiles(): Promise<UserProfile[]> {
  return (await getDashboardData()).teamMembers;
}

export async function registerUserProfile(profile: UserProfile): Promise<void> {
  await saveUserProfile(profile);
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await apiRequest<UserProfile>(`/api/members/${encodeURIComponent(profile.uid)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      displayName: profile.displayName,
      email: profile.email,
      role: profile.role,
      capabilities: profile.capabilities,
      photoURL: profile.photoURL || '',
      linkedInUrl: profile.linkedInUrl || '',
      whatsappNumber: profile.whatsappNumber || '',
    }),
  });
}

export async function createUserProfile(
  profile: Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'>
): Promise<UserProfile> {
  return apiRequest<UserProfile>('/api/members', {
    method: 'POST',
    body: JSON.stringify(profile),
  });
}

export async function deleteUserProfile(uid: string): Promise<void> {
  await apiRequest(`/api/members/${encodeURIComponent(uid)}`, {
    method: 'PATCH',
    body: JSON.stringify({ active: false }),
  });
}

export function subscribeToUsers(onData: (users: UserProfile[]) => void): () => void {
  return subscribeTo((data) => data.teamMembers, onData);
}

export function subscribeToTasks(onData: (tasks: TaskItem[]) => void): () => void {
  return subscribeTo((data) => data.tasks, onData);
}

export async function createTask(
  task: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt'>,
  _actor: { uid: string; displayName?: string; email?: string }
): Promise<TaskItem> {
  return apiRequest<TaskItem>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  });
}

export async function updateTask(
  taskId: string,
  updates: Partial<TaskItem>,
  _actor: { uid: string; displayName?: string; email?: string },
  _taskTitle: string
): Promise<void> {
  await apiRequest(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteTask(
  taskId: string,
  _actor: { uid: string; displayName?: string; email?: string },
  _taskTitle: string
): Promise<void> {
  await apiRequest(`/api/tasks/${encodeURIComponent(taskId)}`, { method: 'DELETE' });
}

export function subscribeToDailyReports(onData: (reports: DailyReport[]) => void): () => void {
  return subscribeTo((data) => data.dailyReports, onData);
}

export async function saveDailyReport(
  report: Omit<DailyReport, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  _actor: { uid: string; displayName?: string; email?: string }
): Promise<DailyReport> {
  return apiRequest<DailyReport>('/api/daily-reports', {
    method: 'POST',
    body: JSON.stringify(report),
  });
}

export async function getWeeklySummary(weekId: string): Promise<WeeklySummary | null> {
  return apiRequest<WeeklySummary | null>(`/api/weekly-reports/${encodeURIComponent(weekId)}`);
}

export async function saveWeeklySummary(
  summary: WeeklySummary,
  _actor: { uid: string; displayName?: string; email?: string }
): Promise<void> {
  await apiRequest(`/api/weekly-reports/${encodeURIComponent(summary.weekId)}`, {
    method: 'PUT',
    body: JSON.stringify(summary),
  });
  void refreshDashboardData();
}

export async function getSettings(): Promise<AppSettings> {
  return apiRequest<AppSettings>('/api/settings');
}

export async function saveSettings(
  settings: AppSettings,
  _actor: { uid: string; displayName?: string; email?: string }
): Promise<void> {
  await apiRequest<AppSettings>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}
