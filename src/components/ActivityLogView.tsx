import React, { useState } from 'react';
import { History, Search } from 'lucide-react';
import { Avatar } from './Avatar';
import { ActivityLog, ActionType, UserProfile } from '../types';

interface ActivityLogViewProps {
  activityLogs: ActivityLog[];
  teamMembers: UserProfile[];
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({
  activityLogs,
  teamMembers,
}) => {
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const teamMembersById = new Map(teamMembers.map((member) => [member.uid, member]));

  // Quick category tabs
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'tasks' | 'reports' | 'team'>('all');

  // Filter logs
  const visibleActivityLogs = activityLogs.filter((log) => log.action !== 'user_login');
  const filteredLogs = visibleActivityLogs.filter((log) => {
    if (selectedUser !== 'all' && log.userId !== selectedUser) {
      return false;
    }

    // Category filter
    if (log.action === 'user_login') return false;
    if (categoryFilter === 'tasks' && !log.action.includes('task')) return false;
    if (categoryFilter === 'reports' && !log.action.includes('report')) return false;
    if (
      categoryFilter === 'team' &&
      !['profile_updated', 'member_added', 'role_changed', 'member_deactivated', 'member_password_reset', 'settings_updated', 'certificate_created', 'certificate_updated', 'certificate_deleted', 'leave_created', 'leave_updated', 'leave_deleted', 'calendar_note_created', 'calendar_note_updated', 'calendar_note_deleted'].includes(log.action)
    ) return false;

    // Specific Action filter
    if (selectedAction !== 'all' && log.action !== selectedAction) {
      return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        log.details.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  const getActionBadge = (action: ActionType) => {
    const label = action.replace(/_/g, ' ').toUpperCase();
    const isTask = action.includes('task');
    const isReport = action.includes('report');
    const isAI = action.includes('ai');

    return (
      <span
        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full tracking-wider uppercase ${
          isAI
            ? 'bg-orange-100 text-[#F37A1F]'
            : isTask
            ? 'bg-blue-100 text-blue-700'
            : isReport
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-stone-100 text-stone-700'
        }`}
      >
        {label}
      </span>
    );
  };

  const taskLogsCount = visibleActivityLogs.filter((log) => log.action.includes('task')).length;
  const reportLogsCount = visibleActivityLogs.filter((log) => log.action.includes('report')).length;
  const teamChangeLogsCount = visibleActivityLogs.filter((log) =>
    ['profile_updated', 'member_added', 'role_changed', 'member_deactivated', 'member_password_reset', 'settings_updated', 'certificate_created', 'certificate_updated', 'certificate_deleted', 'leave_created', 'leave_updated', 'leave_deleted', 'calendar_note_created', 'calendar_note_updated', 'calendar_note_deleted'].includes(log.action)
  ).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-6xl">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-[#F37A1F] uppercase tracking-wider mb-1">
            <History className="w-4 h-4" />
            <span>Dashboard Changes</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#0F1D38]">
            Activity Log
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            See who made changes to tasks, reports, team members, certificates, and settings.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-stone-700 shadow-2xs">
            Showing {filteredLogs.length} events
          </span>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`p-3.5 rounded-2xl border text-left transition ${
            categoryFilter === 'all'
              ? 'bg-orange-50/80 border-[#F37A1F] shadow-xs'
              : 'bg-white border-stone-200/80 hover:bg-stone-50'
          }`}
        >
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">
            Total Events
          </span>
          <div className="text-xl font-black text-[#0F1D38] mt-0.5">{visibleActivityLogs.length}</div>
        </button>

        <button
          onClick={() => setCategoryFilter('tasks')}
          className={`p-3.5 rounded-2xl border text-left transition ${
            categoryFilter === 'tasks'
              ? 'bg-blue-50/80 border-blue-400 shadow-xs'
              : 'bg-white border-stone-200/80 hover:bg-stone-50'
          }`}
        >
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">
            Tasks Actions
          </span>
          <div className="text-xl font-black text-blue-700 mt-0.5">{taskLogsCount}</div>
        </button>

        <button
          onClick={() => setCategoryFilter('reports')}
          className={`p-3.5 rounded-2xl border text-left transition ${
            categoryFilter === 'reports'
              ? 'bg-emerald-50/80 border-emerald-400 shadow-xs'
              : 'bg-white border-stone-200/80 hover:bg-stone-50'
          }`}
        >
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">
            Reports Filed
          </span>
          <div className="text-xl font-black text-emerald-700 mt-0.5">{reportLogsCount}</div>
        </button>

        <button
          onClick={() => setCategoryFilter('team')}
          className={`p-3.5 rounded-2xl border text-left transition ${
            categoryFilter === 'team'
              ? 'bg-stone-100 border-stone-400 shadow-xs'
              : 'bg-white border-stone-200/80 hover:bg-stone-50'
          }`}
        >
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">
            Team Changes
          </span>
          <div className="text-xl font-black text-stone-700 mt-0.5">{teamChangeLogsCount}</div>
        </button>
      </div>

      {/* Filter and Search Box */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-6 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search activity by title, user, action details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full py-2 px-3 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
          >
            <option value="all">All Action Types</option>
            <option value="task_created">Task Created</option>
            <option value="task_updated">Task Updated</option>
            <option value="task_deleted">Task Deleted</option>
            <option value="report_submitted">Report Submitted</option>
            <option value="report_updated">Report Updated</option>
            <option value="ai_task_created">AI Task Created</option>
            <option value="profile_updated">Profile Updated</option>
            <option value="member_added">Member Added</option>
            <option value="role_changed">Role Changed</option>
            <option value="member_deactivated">Member Deactivated</option>
            <option value="member_password_reset">Password Changed</option>
            <option value="settings_updated">Settings Updated</option>
            <option value="leave_created">Leave Added</option>
            <option value="leave_updated">Leave Updated</option>
            <option value="leave_deleted">Leave Removed</option>
            <option value="calendar_note_created">Calendar Note Added</option>
            <option value="calendar_note_updated">Calendar Note Updated</option>
            <option value="calendar_note_deleted">Calendar Note Removed</option>
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full py-2 px-3 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
          >
            <option value="all">All Team Members</option>
            {teamMembers.map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Log Feed List */}
      <div className="bg-white rounded-3xl border border-stone-200/80 shadow-xs divide-y divide-stone-100 overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-xs text-stone-400">
            No activity records match your filter criteria.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const actor = teamMembersById.get(log.userId);
            const dateObj = new Date(log.timestamp);
            const timeFormatted = dateObj.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            });
            const dateFormatted = dateObj.toLocaleDateString('en-IN', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <div
                key={log.id}
                className="p-4 sm:p-5 hover:bg-stone-50/70 transition flex items-start justify-between gap-4"
              >
                <div className="flex items-start space-x-3.5">
                  <Avatar
                    name={log.userName || 'Unknown user'}
                    photoURL={actor?.photoURL}
                    className="w-10 h-10 rounded-2xl shrink-0 mt-0.5 border border-stone-200 shadow-2xs"
                  />

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-black text-[#0F1D38]">
                        {log.userName}
                      </span>
                      {getActionBadge(log.action)}
                    </div>
                    <p className="text-xs text-stone-700 leading-relaxed break-words">
                      {log.details}
                    </p>
                    {log.userEmail && (
                      <span className="text-[10px] text-stone-400 mt-0.5 block">
                        {log.userEmail}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right text-[11px] text-stone-400 font-medium">
                  <div className="text-stone-600 font-bold">{timeFormatted}</div>
                  <div>{dateFormatted}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
