import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Clock,
  Plus,
  Menu,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  currentTab: string;
  onOpenNewTask: () => void;
  onToggleMobileMenu: () => void;
  onOpenCalendar: () => void;
  calendarUnreadCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenNewTask,
  onToggleMobileMenu,
  onOpenCalendar,
  calendarUnreadCount,
}) => {
  const { userProfile, isAdmin } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

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
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getPageTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return 'Team 2 Overview';
      case 'tasks':
        return 'Assessment Tasks Queue';
      case 'daily-report':
        return 'Daily EOD Reporting';
      case 'weekly-report':
        return 'Weekly Executive Report';
      case 'team':
        return 'Our Team Specialists';
      case 'activity':
        return 'Operational Activity Log';
      case 'certificates':
        return 'My Certificates';
      default:
        return 'Dashboard';
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-stone-200/90 px-4 sm:px-8 py-3.5 flex items-center justify-between">
      {/* Left Title & Mobile Menu Button */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-xl text-stone-600 hover:bg-stone-100 transition"
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-lg sm:text-xl font-black text-[#0F1D38] tracking-tight">
            {getPageTitle(currentTab)}
          </h1>
          <p className="text-[11px] text-stone-400 font-medium hidden sm:block">
            Loanbazaar Lead Assessment & Initial Response
          </p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={onOpenCalendar}
          aria-label={calendarUnreadCount > 0
            ? `Open team calendar, ${calendarUnreadCount} new updates`
            : 'Open team calendar'}
          title="Team Calendar"
          className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#F37A1F] focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
        >
          <CalendarDays className="h-5 w-5" />
          {calendarUnreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-red-600 shadow-sm"
            >
            </span>
          )}
        </button>

        {/* Live Clock Badge */}
        <div className="hidden md:flex items-center space-x-2 bg-[#FBF9F5] px-3.5 py-1.5 rounded-xl border border-stone-200 text-stone-700">
          <Clock className="w-4 h-4 text-[#F37A1F]" />
          <span className="text-xs font-black tabular-nums text-[#0F1D38]">
            {currentTime || '--:--:--'}
          </span>
          <span className="text-stone-300">|</span>
          <span className="text-[11px] font-semibold text-stone-500">{currentDate}</span>
        </div>

        {/* Quick New Task Button */}
        <button
          onClick={onOpenNewTask}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#F37A1F] text-white text-xs font-bold hover:bg-[#df6a14] transition shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>
    </header>
  );
};
