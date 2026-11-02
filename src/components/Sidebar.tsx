import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  CalendarDays,
  Users,
  History,
  Settings,
  LogOut,
  ShieldCheck,
  Award,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TaskItem, DailyReport } from '../types';
import { Avatar } from './Avatar';
import { getLocalDateKey } from '../utils/date';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenSettings: () => void;
  tasks: TaskItem[];
  dailyReports: DailyReport[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  onOpenSettings,
  tasks,
  dailyReports,
}) => {
  const { userProfile, isAdmin, logout } = useAuth();
  const queueSeenStorageKey = userProfile ? `team2-task-queue-seen:${userProfile.uid}` : '';
  const [taskQueueSeenAt, setTaskQueueSeenAt] = useState(() => {
    if (!queueSeenStorageKey) return '';
    try {
      return localStorage.getItem(queueSeenStorageKey) || '';
    } catch (error) {
      console.error('Could not read task queue seen state:', error);
      return '';
    }
  });

  const todayStr = getLocalDateKey();
  const myOpenTasks = tasks.filter((t) => t.assignedTo === userProfile?.uid && t.status !== 'done');
  const unseenTaskCount = taskQueueSeenAt
    ? myOpenTasks.filter((task) => task.createdAt > taskQueueSeenAt).length
    : myOpenTasks.length;
  const myReportToday = dailyReports.find(
    (r) => r.userId === userProfile?.uid && r.date === todayStr
  );

  const markTaskQueueSeen = () => {
    if (!queueSeenStorageKey) return;
    const seenAt = new Date().toISOString();
    try {
      localStorage.setItem(queueSeenStorageKey, seenAt);
      setTaskQueueSeenAt(seenAt);
    } catch (error) {
      console.error('Could not save task queue seen state:', error);
      setTaskQueueSeenAt(seenAt);
    }
  };

  useEffect(() => {
    if (!queueSeenStorageKey) {
      setTaskQueueSeenAt('');
      return;
    }
    try {
      setTaskQueueSeenAt(localStorage.getItem(queueSeenStorageKey) || '');
    } catch (error) {
      console.error('Could not read task queue seen state:', error);
      setTaskQueueSeenAt('');
    }
  }, [queueSeenStorageKey]);

  useEffect(() => {
    if (currentTab === 'tasks') markTaskQueueSeen();
  }, [currentTab, tasks]);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'tasks',
      label: 'Tasks Queue',
      icon: CheckSquare,
      badge: unseenTaskCount > 0 ? unseenTaskCount : null,
      badgeColor: 'bg-orange-100 text-[#F37A1F]',
    },
    {
      id: 'daily-report',
      label: 'Daily Report',
      icon: FileText,
      badge: myReportToday ? 'Done' : null,
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'weekly-report',
      label: 'Weekly Report',
      icon: CalendarDays,
      badge: null,
    },
    {
      id: 'team',
      label: 'Our Team',
      icon: Users,
      badge: null,
    },
    {
      id: 'activity',
      label: 'Activity Log',
      icon: History,
      badge: null,
    },
    {
      id: 'certificates',
      label: 'My Certificates',
      icon: Award,
      badge: null,
    },
  ];

  return (
    <aside className="w-64 xl:w-72 bg-white border-r border-stone-200/90 flex flex-col shrink-0 select-none shadow-xs z-30 min-h-screen">
      {/* Brand & Mandate Header */}
      <div className="p-5 border-b border-stone-100">
        <div
          className="cursor-pointer group space-y-2.5"
          onClick={() => onTabChange('dashboard')}
        >
          <div className="flex flex-col items-start gap-2">
            <img
              src="/logo.png"
              alt="Loanbazaar"
              className="block h-auto w-full max-w-[250px] object-contain object-left group-hover:scale-102 transition-transform duration-200"
            />
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 text-[#F37A1F] self-start mt-1">
              Lead Assessment Team
            </span>
          </div>
        </div>

      </div>

      {/* Vertical Navigation Links */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-stone-400">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'tasks') markTaskQueueSeen();
                onTabChange(item.id);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-[#F37A1F] text-white shadow-sm'
                  : 'text-stone-600 hover:text-[#0F1D38] hover:bg-stone-50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-stone-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : item.badgeColor
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Profile Footer */}
      <div className="p-4 border-t border-stone-100 bg-[#FBF9F5]/70 space-y-3">
        {/* Current User Card */}
        <div className="flex items-center justify-between p-2 rounded-2xl bg-white border border-stone-200/80 shadow-2xs">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="relative shrink-0">
              <Avatar
                name={userProfile?.displayName || ''}
                photoURL={userProfile?.photoURL}
                className="w-9 h-9 rounded-xl ring-2 ring-orange-100"
              />
              {isAdmin && (
                <span className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-[#0F1D38] truncate">
                {userProfile?.displayName}
              </p>
              <p className="text-[10px] text-stone-400 truncate leading-tight">
                {userProfile?.email}
              </p>
              <span
                className={`inline-block mt-0.5 text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded-md ${
                  isAdmin ? 'bg-orange-100 text-[#F37A1F]' : 'bg-stone-100 text-stone-600'
                }`}
              >
                {userProfile?.role}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-0.5 shrink-0">
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-xl text-stone-400 hover:text-[#0F1D38] hover:bg-stone-100 transition"
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={logout}
              className="p-1.5 rounded-xl text-stone-400 hover:text-red-600 hover:bg-red-50 transition"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
