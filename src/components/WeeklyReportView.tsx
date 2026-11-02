import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Send,
  Copy,
  Check,
  FileText,
  Sparkles,
  CheckSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TaskItem, AppSettings } from '../types';
import { getWeeklySummary, saveWeeklySummary } from '../services/db';
import { getLocalDateKey } from '../utils/date';

interface WeeklyReportViewProps {
  tasks: TaskItem[];
  settings: AppSettings;
}

interface ReportItem {
  id: string;
  group: 'Completed tasks this week' | 'Pending tasks';
  text: string;
}

function localDateFromTimestamp(timestamp: string): string {
  return getLocalDateKey(new Date(timestamp));
}

export const WeeklyReportView: React.FC<WeeklyReportViewProps> = ({
  tasks,
  settings,
}) => {
  const { userProfile, isAdmin } = useAuth();
  const today = new Date();
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + (monday.getDay() === 0 ? -6 : 1 - monday.getDay()));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const mondayKey = getLocalDateKey(monday);
  const sundayKey = getLocalDateKey(sunday);
  const thursday = new Date(today);
  thursday.setDate(today.getDate() + (4 - (today.getDay() || 7)));
  const weekOneMonday = new Date(thursday.getFullYear(), 0, 4);
  weekOneMonday.setDate(weekOneMonday.getDate() - ((weekOneMonday.getDay() + 6) % 7));
  const mondayUtc = Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate());
  const weekOneMondayUtc = Date.UTC(
    weekOneMonday.getFullYear(),
    weekOneMonday.getMonth(),
    weekOneMonday.getDate()
  );
  const currentWeekId = `${thursday.getFullYear()}-W${String(
    1 + Math.round((mondayUtc - weekOneMondayUtc) / 604800000)
  ).padStart(2, '0')}`;
  const weekRangeLabel = `${monday.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} – ${sunday.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const selectionInitialized = useRef(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const reportTasks = useMemo(
    () => tasks.filter((task) => {
      const updatedDate = localDateFromTimestamp(task.updatedAt);
      return task.status !== 'done' || (updatedDate >= mondayKey && updatedDate <= sundayKey);
    }),
    [tasks, mondayKey, sundayKey]
  );
  const completedTaskCount = reportTasks.filter(
    (task) => {
      const updatedDate = localDateFromTimestamp(task.updatedAt);
      return task.status === 'done' && updatedDate >= mondayKey && updatedDate <= sundayKey;
    }
  ).length;
  const pendingTaskCount = reportTasks.filter((task) => task.status !== 'done').length;

  const reportItems = useMemo<ReportItem[]>(() => {
    return reportTasks.map((task) => {
      const updatedDate = localDateFromTimestamp(task.updatedAt);
      const isCompletedThisWeek = task.status === 'done' &&
        updatedDate >= mondayKey &&
        updatedDate <= sundayKey;
      const group = isCompletedThisWeek ? 'Completed tasks this week' : 'Pending tasks';
      const details = [
        task.title,
        `assigned to ${task.assignedToName}`,
        task.dueDate ? `due ${task.dueDate}` : '',
      ].filter(Boolean).join('; ');
      return { id: `task:${task.id}`, group, text: details };
    });
  }, [reportTasks, mondayKey, sundayKey]);

  useEffect(() => {
    if (selectionInitialized.current || reportItems.length === 0) return;
    selectionInitialized.current = true;
    setSelectedItems(Object.fromEntries(reportItems.map((item) => [item.id, true])));
  }, [reportItems]);

  useEffect(() => {
    let active = true;
    const loadSummary = async () => {
      try {
        const existing = await getWeeklySummary(currentWeekId);
        if (active) setExecutiveSummary(existing?.summary || '');
      } catch (error) {
        console.error('Error loading weekly summary:', error);
        if (active) setStatusMsg('Could not load the saved weekly report.');
      }
    };
    void loadSummary();
    return () => {
      active = false;
    };
  }, [currentWeekId]);

  const selectedReportItems = reportItems.filter((item) => selectedItems[item.id]);

  const generateDraft = () => {
    const groupedItems = new Map<string, string[]>();
    for (const item of selectedReportItems) {
      const group = groupedItems.get(item.group) || [];
      group.push(`• ${item.text}`);
      groupedItems.set(item.group, group);
    }
    const sections = [...groupedItems.entries()]
      .map(([group, entries]) => `${group.toUpperCase()}\n${entries.join('\n')}`);
    const draft = [
      `WEEKLY TEAM REPORT — ${currentWeekId} (${weekRangeLabel})`,
      ...sections,
      extraNotes.trim() ? `ADMIN NOTES\n${extraNotes.trim()}` : '',
    ].filter(Boolean).join('\n\n');
    setExecutiveSummary(sections.length || extraNotes.trim()
      ? draft
      : `WEEKLY TEAM REPORT — ${currentWeekId} (${weekRangeLabel})\n\nNo tasks selected for this report.`);
    setStatusMsg('Draft generated. Review and save it when ready.');
  };

  const handleSaveSummary = async () => {
    if (!isAdmin || !userProfile) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      await saveWeeklySummary(
        {
          weekId: currentWeekId,
          summary: executiveSummary,
          totalLeads: 0,
          updatedBy: userProfile.displayName,
          updatedAt: new Date().toISOString(),
        },
        userProfile
      );
      setStatusMsg('Weekly report saved for the team.');
    } catch (error) {
      console.error('Failed to save weekly report:', error);
      setStatusMsg(error instanceof Error ? error.message : 'Could not save the weekly report.');
    } finally {
      setSaving(false);
    }
  };

  const generateEmailDraft = () => {
    const subject = `[Loanbazaar Team 2] Weekly Team Report - ${currentWeekId}`;
    const body = [
      executiveSummary,
      '',
      `TEAM SUMMARY (${weekRangeLabel})`,
      `Completed tasks this week: ${completedTaskCount}`,
      `Pending tasks: ${pendingTaskCount}`,
      '',
      `Report compiled by: ${userProfile?.displayName || ''}`,
      ...(isAdmin ? [`Recipient: ${settings.reportRecipientEmail}`] : []),
    ].join('\n');
    return { subject, body };
  };

  const handleSendReport = () => {
    if (!isAdmin || !settings.reportRecipientEmail) return;
    const { subject, body } = generateEmailDraft();
    window.location.href = `mailto:${encodeURIComponent(settings.reportRecipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleCopyDraft = async () => {
    try {
      const { body } = generateEmailDraft();
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error('Could not copy weekly report draft:', error);
      setStatusMsg('Could not copy the report. Check clipboard permissions and try again.');
    }
  };

  const weekHeading = (
    <>
      <div className="flex items-center space-x-2 text-xs font-bold text-[#F37A1F] uppercase tracking-wider mb-1">
        <CalendarDays className="w-4 h-4" />
        <span>{isAdmin ? 'Weekly Report Preparation' : 'Team Weekly Report'}</span>
      </div>
      <h1 className="text-2xl sm:text-3xl font-black text-[#0F1D38]">Weekly Report • {currentWeekId}</h1>
      <p className="text-xs text-stone-500 mt-1">{weekRangeLabel}</p>
    </>
  );

  if (!isAdmin) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200 max-w-5xl">
        <header className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs">
          {weekHeading}
          <p className="text-sm text-stone-600 mt-5">
            This is the weekly report prepared by your admin. Team members can view the saved report but cannot edit or generate it.
          </p>
        </header>
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-[#F37A1F]" />
            <h2 className="text-lg font-black text-[#0F1D38]">Published Weekly Report</h2>
          </div>
          {executiveSummary.trim() ? (
            <div className="whitespace-pre-wrap text-sm text-stone-700 leading-relaxed">{executiveSummary}</div>
          ) : (
            <p className="rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">
              The admin has not saved this week’s report yet.
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>{weekHeading}</div>
        <div className="flex items-center gap-2 self-start">
          <button
            onClick={handleCopyDraft}
            disabled={!executiveSummary.trim()}
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-2xl bg-white border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50 transition shadow-xs disabled:opacity-50"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied Report' : 'Copy Report'}</span>
          </button>
          <button
            onClick={handleSendReport}
            disabled={!settings.reportRecipientEmail || !executiveSummary.trim()}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-[#F37A1F] text-white font-bold text-xs hover:bg-[#df6a14] transition shadow-md disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>Prepare Email</span>
          </button>
        </div>
      </header>

      {statusMsg && (
        <p role="status" className="rounded-xl bg-orange-50 px-4 py-3 text-xs font-semibold text-[#9a4c0c]">
          {statusMsg}
        </p>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Completed This Week', count: completedTaskCount, color: 'text-emerald-600' },
          { label: 'Pending Tasks', count: pendingTaskCount, color: 'text-amber-600' },
        ].map((metric) => (
          <div key={metric.label} className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400">{metric.label}</span>
            <div className={`text-3xl font-black mt-2 ${metric.color}`}>{metric.count}</div>
          </div>
        ))}
      </section>

      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[#F37A1F]" />
              <h2 className="text-lg font-black text-[#0F1D38]">Choose report content</h2>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Select completed tasks from this week and currently pending tasks for the report.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedItems(Object.fromEntries(reportItems.map((item) => [item.id, true])))}
              className="px-3 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold hover:bg-stone-200"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setSelectedItems({})}
              className="px-3 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold hover:bg-stone-200"
            >
              Clear all
            </button>
          </div>
        </div>

        {reportItems.length === 0 ? (
          <p className="rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">
            No completed or pending tasks are available.
          </p>
        ) : (
          <div className="space-y-5">
            {(['Completed tasks this week', 'Pending tasks'] as const).map((group) => (
              <fieldset key={group} className="space-y-2">
                <legend className="text-xs font-extrabold uppercase tracking-wide text-stone-500 mb-2">{group}</legend>
                {(() => {
                  const items = reportItems.filter((item) => item.group === group);
                  return items.length
                    ? items.map((item) => (
                        <label key={item.id} className="flex items-start gap-3 rounded-xl border border-stone-200 p-3 hover:border-orange-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedItems[item.id])}
                            onChange={(event) => setSelectedItems((current) => ({
                              ...current,
                              [item.id]: event.target.checked,
                            }))}
                            className="mt-0.5 accent-[#F37A1F]"
                          />
                          <span className="text-xs text-stone-700 leading-relaxed">{item.text}</span>
                        </label>
                      ))
                    : <p className="rounded-xl bg-stone-50 p-3 text-xs text-stone-400">No {group.toLowerCase()}.</p>;
                })()}
              </fieldset>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#F37A1F]" />
          <h2 className="text-lg font-black text-[#0F1D38]">Additional admin notes</h2>
        </div>
        <textarea
          rows={3}
          value={extraNotes}
          onChange={(event) => setExtraNotes(event.target.value)}
          placeholder="Add context, decisions, priorities, or any other notes for this week..."
          className="w-full p-4 rounded-2xl border border-stone-200 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
        />
        <button
          type="button"
          onClick={generateDraft}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F37A1F] text-white text-xs font-bold hover:bg-[#df6a14]"
        >
          <FileText className="w-4 h-4" />
          Generate Draft from Selected Items
        </button>
      </section>

      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-[#F37A1F]" />
              <h2 className="text-lg font-black text-[#0F1D38]">Review and publish to team</h2>
            </div>
            {isAdmin && (
              <p className="text-xs text-stone-500 mt-1">
                Recipient: <span className="font-bold text-stone-800">{settings.reportRecipientEmail || 'Not configured'}</span>
              </p>
            )}
          </div>
          <button
            onClick={handleSaveSummary}
            disabled={saving || !executiveSummary.trim()}
            className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Report for Team'}
          </button>
        </div>
        <textarea
          rows={14}
          value={executiveSummary}
          onChange={(event) => setExecutiveSummary(event.target.value)}
          placeholder="Generate a draft from selected items, or write the report here."
          className="w-full p-4 rounded-2xl border border-stone-200 bg-white text-xs sm:text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
        />
      </section>

    </div>
  );
};
