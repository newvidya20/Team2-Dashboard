import { TaskItem, UserProfile } from '../types';

export interface TaskEmailDraft {
  assigneeEmail: string;
  assigneeName: string;
  subject: string;
  bodyText: string;
  gmailComposeUrl: string;
}

export function resolveMemberEmail(
  memberOrUid?: { uid?: string; email?: string; displayName?: string } | string | null,
  teamMembers: UserProfile[] = []
): { email: string; name: string } {
  if (!memberOrUid) return { email: '', name: '' };

  if (typeof memberOrUid === 'string') {
    const found = teamMembers.find((m) => m.uid === memberOrUid);
    return { email: found?.email || '', name: found?.displayName || '' };
  }

  return { email: memberOrUid.email || '', name: memberOrUid.displayName || '' };
}

function formatTaskDueDate(date?: string): string {
  if (!date) return 'Not specified';
  const value = new Date(`${date}T00:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  return value.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatTaskEmail(
  task: Partial<TaskItem>,
  assigneeName: string,
  assigneeEmail: string,
  creatorName: string,
  creatorEmail: string
) {
  const title = task.title?.trim() || 'New task';
  const priority = task.priority || 'medium';
  const priorityLabel = `${priority.charAt(0).toUpperCase()}${priority.slice(1)}`;
  const status = (task.status || 'todo')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
  const assignedBy = creatorName.trim() || 'Team 2';
  const subject = `Task assigned: ${title} | ${priorityLabel} priority`;
  const dashboardUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const bodyText =
`Hi ${assigneeName.trim() || 'there'},

You have a new task in the Team 2 Hub. Please review the details below and plan your next steps.

TASK OVERVIEW
------------------------------------
Task:        ${title}
Priority:    ${priorityLabel}
Due date:    ${formatTaskDueDate(task.dueDate)}
Status:      ${status}
Assigned by: ${assignedBy}${creatorEmail ? ` (${creatorEmail})` : ''}

DESCRIPTION:
${task.description || 'No description provided.'}

Please keep your task status up to date in the Team 2 Hub as work progresses.

${dashboardUrl ? `Open the Team 2 Hub: ${dashboardUrl}\n` : ''}
Thank you,
${assignedBy}
Team 2 Hub
`;

  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    assigneeEmail
  )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

  return { subject, bodyText, gmailComposeUrl };
}

export function prepareTaskEmailDraft(
  task: Partial<TaskItem>,
  assigneeEmail: string,
  assigneeName: string,
  creator: { displayName?: string; email?: string }
): TaskEmailDraft {
  const creatorName = creator.displayName || '';
  const creatorEmail = creator.email || '';

  const { subject, bodyText, gmailComposeUrl } = formatTaskEmail(
    task,
    assigneeName,
    assigneeEmail,
    creatorName,
    creatorEmail
  );

  return {
    assigneeEmail,
    assigneeName,
    subject,
    bodyText,
    gmailComposeUrl,
  };
}
