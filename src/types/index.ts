export type UserRole = 'admin' | 'member';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  linkedInUrl?: string;
  whatsappNumber?: string;
  capabilities: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  assignedToName: string;
  assigneeEmail?: string;
  createdBy: string;
  createdByName: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

export interface DailyReport {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  date: string; // YYYY-MM-DD
  whatIDid: string;
  leadsHandled?: number;
  blockers: string;
  planTomorrow: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklySummary {
  weekId: string;
  summary: string;
  totalLeads: number;
  updatedBy: string;
  updatedAt: string;
  sentAt?: string;
}

export interface CalendarLeave {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  startDate: string;
  endDate: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarNote {
  id: string;
  date: string;
  userId: string;
  userName: string;
  title: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export type ActionType =
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'report_submitted'
  | 'report_updated'
  | 'profile_updated'
  | 'user_login'
  | 'ai_task_created'
  | 'member_added'
  | 'role_changed'
  | 'member_deactivated'
  | 'member_password_reset'
  | 'settings_updated'
  | 'certificate_created'
  | 'certificate_updated'
  | 'certificate_deleted'
  | 'leave_created'
  | 'leave_updated'
  | 'leave_deleted'
  | 'calendar_note_created'
  | 'calendar_note_updated'
  | 'calendar_note_deleted';

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: ActionType;
  details: string;
  timestamp: string;
}

export interface AppSettings {
  reportRecipientEmail: string;
  teamName: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface Certificate {
  id: string;
  userId: string;
  name: string;
  organization: string;
  issueDate: string;
  expiryDate: string;
  originalFileName: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerRole?: UserProfile['role'];
}
