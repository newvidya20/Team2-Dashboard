import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Plus,
  ArrowRight,
  ListTodo,
  Sparkles,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  User,
  BarChart3,
  Users,
  Zap,
  Flame,
  ArrowUpRight,
  ShieldCheck,
  CalendarDays,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TaskItem, DailyReport, ActivityLog, UserProfile } from '../types';
import { Avatar } from './Avatar';
import { updateTask } from '../services/db';
import { getLocalDateKey } from '../utils/date';

interface DashboardProps {
  tasks: TaskItem[];
  dailyReports: DailyReport[];
  activityLogs: ActivityLog[];
  teamMembers: UserProfile[];
  onNavigate: (tab: string) => void;
  onOpenNewTask: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  tasks,
  dailyReports,
  activityLogs,
  teamMembers,
  onNavigate,
  onOpenNewTask,
}) => {
  const { userProfile, isAdmin } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [kpiScope, setKpiScope] = useState<'team' | 'my'>('team');
  const teamMembersById = new Map(teamMembers.map((member) => [member.uid, member]));

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString('en-IN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = getLocalDateKey();

  // Match saved records by their stable user IDs.
  const isMyTask = (t: TaskItem) => {
    return Boolean(userProfile && t.assignedTo === userProfile.uid);
  };

  const isMyReport = (r: DailyReport) => {
    return Boolean(userProfile && r.userId === userProfile.uid);
  };

  // Base user task metrics
  const myTasks = tasks.filter(isMyTask);
  const myOpenTasks = myTasks.filter((t) => t.status !== 'done');

  // Overdue tasks across entire team
  const overdueTasks = tasks.filter((t) => {
    if (t.status === 'done') return false;
    return t.dueDate < todayStr;
  });
  const myOverdueTasks = overdueTasks.filter(isMyTask);

  // Scope task metrics based on the team / personal queue toggle.
  const scopedTasks = kpiScope === 'my' ? myTasks : tasks;

  // Today's Daily report for current user
  const myReportToday = dailyReports.find(
    (r) => isMyReport(r) && r.date === todayStr
  );

  // Week bounds calculation (Monday to Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const mondayStr = getLocalDateKey(monday);
  const sundayStr = getLocalDateKey(sunday);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekRangeLabel = `${monthNames[monday.getMonth()]} ${String(monday.getDate()).padStart(2, '0')} – ${monthNames[sunday.getMonth()]} ${String(sunday.getDate()).padStart(2, '0')}, ${sunday.getFullYear()}`;

  // Keep week-based metrics within the same Monday-to-Sunday reporting period.
  const isThisWeek = (dateStr?: string) => {
    if (!dateStr) return false;
    const cleanDate = dateStr.slice(0, 10);
    return cleanDate >= mondayStr && cleanDate <= sundayStr;
  };

  // Tasks completed this week
  const scopedTasksThisWeek = scopedTasks.filter(
    (t) => isThisWeek(t.createdAt) || isThisWeek(t.updatedAt)
  );
  const completedThisWeek = scopedTasksThisWeek.filter(
    (t) => t.status === 'done' && isThisWeek(t.updatedAt)
  );
  const tasksCompletedThisWeekCount = completedThisWeek.length;
  const weeklyCompletionRate =
    scopedTasksThisWeek.length > 0
      ? Math.round((tasksCompletedThisWeekCount / scopedTasksThisWeek.length) * 100)
      : 0;

  // 3. Urgent Pending Tasks (high priority or overdue)
  const pendingTasks = scopedTasks.filter((t) => t.status !== 'done');
  const highPriorityPending = pendingTasks.filter((t) => t.priority === 'high');
  const overduePending = pendingTasks.filter((t) => t.dueDate < todayStr);
  const urgentPendingTasks = pendingTasks.filter(
    (t) => t.priority === 'high' || t.dueDate < todayStr
  );

  const handleStatusChange = async (task: TaskItem) => {
    if (!userProfile) return;
    const nextStatus = task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo';
    try {
      await updateTask(task.id, { status: nextStatus }, userProfile, task.title);
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return {
        message: 'Good morning',
        background: '/greeting-morning.webp',
        overlay:
          'linear-gradient(90deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.9) 42%, rgba(255,255,255,0.12) 100%), linear-gradient(0deg, rgba(238,164,76,0.18), rgba(255,240,214,0.08))',
      };
    }
    if (hour >= 12 && hour < 17) {
      return {
        message: 'Good afternoon',
        background: '/greeting-afternoon.webp',
        overlay:
          'linear-gradient(90deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.9) 42%, rgba(255,255,255,0.12) 100%), linear-gradient(0deg, rgba(72,156,161,0.12), rgba(216,241,255,0.08))',
      };
    }
    if (hour >= 17 && hour < 20) {
      return {
        message: 'Good evening',
        background: '/greeting-evening.webp',
        overlay:
          'radial-gradient(circle at 72% 58%, rgba(255,210,119,0.9) 0 1px, rgba(255,190,93,0.24) 2px, transparent 6px), radial-gradient(circle at 83% 43%, rgba(255,220,140,0.85) 0 1px, rgba(255,190,93,0.2) 2px, transparent 6px), radial-gradient(circle at 91% 67%, rgba(255,210,119,0.85) 0 1px, rgba(255,190,93,0.2) 2px, transparent 6px), linear-gradient(90deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.9) 42%, rgba(255,255,255,0.1) 100%), linear-gradient(0deg, rgba(227,139,53,0.26), rgba(255,211,150,0.08))',
      };
    }
    return {
      message: 'Good evening',
      background: '/greeting-night.webp',
      overlay:
        'radial-gradient(circle at 84% 27%, rgba(255,247,216,0.96) 0 10px, rgba(255,247,216,0.3) 11px 25px, transparent 46px), linear-gradient(90deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.9) 42%, rgba(255,255,255,0.08) 100%), linear-gradient(0deg, rgba(24,34,71,0.28), rgba(44,54,97,0.04))',
    };
  };
  const greeting = getGreeting();

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Greeting Header & Live Clock */}
      <div
        className="rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 bg-cover bg-center"
        style={{
          backgroundImage: `${greeting.overlay}, url("${greeting.background}")`,
        }}
      >
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-[#F37A1F] uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-[#F37A1F] animate-pulse"></span>
            <span>Team 2 • Lead Assessment & Initial Response</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F1D38]">
            {greeting.message},{' '}
            <span className="text-[#F37A1F]">{userProfile?.displayName || 'Teammate'}</span>! 👋
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {isAdmin
              ? 'Admin view active. Review team tasks, reports, and activity.'
              : 'Review your tasks and keep your daily report up to date.'}
          </p>
        </div>

        {/* Live Clock & Date Badge */}
        <div className="flex items-center space-x-4 bg-[#FBF9F5] px-5 py-3.5 rounded-2xl border border-stone-200 self-start md:self-auto">
          <Clock className="w-6 h-6 text-[#F37A1F]" />
          <div>
            <div className="text-lg font-black text-[#0F1D38] tracking-tight tabular-nums">
              {currentTime || '--:--:--'}
            </div>
            <div className="text-[11px] font-semibold text-stone-500">{currentDate}</div>
          </div>
        </div>
      </div>

      {/* KPI Performance Summary Section */}
      <section aria-label="Key Performance Indicators" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-[#F37A1F] uppercase tracking-wider">
              <BarChart3 className="w-4 h-4 text-[#F37A1F]" />
              <span>Executive KPI Summary</span>
            </div>
            <h2 className="text-xl font-black text-[#0F1D38] tracking-tight mt-0.5">
              Key Performance Indicators
            </h2>
            <p className="text-xs text-stone-500">
              Metrics calculated from saved records for {weekRangeLabel}
            </p>
          </div>

          {/* Scope Switcher / Filter Pills */}
          <div className="flex items-center space-x-1.5 self-start sm:self-auto bg-stone-100 p-1 rounded-2xl border border-stone-200">
            <button
              type="button"
              onClick={() => setKpiScope('team')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                kpiScope === 'team'
                  ? 'bg-white text-[#0F1D38] shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Team Overview ({teamMembers.length})
            </button>
            <button
              type="button"
              onClick={() => setKpiScope('my')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                kpiScope === 'my'
                  ? 'bg-white text-[#0F1D38] shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              My Queue ({userProfile?.displayName?.split(' ')[0] || 'Me'})
            </button>
          </div>
        </div>

        {/* Visual KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* KPI Card 1: Tasks Completed This Week */}
          <div
            onClick={() => onNavigate('tasks')}
            className="bg-white rounded-3xl p-6 border border-stone-200/80 shadow-xs hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-wider text-stone-500">
                  Tasks Completed This Week
                </span>
                <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="flex items-baseline space-x-2">
                <span className="text-3xl sm:text-4xl font-black text-[#0F1D38] tabular-nums tracking-tight">
                  {tasksCompletedThisWeekCount}
                </span>
                <span className="text-xs font-bold text-stone-400">
                  / {scopedTasksThisWeek.length} in period
                </span>
              </div>

              <div className="mt-2.5 flex items-center space-x-1.5">
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <CheckCircle className="w-3 h-3" />
                  <span>{weeklyCompletionRate}% Rate</span>
                </span>
                <span className="text-[11px] text-stone-500 font-medium">
                  {scopedTasksThisWeek.filter((t) => t.status !== 'done').length} open
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${weeklyCompletionRate}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-bold text-emerald-600">
              <span>Inspect tasks</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>

          {/* KPI Card 3: Urgent Pending Tasks */}
          <div
            onClick={() => onNavigate('tasks')}
            className={`bg-white rounded-3xl p-6 border shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between ${
              urgentPendingTasks.length > 0
                ? 'border-red-200/90 hover:border-red-400'
                : 'border-stone-200/80 hover:border-emerald-400'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-wider text-stone-500">
                  Urgent Pending Tasks
                </span>
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform ${
                    urgentPendingTasks.length > 0
                      ? 'bg-red-100/80 text-red-600'
                      : 'bg-emerald-100/80 text-emerald-600'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>

              <div className="flex items-baseline space-x-2">
                <span
                  className={`text-3xl sm:text-4xl font-black tabular-nums tracking-tight ${
                    urgentPendingTasks.length > 0 ? 'text-red-600' : 'text-[#0F1D38]'
                  }`}
                >
                  {urgentPendingTasks.length}
                </span>
                <span className="text-xs font-bold text-stone-400">items</span>
              </div>

              <div className="mt-2.5 flex items-center space-x-1.5">
                {urgentPendingTasks.length > 0 ? (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200/60">
                    <Flame className="w-3 h-3 text-red-500" />
                    <span>Requires Action</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>{pendingTasks.length === 0 ? 'No open tasks' : 'No urgent tasks'}</span>
                  </span>
                )}
                <span className="text-[11px] text-stone-500 font-medium">
                  {highPriorityPending.length} high priority
                </span>
              </div>

              <p className="text-xs text-stone-500 mt-3 line-clamp-1">
                {overduePending.length > 0
                  ? `${overduePending.length} task${overduePending.length > 1 ? 's' : ''} past due date`
                  : 'Zero overdue tasks in queue'}
              </p>
            </div>

            <div
              className={`mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-bold ${
                urgentPendingTasks.length > 0 ? 'text-red-600' : 'text-stone-600'
              }`}
            >
              <span>{urgentPendingTasks.length > 0 ? 'Triage urgent tasks' : 'Check queue'}</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>

          {/* KPI Card 4: Team Members */}
          <div
            onClick={() => onNavigate('team')}
            className="bg-white rounded-3xl p-6 border border-stone-200/80 shadow-xs hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-black uppercase tracking-wider text-stone-500">
                  Team Members
                </span>
                <div className="w-10 h-10 rounded-2xl bg-blue-100/80 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="flex items-baseline space-x-2">
                <span className="text-3xl sm:text-4xl font-black text-[#0F1D38] tabular-nums tracking-tight">
                  {teamMembers.length}
                </span>
                <span className="text-xs font-bold text-stone-400">profiles</span>
              </div>

              <p className="text-xs text-stone-500 mt-3 line-clamp-1">
                Manually managed team profiles
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-bold text-blue-600">
              <span>View team</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Report Reminder / Quick Status Banner */}
      <div className="bg-gradient-to-r from-orange-50 via-white to-stone-50 rounded-3xl p-5 border border-orange-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-11 h-11 rounded-2xl bg-[#F37A1F] text-white flex items-center justify-center shrink-0 shadow-sm">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#F37A1F]">
                Daily Reporting Status
              </span>
              {myReportToday ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                  Report submitted
                </span>
              ) : null}
            </div>
            <p className="text-sm font-bold text-[#0F1D38] mt-0.5">
              {myReportToday
                ? 'Your daily work report is submitted. You can update it anytime before EOD.'
                : 'No report has been submitted today. Add one when ready.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('daily-report')}
          className="shrink-0 px-4 py-2.5 rounded-2xl bg-[#0F1D38] text-white text-xs font-bold hover:bg-stone-800 transition shadow-xs flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <span>{myReportToday ? 'Edit Today’s Report' : 'Write Daily Report'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Content Split: Priority Tasks & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: My Priority Tasks (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-[#0F1D38]">My Active Queue</h2>
              <p className="text-xs text-stone-500">Tasks assigned to you that require attention</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={onOpenNewTask}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#F37A1F] text-white text-xs font-bold hover:bg-[#df6a14] transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Task</span>
              </button>
              <button
                onClick={() => onNavigate('tasks')}
                className="text-xs font-bold text-[#F37A1F] hover:underline"
              >
                View all ({tasks.length})
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200/80 divide-y divide-stone-100 shadow-xs overflow-hidden">
            {myOpenTasks.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                <h3 className="text-sm font-bold text-[#0F1D38]">Your Queue is Clear!</h3>
                <p className="text-xs text-stone-500 mt-1">
                  You have completed all your assigned tasks. You can add a new one or check team tasks.
                </p>
                <button
                  onClick={onOpenNewTask}
                  className="mt-4 px-4 py-2 rounded-xl bg-orange-100 text-[#F37A1F] text-xs font-bold hover:bg-orange-200 transition"
                >
                  Create Assessment Task
                </button>
              </div>
            ) : (
              myOpenTasks.slice(0, 5).map((task) => {
                const isOverdue = task.dueDate < todayStr;
                return (
                  <div
                    key={task.id}
                    className="p-4 hover:bg-stone-50/80 transition flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start space-x-3">
                      <button
                        onClick={() => handleStatusChange(task)}
                        className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition ${
                          task.status === 'in_progress'
                            ? 'border-amber-500 bg-amber-50 text-amber-600'
                            : 'border-stone-300 hover:border-orange-500'
                        }`}
                        title="Click to toggle status (To Do -> In Progress -> Done)"
                      >
                        {task.status === 'in_progress' && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
                      </button>

                      <div>
                        <h4 className="text-sm font-bold text-[#0F1D38] leading-snug">
                          {task.title}
                        </h4>
                        <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
                          {task.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              task.priority === 'high'
                                ? 'bg-red-100 text-red-700'
                                : task.priority === 'medium'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {task.priority} Priority
                          </span>

                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              isOverdue ? 'bg-red-100 text-red-700 font-bold' : 'text-stone-500 bg-stone-100'
                            }`}
                          >
                            Due: {task.dueDate} {isOverdue && '(Overdue)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center space-x-2">
                      <select
                        value={task.status}
                        onChange={(e) => {
                          if (userProfile) {
                            updateTask(
                              task.id,
                              { status: e.target.value as any },
                              userProfile,
                              task.title
                            );
                          }
                        }}
                        className="text-xs font-semibold bg-stone-100 border border-stone-200 rounded-lg px-2 py-1 text-stone-700 focus:outline-none"
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Live Activity Feed (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-[#0F1D38]">Recent Activity</h2>
              <p className="text-xs text-stone-500">Live operational events in Team 2</p>
            </div>
            <button
              onClick={() => onNavigate('activity')}
              className="text-xs font-bold text-[#F37A1F] hover:underline"
            >
              Full log →
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200/80 p-5 shadow-xs divide-y divide-stone-100">
            {activityLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-500">
                No activity recorded yet.
              </div>
            ) : (
              activityLogs.slice(0, 6).map((log) => {
                const timeAgo = formatTimeAgo(log.timestamp);
                const actor = teamMembersById.get(log.userId);
                return (
                  <div key={log.id} className="py-3 first:pt-0 last:pb-0 flex items-start space-x-3">
                    <Avatar
                      name={log.userName || 'Unknown user'}
                      photoURL={actor?.photoURL}
                      className="w-8 h-8 rounded-full shrink-0 mt-0.5 text-xs"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0F1D38] truncate max-w-[150px]">
                          {log.userName}
                        </span>
                        <span className="text-[10px] text-stone-400 font-medium">{timeAgo}</span>
                      </div>
                      <p className="text-xs text-stone-600 mt-0.5 leading-snug break-words">
                        {log.details}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

function formatTimeAgo(isoString: string): string {
  try {
    const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return 'Recently';
  }
}
