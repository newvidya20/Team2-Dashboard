import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreVertical,
  Trash2,
  Edit2,
  User,
  Calendar,
  X,
  CheckSquare,
  Columns,
  List,
  GripVertical,
  ArrowRight,
  Sparkles,
  Mail,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TaskItem, TaskPriority, TaskStatus, UserProfile } from '../types';
import { createTask, updateTask, deleteTask } from '../services/db';
import { prepareTaskEmailDraft, resolveMemberEmail } from '../services/notificationService';
import { getLocalDateKey } from '../utils/date';

interface TasksViewProps {
  tasks: TaskItem[];
  teamMembers: UserProfile[];
  isCreateModalOpen: boolean;
  onCloseCreateModal: () => void;
  onOpenCreateModal: () => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  teamMembers,
  isCreateModalOpen,
  onCloseCreateModal,
  onOpenCreateModal,
}) => {
  const { userProfile, isAdmin } = useAuth();
  const assignableMembers =
    isAdmin && userProfile && !teamMembers.some((member) => member.uid === userProfile.uid)
      ? [...teamMembers, userProfile]
      : teamMembers;

  // View mode: 'kanban' or 'list' (default: 'kanban')
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'created' | 'done'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Drag and Drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);

  // Edit task state
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  // New task form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState(userProfile?.uid || '');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState(getLocalDateKey());
  const [sendEmailNotification, setSendEmailNotification] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Email Notification Modal / confirmation state
  const [notificationModalData, setNotificationModalData] = useState<{
    task: Partial<TaskItem>;
    assigneeName: string;
    assigneeEmail: string;
    gmailComposeUrl: string;
    bodyText: string;
    subject: string;
  } | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);

  const todayStr = getLocalDateKey();

  const checkIsAssignedToMe = (task: TaskItem) => {
    if (!userProfile) return false;
    return task.assignedTo === userProfile.uid;
  };

  const getTaskCreatorLabel = (task: TaskItem) => {
    const creator = teamMembers.find((member) => member.uid === task.createdBy);
    const creatorName = task.createdBy === userProfile?.uid ? 'You' : task.createdByName;
    return `${creatorName}${creator?.role === 'admin' ? ' (Admin)' : ''}`;
  };

  const getTaskAssigneeLabel = (task: TaskItem) =>
    `${task.assignedToName}${task.assignedTo === userProfile?.uid ? ' (You)' : ''}`;

  const handleNotifyAssignee = async (task: TaskItem) => {
    if (!userProfile) return;
    const { email: assigneeEmail, name: assigneeName } = resolveMemberEmail(
      task.assigneeEmail
        ? { email: task.assigneeEmail, displayName: task.assignedToName }
        : { uid: task.assignedTo, displayName: task.assignedToName },
      teamMembers
    );

    const emailDetails = prepareTaskEmailDraft(
      task,
      assigneeEmail,
      assigneeName,
      userProfile
    );

    setNotificationModalData({
      task,
      assigneeName,
      assigneeEmail,
      gmailComposeUrl: emailDetails.gmailComposeUrl,
      bodyText: emailDetails.bodyText,
      subject: emailDetails.subject,
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setSubmitting(true);

    try {
      const targetUser = isAdmin
        ? assignableMembers.find((member) => member.uid === assignedTo) || userProfile
        : userProfile;
      if (!targetUser) return;
      const { email: resolvedEmail, name: resolvedName } = resolveMemberEmail(
        targetUser,
        teamMembers
      );

      const created = await createTask(
        {
          title: title.trim(),
          description: description.trim(),
          assignedTo: targetUser.uid,
          assignedToName: targetUser.displayName,
          assigneeEmail: resolvedEmail,
          createdBy: userProfile.uid,
          createdByName: userProfile.displayName,
          status: 'todo',
          priority,
          dueDate,
        },
        userProfile
      );

      // Prepare a draft only when explicitly requested; the app does not send email.
      if (isAdmin && sendEmailNotification) {
        const emailDetails = prepareTaskEmailDraft(
          created,
          resolvedEmail,
          resolvedName,
          userProfile
        );

        setNotificationModalData({
          task: created,
          assigneeName: resolvedName,
          assigneeEmail: resolvedEmail,
          gmailComposeUrl: emailDetails.gmailComposeUrl,
          bodyText: emailDetails.bodyText,
          subject: emailDetails.subject,
        });
      }

      // Reset
      setTitle('');
      setDescription('');
      setPriority('medium');
      setSendEmailNotification(false);
      setAssignedTo(userProfile.uid);
      onCloseCreateModal();
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !userProfile) return;
    setSubmitting(true);

    try {
      const targetUser = isAdmin
        ? assignableMembers.find((member) => member.uid === assignedTo) || userProfile
        : userProfile;
      if (!targetUser) return;
      const { email: resolvedEmail } = resolveMemberEmail(targetUser, teamMembers);
      await updateTask(
        editingTask.id,
        {
          title,
          description,
          assignedTo: targetUser.uid,
          assignedToName: targetUser.displayName,
          assigneeEmail: resolvedEmail,
          priority,
          dueDate,
        },
        userProfile,
        editingTask.title
      );
      setEditingTask(null);
    } catch (err) {
      console.error('Failed to edit task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (task: TaskItem) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description);
    setAssignedTo(task.assignedTo);
    setPriority(task.priority);
    setDueDate(task.dueDate);
  };

  const handleDelete = async (task: TaskItem) => {
    if (!userProfile) return;
    if (confirm(`Are you sure you want to delete task "${task.title}"?`)) {
      try {
        await deleteTask(task.id, userProfile, task.title);
      } catch (err) {
        console.error('Failed to delete task:', err);
      }
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, task: TaskItem) => {
    const isAssignedToMe = task.assignedTo === userProfile?.uid;
    const isCreatedByMe = task.createdBy === userProfile?.uid;
    const canMove = isAdmin || isAssignedToMe || isCreatedByMe;

    if (!canMove) {
      e.preventDefault();
      setDragError('Only Admin or the assignee can move this task.');
      setTimeout(() => setDragError(null), 3000);
      return;
    }

    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(task.id);
  };

  const handleDragOver = (e: React.DragEvent, colStatus: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colStatus) {
      setDragOverCol(colStatus);
    }
  };

  const handleDragLeave = (e: React.DragEvent, colStatus: TaskStatus) => {
    // Check if moving outside current container
    if (dragOverCol === colStatus) {
      setDragOverCol(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);

    if (!taskId || !userProfile) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    const isAssignedToMe = task.assignedTo === userProfile.uid;
    const isCreatedByMe = task.createdBy === userProfile.uid;
    const canMove = isAdmin || isAssignedToMe || isCreatedByMe;

    if (!canMove) {
      setDragError('Only Admin or the assignee can change task status.');
      setTimeout(() => setDragError(null), 3000);
      return;
    }

    try {
      await updateTask(taskId, { status: targetStatus }, userProfile, task.title);
    } catch (err: any) {
      console.error('Failed to update task via drag and drop:', err);
      setDragError(err.message || 'Failed to update task status');
      setTimeout(() => setDragError(null), 3000);
    }
  };

  // Direct status changer (also for mobile/touch fallback)
  const handleQuickStatusChange = async (task: TaskItem, newStatus: TaskStatus) => {
    if (!userProfile) return;
    try {
      await updateTask(task.id, { status: newStatus }, userProfile, task.title);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    // Tab filter
    if (activeTab === 'mine' && task.assignedTo !== userProfile?.uid) return false;
    if (activeTab === 'created' && task.createdBy !== userProfile?.uid) return false;
    if (activeTab === 'done' && task.status !== 'done') return false;

    // Status filter
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;

    // Priority filter
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        task.title.toLowerCase().includes(q) ||
        task.description.toLowerCase().includes(q) ||
        task.assignedToName.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  // Split tasks by status for Kanban columns
  const todoTasks = filteredTasks.filter((t) => t.status === 'todo');
  const inProgressTasks = filteredTasks.filter((t) => t.status === 'in_progress');
  const doneTasks = filteredTasks.filter((t) => t.status === 'done');

  const kanbanColumns: {
    status: TaskStatus;
    label: string;
    badgeColor: string;
    accentBorder: string;
    tasks: TaskItem[];
  }[] = [
    {
      status: 'todo',
      label: 'To Do',
      badgeColor: 'bg-stone-200 text-stone-800',
      accentBorder: 'border-stone-300',
      tasks: todoTasks,
    },
    {
      status: 'in_progress',
      label: 'In Progress',
      badgeColor: 'bg-amber-100 text-amber-800',
      accentBorder: 'border-amber-300',
      tasks: inProgressTasks,
    },
    {
      status: 'done',
      label: 'Done',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      accentBorder: 'border-emerald-300',
      tasks: doneTasks,
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F1D38]">
            Assessment Tasks
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Drag and drop tasks between columns to update their status.
          </p>
        </div>

        <div className="flex items-center space-x-3 self-start sm:self-auto">
          {/* View Mode Toggle: Kanban Board vs List View */}
          <div className="flex items-center bg-white p-1 rounded-2xl border border-stone-200 shadow-2xs">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'kanban'
                  ? 'bg-[#F37A1F] text-white shadow-xs'
                  : 'text-stone-600 hover:text-[#0F1D38] hover:bg-stone-50'
              }`}
              title="Kanban Board View (Drag & Drop)"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'list'
                  ? 'bg-[#F37A1F] text-white shadow-xs'
                  : 'text-stone-600 hover:text-[#0F1D38] hover:bg-stone-50'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-[#F37A1F] text-white font-bold text-xs sm:text-sm hover:bg-[#df6a14] transition shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {dragError && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center space-x-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{dragError}</span>
        </div>
      )}

      {/* Tabs and Search / Filter Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-xs space-y-4">
        {/* Tab pills */}
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 pb-3">
          {[
            { id: 'all', label: 'All Tasks', count: tasks.length },
            {
              id: 'mine',
              label: 'Assigned to Me',
              count: tasks.filter(
                (t) => t.assignedTo === userProfile?.uid
              ).length,
            },
            {
              id: 'created',
              label: 'Created by Me',
              count: tasks.filter((t) => t.createdBy === userProfile?.uid).length,
            },
            {
              id: 'done',
              label: 'Completed',
              count: tasks.filter((t) => t.status === 'done').length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === tab.id
                  ? 'bg-[#F37A1F] text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search tasks by title, assignee, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F] focus:border-transparent"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2 px-3 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
            >
              <option value="all">All Statuses</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full py-2 px-3 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
        </div>
      </div>

      {/* VIEW: KANBAN BOARD (Drag and Drop) */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {kanbanColumns.map((col) => {
            const isTargetCol = dragOverCol === col.status;
            return (
              <div
                key={col.status}
                onDragOver={(e) => handleDragOver(e, col.status)}
                onDragLeave={(e) => handleDragLeave(e, col.status)}
                onDrop={(e) => handleDrop(e, col.status)}
                className={`rounded-3xl p-4 sm:p-5 transition-all flex flex-col min-h-[520px] ${
                  isTargetCol
                    ? 'bg-orange-50/70 border-2 border-dashed border-[#F37A1F] ring-4 ring-orange-100 shadow-md scale-[1.01]'
                    : 'bg-[#FBF9F5]/90 border border-stone-200/90 shadow-2xs'
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-stone-200/80">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        col.status === 'todo'
                          ? 'bg-stone-500'
                          : col.status === 'in_progress'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                    <h3 className="font-black text-[#0F1D38] text-sm sm:text-base tracking-tight">
                      {col.label}
                    </h3>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-black shadow-2xs ${col.badgeColor}`}
                  >
                    {col.tasks.length}
                  </span>
                </div>

                {/* Drop Guidance Indicator */}
                {isTargetCol && (
                  <div className="mb-3 p-3 rounded-2xl bg-orange-100/70 border border-orange-300 text-center text-xs font-bold text-[#F37A1F] animate-pulse">
                    Drop task here to move to {col.label}
                  </div>
                )}

                {/* Task Cards in Column */}
                <div className="space-y-3 flex-1 overflow-y-auto pr-0.5">
                  {col.tasks.length === 0 ? (
                    <div className="h-44 rounded-2xl border-2 border-dashed border-stone-200/70 flex flex-col items-center justify-center text-center p-4 text-stone-400">
                      <p className="text-xs font-semibold">No tasks in {col.label}</p>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        Drag tasks here or create a new one
                      </p>
                      {col.status === 'todo' && (
                        <button
                          onClick={onOpenCreateModal}
                          className="mt-3 px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-orange-300 text-[11px] font-bold text-stone-700 transition"
                        >
                          + Add Task
                        </button>
                      )}
                    </div>
                  ) : (
                    col.tasks.map((task) => {
                      const isAssignedToMe = checkIsAssignedToMe(task);
                      const isCreatedByMe = task.createdBy === userProfile?.uid;
                      const canMove = isAdmin || isAssignedToMe || isCreatedByMe;
                      const isOverdue = task.status !== 'done' && task.dueDate < todayStr;
                      const isBeingDragged = draggedTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          draggable={canMove}
                          onDragStart={(e) => handleDragStart(e, task)}
                          className={`bg-white rounded-2xl p-4 border border-stone-200/90 shadow-2xs hover:shadow-md transition-all select-none group relative ${
                            canMove ? 'cursor-grab active:cursor-grabbing hover:border-orange-300' : 'cursor-default'
                          } ${isBeingDragged ? 'opacity-40 scale-95 border-[#F37A1F]' : ''}`}
                        >
                          {/* Top Row: Priority & Drag Handle & Actions */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-1.5">
                              {canMove && (
                                <GripVertical className="w-3.5 h-3.5 text-stone-300 group-hover:text-stone-500 transition-colors" />
                              )}
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                  task.priority === 'high'
                                    ? 'bg-red-100 text-red-700'
                                    : task.priority === 'medium'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-stone-100 text-stone-600'
                                }`}
                              >
                                {task.priority}
                              </span>

                              {isOverdue && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                  Overdue
                                </span>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNotifyAssignee(task);
                                }}
                                className="p-1 rounded-lg text-stone-400 hover:text-[#F37A1F] hover:bg-orange-50 transition"
                                title={`Prepare email draft for ${task.assigneeEmail || task.assignedToName}`}
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>

                              {(isAdmin || isCreatedByMe) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEdit(task);
                                  }}
                                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                                  title="Edit task"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {(isAdmin || isCreatedByMe) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(task);
                                  }}
                                  className="p-1 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition"
                                  title="Delete task"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Title */}
                          <h4
                            className={`text-xs sm:text-sm font-bold text-[#0F1D38] leading-snug mb-1.5 ${
                              task.status === 'done' ? 'line-through text-stone-400' : ''
                            }`}
                          >
                            {task.title}
                          </h4>

                          {/* Description snippet */}
                          {task.description && (
                            <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed mb-3">
                              {task.description}
                            </p>
                          )}

                          {/* Card Footer: Assignee, creator, and due date */}
                          <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-stone-100 text-[11px]">
                            <div className="flex items-start space-x-1.5 min-w-0">
                              <div className="w-5 h-5 rounded-full bg-orange-100 text-[#F37A1F] flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">
                                {task.assignedToName ? task.assignedToName.charAt(0) : 'U'}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-stone-700 font-semibold truncate max-w-[155px]">
                                  Assigned to: {getTaskAssigneeLabel(task)}
                                </span>
                                <span className="text-[10px] text-stone-500 truncate max-w-[155px]" title={task.createdByName}>
                                  Created by: {getTaskCreatorLabel(task)}
                                </span>
                                {task.assigneeEmail && (
                                  <span className="text-[10px] text-stone-400 font-mono truncate max-w-[155px]" title={task.assigneeEmail}>
                                    {task.assigneeEmail}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-1 text-stone-400 font-medium">
                              <Calendar className="w-3 h-3" />
                              <span className={isOverdue ? 'text-red-600 font-bold' : ''}>
                                {task.dueDate}
                              </span>
                            </div>
                          </div>

                          {/* Quick Mobile/Click Move Bar */}
                          {canMove && (
                            <div className="mt-2.5 pt-2 border-t border-stone-50 flex items-center justify-between text-[10px] text-stone-400">
                              <span>Move status:</span>
                              <div className="flex items-center space-x-1">
                                {task.status !== 'todo' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuickStatusChange(task, 'todo');
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold"
                                  >
                                    To Do
                                  </button>
                                )}
                                {task.status !== 'in_progress' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuickStatusChange(task, 'in_progress');
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold"
                                  >
                                    In Progress
                                  </button>
                                )}
                                {task.status !== 'done' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleQuickStatusChange(task, 'done');
                                    }}
                                    className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold"
                                  >
                                    Done
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW: LIST VIEW (Alternative view) */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filteredTasks.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-stone-200/80 shadow-xs">
              <CheckSquare className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#0F1D38]">No matching tasks found</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
                Try adjusting your search criteria or create a new assessment task for Team 2.
              </p>
              <button
                onClick={onOpenCreateModal}
                className="mt-4 px-4 py-2 rounded-xl bg-orange-100 text-[#F37A1F] text-xs font-bold hover:bg-orange-200 transition"
              >
                Create Assessment Task
              </button>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isAssignedToMe = checkIsAssignedToMe(task);
              const isCreatedByMe = task.createdBy === userProfile?.uid;
              const canEdit = isAdmin || isCreatedByMe;
              const canChangeStatus = isAdmin || isAssignedToMe || isCreatedByMe;
              const canDelete = isAdmin || isCreatedByMe;
              const isOverdue = task.status !== 'done' && task.dueDate < todayStr;

              return (
                <div
                  key={task.id}
                  className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all hover:shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    task.status === 'done'
                      ? 'border-emerald-200/70 bg-emerald-50/20 opacity-80'
                      : isOverdue
                      ? 'border-red-300/80 bg-red-50/20'
                      : 'border-stone-200/80'
                  }`}
                >
                  {/* Left side details */}
                  <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                    <button
                      disabled={!canChangeStatus}
                      onClick={() => {
                        if (!userProfile) return;
                        const next =
                          task.status === 'todo'
                            ? 'in_progress'
                            : task.status === 'in_progress'
                            ? 'done'
                            : 'todo';
                        updateTask(task.id, { status: next }, userProfile, task.title);
                      }}
                      className={`mt-1 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition ${
                        task.status === 'done'
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : task.status === 'in_progress'
                          ? 'border-amber-500 bg-amber-50 text-amber-600'
                          : 'border-stone-300 hover:border-[#F37A1F]'
                      } ${!canChangeStatus ? 'cursor-not-allowed opacity-60' : ''}`}
                      title={canChangeStatus ? 'Toggle status' : 'Only assignee or Admin can change status'}
                    >
                      {task.status === 'done' && <CheckCircle2 className="w-4 h-4" />}
                      {task.status === 'in_progress' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3
                          className={`text-sm sm:text-base font-bold text-[#0F1D38] leading-tight ${
                            task.status === 'done' ? 'line-through text-stone-500' : ''
                          }`}
                        >
                          {task.title}
                        </h3>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                            task.priority === 'high'
                              ? 'bg-red-100 text-red-700'
                              : task.priority === 'medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {task.priority}
                        </span>
                        {isOverdue && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Overdue
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-stone-600 mb-2 leading-relaxed">
                        {task.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-500">
                        <div className="flex items-center space-x-1.5 font-medium">
                          <User className="w-3.5 h-3.5 text-[#F37A1F]" />
                          <span>
                            Assigned to: <strong className="text-stone-800">{getTaskAssigneeLabel(task)}</strong>
                            {task.assigneeEmail && (
                              <span className="text-[10px] text-stone-400 font-mono ml-1.5">
                                ({task.assigneeEmail})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-stone-400" />
                          <span>Due: {task.dueDate}</span>
                        </div>
                        <span className="text-stone-400">•</span>
                        <span>Created by: {getTaskCreatorLabel(task)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right side status select & actions */}
                  <div className="flex items-center space-x-3 shrink-0 self-end md:self-center pt-2 md:pt-0 border-t md:border-t-0 border-stone-100 w-full md:w-auto justify-between md:justify-end">
                    <select
                      disabled={!canChangeStatus}
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
                      className={`text-xs font-bold rounded-xl px-3 py-1.5 border ${
                        task.status === 'done'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : task.status === 'in_progress'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-stone-50 text-stone-700 border-stone-300'
                      } ${!canChangeStatus ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleNotifyAssignee(task)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-[#F37A1F] hover:bg-orange-50 transition"
                        title={`Prepare email draft for ${task.assigneeEmail || task.assignedToName}`}
                      >
                        <Mail className="w-4 h-4" />
                      </button>

                      {canEdit && (
                        <button
                          onClick={() => openEdit(task)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                          title="Edit task"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}

                      {canDelete && (
                        <button
                          onClick={() => handleDelete(task)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Delete task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Create / Edit Task Modal */}
      {(isCreateModalOpen || editingTask) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-stone-200 relative">
            <button
              onClick={() => {
                onCloseCreateModal();
                setEditingTask(null);
              }}
              className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-black text-[#0F1D38] mb-1">
              {editingTask
                ? 'Edit Assessment Task'
                : isAdmin
                  ? 'Create Assessment Task'
                  : 'Create My Task'}
            </h2>
            <p className="text-xs text-stone-500 mb-5">
              {isAdmin
                ? 'As Admin, you can assign each task to any team member, including yourself.'
                : `This task will be assigned to you, ${userProfile?.displayName || 'your account'}.`}
            </p>

            <form onSubmit={editingTask ? handleEditSubmit : handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0F1D38] mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter task title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F1D38] mb-1">
                  Description / Screening Guidelines
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter assessment guidelines, requirements, or instructions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0F1D38] mb-1">
                    {isAdmin ? 'Assignee *' : 'Assigned to'}
                  </label>
                  {isAdmin ? (
                    <select
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                    >
                      {assignableMembers.map((member) => (
                        <option key={member.uid} value={member.uid}>
                          {member.displayName} ({member.email})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm text-[#0F1D38]">
                      <User className="w-4 h-4 shrink-0 text-[#F37A1F]" />
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{userProfile?.displayName}</p>
                        <p className="text-[11px] text-stone-500 truncate">{userProfile?.email}</p>
                      </div>
                      <span className="ml-auto shrink-0 text-[10px] font-semibold text-stone-500">You</span>
                    </div>
                  )}

                  {/* Mail notification target indicator */}
                  {isAdmin && (() => {
                    const currentAssigneeUser =
                      teamMembers.find((m) => m.uid === assignedTo) || userProfile;
                    if (!currentAssigneeUser) return null;
                    const resolvedTarget = resolveMemberEmail(currentAssigneeUser, teamMembers);
                    return (
                      <div className="mt-2.5 p-2 rounded-xl bg-orange-50/80 border border-orange-200/60 text-xs text-stone-700 space-y-1.5">
                        <div className="flex items-center space-x-1.5 text-[#0F1D38] font-bold text-[11px]">
                          <Mail className="w-3.5 h-3.5 text-[#F37A1F]" />
                          <span>Email Draft Recipient:</span>
                        </div>
                        <p className="text-[11px] text-stone-600 font-mono truncate">
                          {resolvedTarget.email}
                        </p>
                        {!editingTask && (
                          <label className="flex items-center space-x-2 text-[11px] text-stone-700 cursor-pointer pt-1 border-t border-orange-100">
                            <input
                              type="checkbox"
                              checked={sendEmailNotification}
                              onChange={(e) => setSendEmailNotification(e.target.checked)}
                              className="rounded text-[#F37A1F] focus:ring-[#F37A1F] w-3.5 h-3.5"
                            />
                            <span className="font-semibold text-[#0F1D38]">
                              Prepare email draft for {resolvedTarget.name || 'assignee'}
                            </span>
                          </label>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F1D38] mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F1D38] mb-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    onCloseCreateModal();
                    setEditingTask(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-stone-600 font-bold text-xs hover:bg-stone-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#F37A1F] text-white font-bold text-xs hover:bg-[#df6a14] transition shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Email Notification Confirmation & 1-Click Action Modal */}
      {notificationModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-stone-200 relative">
            <button
              onClick={() => {
                setNotificationModalData(null);
                setCopiedDraft(false);
              }}
              className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#F37A1F] flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-[#F37A1F]" />
            </div>

            <h2 className="text-xl font-black text-[#0F1D38] mb-1">
              Email Draft Ready
            </h2>
            <p className="text-xs text-stone-500 mb-4">
              No email has been sent. A draft is ready for{' '}
              <strong className="text-stone-800">{notificationModalData.assigneeName}</strong>:
            </p>

            <div className="rounded-2xl border border-stone-200 overflow-hidden mb-5">
              <div className="bg-[#0F1D38] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-orange-200">Team 2 Hub</p>
                <p className="mt-1 text-xs text-white/80">
                  To: <span className="font-semibold text-white break-all">{notificationModalData.assigneeEmail}</span>
                </p>
                <p className="mt-1 text-xs text-white/80">
                  Subject: <span className="font-semibold text-white">{notificationModalData.subject}</span>
                </p>
              </div>
              <div className="bg-white px-4 py-4 max-h-64 overflow-y-auto">
                <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5 text-stone-700">
                  {notificationModalData.bodyText}
                </pre>
              </div>
            </div>

            {/* Open the prepared draft in a mail client */}
            <div className="space-y-2.5">
              <a
                href={notificationModalData.gmailComposeUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-[#F37A1F] hover:bg-[#df6a14] text-white font-bold text-xs transition shadow-sm"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Email Draft</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `To: ${notificationModalData.assigneeEmail}\nSubject: ${notificationModalData.subject}\n\n${notificationModalData.bodyText}`
                  );
                  setCopiedDraft(true);
                  setTimeout(() => setCopiedDraft(false), 2500);
                }}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50 transition"
              >
                {copiedDraft ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">Copied Full Email Draft!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-stone-400" />
                    <span>Copy Email Text Draft</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-5 pt-3 border-t border-stone-100 flex justify-end">
              <button
                onClick={() => {
                  setNotificationModalData(null);
                  setCopiedDraft(false);
                }}
                className="px-5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
