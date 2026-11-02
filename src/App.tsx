/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { AuthPage } from './components/AuthPage';
import { Dashboard } from './components/Dashboard';
import { TasksView } from './components/TasksView';
import { DailyReportView } from './components/DailyReportView';
import { WeeklyReportView } from './components/WeeklyReportView';
import { TeamView } from './components/TeamView';
import { ActivityLogView } from './components/ActivityLogView';
import { CertificateView } from './components/CertificateView';
import { TeamCalendar } from './components/TeamCalendar';
import { Chatbot } from './components/Chatbot';
import { SettingsModal } from './components/SettingsModal';
import {
  subscribeToTasks,
  subscribeToDailyReports,
  subscribeToUsers,
  subscribeToActivityLogs,
  subscribeToCalendarLeaves,
  subscribeToCalendarNotes,
  subscribeToWeeklySummaries,
  getSettings,
} from './services/db';
import { TaskItem, DailyReport, UserProfile, ActivityLog, AppSettings, CalendarLeave, CalendarNote, WeeklySummary } from './types';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { userProfile, isAdmin, loading: authLoading } = useAuth();

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarLastSeenAt, setCalendarLastSeenAt] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [calendarLeaves, setCalendarLeaves] = useState<CalendarLeave[]>([]);
  const [calendarNotes, setCalendarNotes] = useState<CalendarNote[]>([]);
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    reportRecipientEmail: '',
    teamName: '',
  });

  const openNewTaskModal = () => {
    setCurrentTab('tasks');
    setIsNewTaskModalOpen(true);
  };

  useEffect(() => {
    if (!userProfile) {
      setCalendarLastSeenAt(null);
      return;
    }
    const storageKey = `team-calendar-last-seen:${userProfile.uid}`;
    const storedValue = Number(localStorage.getItem(storageKey));
    const lastSeen = Number.isFinite(storedValue) && storedValue >= 0 ? storedValue : 0;
    setCalendarLastSeenAt(lastSeen);
    localStorage.setItem(storageKey, String(lastSeen));
  }, [userProfile?.uid]);

  useEffect(() => {
    if (!isCalendarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCalendarOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isCalendarOpen]);

  const calendarUnreadCount = calendarLastSeenAt === null
    ? 0
    : [
        ...calendarLeaves.map((leave) => leave.updatedAt),
        ...calendarNotes.map((note) => note.updatedAt),
        ...weeklySummaries.map((summary) => summary.updatedAt),
      ].filter((timestamp) => {
        const eventTime = Date.parse(timestamp);
        return Number.isFinite(eventTime) && eventTime > calendarLastSeenAt;
      }).length;

  const openCalendar = () => {
    if (userProfile) {
      const newestUpdate = Math.max(
        Date.now(),
        ...calendarLeaves.map((leave) => Date.parse(leave.updatedAt) || 0),
        ...calendarNotes.map((note) => Date.parse(note.updatedAt) || 0),
        ...weeklySummaries.map((summary) => Date.parse(summary.updatedAt) || 0)
      );
      const storageKey = `team-calendar-last-seen:${userProfile.uid}`;
      localStorage.setItem(storageKey, String(newestUpdate));
      setCalendarLastSeenAt(newestUpdate);
    }
    setIsCalendarOpen(true);
  };

  useEffect(() => {
    if (!userProfile) {
      setTasks([]);
      setDailyReports([]);
      setTeamMembers([]);
      setActivityLogs([]);
      setCalendarLeaves([]);
      setCalendarNotes([]);
      setWeeklySummaries([]);
      setSettings({ reportRecipientEmail: '', teamName: '' });
      return;
    }

    let unsubTasks = () => {};
    let unsubReports = () => {};
    let unsubUsers = () => {};
    let unsubLogs = () => {};
    let unsubCalendarLeaves = () => {};
    let unsubCalendarNotes = () => {};
    let unsubWeeklySummaries = () => {};
    let active = true;

    async function initLocalWorkspace() {
      try {
        const liveSettings = await getSettings();
        if (active && liveSettings) {
          setSettings(liveSettings);
        }
      } catch (err) {
        console.error('Could not initialize local workspace:', err);
      }

      if (!active) return;
      unsubTasks = subscribeToTasks((newTasks) => {
        setTasks(newTasks);
      });

      unsubReports = subscribeToDailyReports((newReports) => {
        setDailyReports(newReports);
      });

      unsubUsers = subscribeToUsers((newUsers) => {
        setTeamMembers(newUsers);
      });

      unsubLogs = subscribeToActivityLogs((logs) => {
        setActivityLogs(logs);
      });
      unsubCalendarLeaves = subscribeToCalendarLeaves(setCalendarLeaves);
      unsubCalendarNotes = subscribeToCalendarNotes(setCalendarNotes);
      unsubWeeklySummaries = subscribeToWeeklySummaries(setWeeklySummaries);
    }

    void initLocalWorkspace();

    return () => {
      active = false;
      unsubTasks();
      unsubReports();
      unsubUsers();
      unsubLogs();
      unsubCalendarLeaves();
      unsubCalendarNotes();
      unsubWeeklySummaries();
    };
  }, [userProfile?.uid, isAdmin]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FBF9F5] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#E06610] to-[#F37A1F] flex items-center justify-center text-white font-extrabold text-2xl shadow-md animate-pulse">
          L2
        </div>
        <div className="flex items-center space-x-2 text-stone-500 text-xs font-semibold">
          <Loader2 className="w-4 h-4 animate-spin text-[#F37A1F]" />
          <span>Loading Loanbazaar Team 2 Hub...</span>
        </div>
      </div>
    );
  }

  // If not logged in, show normal login / signup page
  if (!userProfile) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#0F1D38] flex font-sans selection:bg-orange-200 selection:text-orange-900">
      {/* Desktop Vertical Left Sidebar */}
      <div className="hidden lg:block shrink-0 sticky top-0 h-screen">
        <Sidebar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          tasks={tasks}
          dailyReports={dailyReports}
        />
      </div>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden animate-in fade-in duration-150">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-50 h-full">
            <Sidebar
              currentTab={currentTab}
              onTabChange={(tab) => {
                setCurrentTab(tab);
                setMobileMenuOpen(false);
              }}
              onOpenSettings={() => {
                setIsSettingsModalOpen(true);
                setMobileMenuOpen(false);
              }}
              tasks={tasks}
              dailyReports={dailyReports}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          onOpenNewTask={openNewTaskModal}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          onOpenCalendar={openCalendar}
          calendarUnreadCount={calendarUnreadCount}
        />

        {/* View Content */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
          {currentTab === 'dashboard' && (
            <Dashboard
              tasks={tasks}
              dailyReports={dailyReports}
              activityLogs={activityLogs}
              teamMembers={teamMembers}
              onNavigate={setCurrentTab}
              onOpenNewTask={openNewTaskModal}
            />
          )}

          {currentTab === 'tasks' && (
            <TasksView
              tasks={tasks}
              teamMembers={teamMembers}
              isCreateModalOpen={isNewTaskModalOpen}
              onCloseCreateModal={() => setIsNewTaskModalOpen(false)}
              onOpenCreateModal={() => setIsNewTaskModalOpen(true)}
            />
          )}

          {currentTab === 'daily-report' && (
            <DailyReportView
              dailyReports={dailyReports}
              teamMembers={teamMembers}
            />
          )}

          {currentTab === 'weekly-report' && (
            <WeeklyReportView
              tasks={tasks}
              settings={settings}
            />
          )}

          {currentTab === 'team' && (
            <TeamView
              teamMembers={teamMembers}
              tasks={tasks}
              dailyReports={dailyReports}
            />
          )}

          {currentTab === 'activity' && (
            <ActivityLogView
              activityLogs={activityLogs}
              teamMembers={teamMembers}
            />
          )}

          {currentTab === 'certificates' && (
            <CertificateView teamMembers={teamMembers} />
          )}
        </main>
      </div>

      {isCalendarOpen && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsCalendarOpen(false);
          }}
          className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[#0F1D38]/50 p-3 backdrop-blur-sm sm:p-6"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Team calendar"
            className="my-auto w-full max-w-5xl"
          >
            <TeamCalendar
              calendarLeaves={calendarLeaves}
              calendarNotes={calendarNotes}
              weeklySummaries={weeklySummaries}
              teamMembers={teamMembers}
              onClose={() => setIsCalendarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Floating Team 2 AI Assistant Drawer on Every Page */}
      <Chatbot
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        tasks={tasks}
        dailyReports={dailyReports}
        teamMembers={teamMembers}
        activityLogs={activityLogs}
        onTaskCreated={() => {
          // Task created callback
        }}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSettingsSaved={(newSettings) => setSettings(newSettings)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
