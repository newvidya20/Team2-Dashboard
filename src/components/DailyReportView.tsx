import React, { useState, useEffect } from 'react';
import {
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronDown,
  User,
  History,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DailyReport, UserProfile } from '../types';
import { saveDailyReport } from '../services/db';
import { Avatar } from './Avatar';
import { getLocalDateKey } from '../utils/date';

interface DailyReportViewProps {
  dailyReports: DailyReport[];
  teamMembers: UserProfile[];
}

export const DailyReportView: React.FC<DailyReportViewProps> = ({
  dailyReports,
  teamMembers,
}) => {
  const { userProfile, isAdmin } = useAuth();

  const todayStr = getLocalDateKey();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Form fields
  const [whatIDid, setWhatIDid] = useState('');
  const [blockers, setBlockers] = useState('');
  const [planTomorrow, setPlanTomorrow] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Admin filter toggle
  const [viewMode, setViewMode] = useState<'writer' | 'team'>('writer');

  // Find existing report for this user and selected date
  const existingReport = dailyReports.find(
    (r) => r.userId === userProfile?.uid && r.date === selectedDate
  );

  // Sync form when selected date or existing report changes
  useEffect(() => {
    if (existingReport) {
      setWhatIDid(existingReport.whatIDid);
      setBlockers(existingReport.blockers || '');
      setPlanTomorrow(existingReport.planTomorrow || '');
    } else {
      // Defaults for new report
      setWhatIDid('');
      setBlockers('');
      setPlanTomorrow('');
    }
  }, [selectedDate, existingReport]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    setSubmitting(true);
    setSuccessNotice(null);

    try {
      await saveDailyReport(
        {
          id: existingReport?.id,
          userId: userProfile.uid,
          userName: userProfile.displayName,
          userEmail: userProfile.email,
          date: selectedDate,
          whatIDid: whatIDid.trim(),
          blockers: blockers.trim(),
          planTomorrow: planTomorrow.trim(),
        },
        userProfile
      );

      setSuccessNotice(
        existingReport
          ? `Daily report for ${selectedDate} updated successfully!`
          : `Daily report for ${selectedDate} submitted successfully!`
      );
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (err) {
      console.error('Failed to save daily report:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // User's own past reports
  const myReports = dailyReports
    .filter(
      (r) => r.userId === userProfile?.uid
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  // Today's team reports (for Admin view)
  const todayTeamReports = dailyReports.filter((r) => r.date === todayStr);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F1D38]">
            Daily EOD Report
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Log your daily work, blockers, and plans for the next day.
          </p>
        </div>

        {isAdmin && (
          <div className="flex bg-stone-100 p-1 rounded-2xl self-start sm:self-auto border border-stone-200">
            <button
              onClick={() => setViewMode('writer')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                viewMode === 'writer'
                  ? 'bg-white text-[#0F1D38] shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              My Report
            </button>
            <button
              onClick={() => setViewMode('team')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                viewMode === 'team'
                  ? 'bg-white text-[#F37A1F] shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>Team Submissions</span>
              <span className="bg-orange-100 text-[#F37A1F] text-[10px] px-1.5 py-0.2 rounded-full">
                {todayTeamReports.length}
              </span>
            </button>
          </div>
        )}
      </div>

      {viewMode === 'writer' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: The Report Form (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs relative">
              {/* Date selection & status badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-stone-100 gap-3">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-[#F37A1F]" />
                  <span className="text-xs font-bold text-[#0F1D38]">Report Date:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    max={todayStr}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-1 rounded-xl border border-stone-200 text-xs font-bold text-[#0F1D38] focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                  />
                </div>

                <div>
                  {existingReport ? (
                    <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Report Saved (Editable)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800">
                      <span>Not Submitted Yet</span>
                    </span>
                  )}
                </div>
              </div>

              {successNotice && (
                <div className="my-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{successNotice}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5 mt-6">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#0F1D38]">
                      What I Did Today *
                    </label>
                    <span className="text-[11px] text-stone-400">Bulleted summary</span>
                  </div>
                  <textarea
                    required
                    rows={4}
                    placeholder="• Summarize the work you completed today..."
                    value={whatIDid}
                    onChange={(e) => setWhatIDid(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F] leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F1D38] mb-1">
                    Blockers / Bottlenecks Encountered
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Describe any blockers, pending documents, or system issues encountered..."
                    value={blockers}
                    onChange={(e) => setBlockers(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F1D38] mb-1">
                    Plan for Tomorrow
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter key follow-ups and priority tasks for tomorrow..."
                    value={planTomorrow}
                    onChange={(e) => setPlanTomorrow(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl border border-stone-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 rounded-2xl bg-[#F37A1F] text-white font-bold text-sm hover:bg-[#df6a14] transition shadow-md disabled:opacity-60 flex items-center justify-center space-x-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span>
                      {submitting
                        ? 'Saving Daily Report...'
                        : existingReport
                        ? 'Update Report for ' + selectedDate
                        : 'Submit Daily Report for ' + selectedDate}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Previous Reports by Current User (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <h2 className="text-lg font-black text-[#0F1D38]">My Report History</h2>
              <p className="text-xs text-stone-500">Review your past daily logs</p>
            </div>

            <div className="bg-white rounded-3xl border border-stone-200/80 p-5 shadow-xs divide-y divide-stone-100 max-h-[600px] overflow-y-auto">
              {myReports.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-400">
                  No previous reports found.
                </div>
              ) : (
                myReports.map((report) => (
                  <div key={report.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#0F1D38]">
                        📅 {report.date}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-[#F37A1F]">
                        Daily report
                      </span>
                    </div>

                    <p className="text-xs text-stone-600 line-clamp-3 whitespace-pre-line leading-relaxed">
                      {report.whatIDid}
                    </p>

                    {report.blockers && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-xl">
                        <strong>Blockers:</strong> {report.blockers}
                      </div>
                    )}

                    <div className="pt-1">
                      <button
                        onClick={() => setSelectedDate(report.date)}
                        className="text-[11px] font-bold text-[#F37A1F] hover:underline"
                      >
                        Load into Editor →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Admin Team View for Today */
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-stone-200/80 shadow-xs">
            <h2 className="text-lg font-black text-[#0F1D38] mb-1">
              Team 2 Submissions for Today ({todayStr})
            </h2>
            <p className="text-xs text-stone-500 mb-6">
              {todayTeamReports.length} daily reports submitted today.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {teamMembers.length === 0 && (
                <p className="text-sm text-stone-500">No team members yet.</p>
              )}
              {teamMembers.map((member) => {
                const rep = dailyReports.find(
                  (r) => r.userId === member.uid && r.date === todayStr
                );
                return (
                  <div
                    key={member.uid}
                    className={`rounded-2xl p-5 border ${
                      rep
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : 'border-stone-200 bg-stone-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Avatar
                          name={member.displayName}
                          photoURL={member.photoURL}
                          className="w-8 h-8 rounded-full"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[#0F1D38] truncate">{member.displayName}</h4>
                          <p className="text-[10px] text-stone-400 truncate">{member.email}</p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          rep ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {rep ? 'Report submitted' : 'No report'}
                      </span>
                    </div>

                    {rep ? (
                      <div className="space-y-2 text-xs text-stone-600">
                        <p className="whitespace-pre-line line-clamp-4">{rep.whatIDid}</p>
                        {rep.blockers && (
                          <p className="text-[11px] text-red-700 bg-red-50 p-2 rounded-xl">
                            <strong>Blockers:</strong> {rep.blockers}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400 italic">No report submitted yet today.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
