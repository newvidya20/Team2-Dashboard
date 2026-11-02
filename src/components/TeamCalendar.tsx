import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, FileText, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { deleteCalendarLeave, deleteCalendarNote, saveCalendarLeave, saveCalendarNote } from '../services/db';
import { CalendarLeave, CalendarNote, UserProfile, WeeklySummary } from '../types';
import { getLocalDateKey } from '../utils/date';
import { Avatar } from './Avatar';

interface TeamCalendarProps {
  calendarLeaves: CalendarLeave[];
  calendarNotes: CalendarNote[];
  weeklySummaries: WeeklySummary[];
  teamMembers: UserProfile[];
  onClose: () => void;
}

interface LeaveForm {
  userId: string;
  startDate: string;
  endDate: string;
  note: string;
}

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export const TeamCalendar: React.FC<TeamCalendarProps> = ({
  calendarLeaves,
  calendarNotes,
  weeklySummaries,
  teamMembers,
  onClose,
}) => {
  const { userProfile, isAdmin } = useAuth();
  const today = getLocalDateKey();
  const [month, setMonth] = useState(() => {
    const current = new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [editingLeave, setEditingLeave] = useState<CalendarLeave | null>(null);
  const [editingNote, setEditingNote] = useState<CalendarNote | null>(null);
  const [noteForm, setNoteForm] = useState({ title: '', note: '' });
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [form, setForm] = useState<LeaveForm>({
    userId: userProfile?.uid || '',
    startDate: today,
    endDate: today,
    note: '',
  });
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const teamMembersById = useMemo(
    () => new Map(teamMembers.map((member) => [member.uid, member])),
    [teamMembers]
  );
  const monthDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first.getFullYear(), first.getMonth(), first.getDate() - offset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
      const dateKey = getLocalDateKey(date);
      const leaves = calendarLeaves.filter(
        (leave) => leave.startDate <= dateKey && leave.endDate >= dateKey
      );
      const reports = weeklySummaries.filter(
        (summary) => summary.updatedAt && getLocalDateKey(new Date(summary.updatedAt)) === dateKey
      );
      const notes = calendarNotes.filter((item) => item.date === dateKey);
      return { date, dateKey, leaves, reports, notes, inMonth: date.getMonth() === month.getMonth() };
    });
  }, [calendarLeaves, calendarNotes, month, weeklySummaries]);

  const selectedLeaves = calendarLeaves.filter(
    (leave) => leave.startDate <= selectedDate && leave.endDate >= selectedDate
  );
  const selectedReports = weeklySummaries.filter(
    (summary) => summary.updatedAt && getLocalDateKey(new Date(summary.updatedAt)) === selectedDate
  );
  const selectedNotes = calendarNotes.filter((item) => item.date === selectedDate);

  const openNoteForm = (note?: CalendarNote) => {
    setEditingNote(note || null);
    setNoteForm(note ? { title: note.title, note: note.note } : { title: '', note: '' });
    setError(null);
    setNoteFormOpen(true);
  };

  const closeNoteForm = () => {
    if (saving) return;
    setNoteFormOpen(false);
    setEditingNote(null);
    setError(null);
  };

  const handleSaveNote = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveCalendarNote({ date: selectedDate, ...noteForm }, editingNote?.id);
      setNoteFormOpen(false);
      setEditingNote(null);
    } catch (saveError) {
      console.error('Could not save calendar note:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save the calendar note.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (note: CalendarNote) => {
    if (!window.confirm(`Remove "${note.title}" from the calendar?`)) return;
    setDeletingId(note.id);
    setError(null);
    try {
      await deleteCalendarNote(note.id);
    } catch (deleteError) {
      console.error('Could not remove calendar note:', deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Could not remove the calendar note.');
    } finally {
      setDeletingId(null);
    }
  };

  const openCreateForm = () => {
    setEditingLeave(null);
    setForm({
      userId: userProfile?.uid || '',
      startDate: selectedDate,
      endDate: selectedDate,
      note: '',
    });
    setError(null);
    setFormOpen(true);
  };

  const openEditForm = (leave: CalendarLeave) => {
    setEditingLeave(leave);
    setForm({
      userId: leave.userId,
      startDate: leave.startDate,
      endDate: leave.endDate,
      note: leave.note,
    });
    setError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingLeave(null);
    setError(null);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.startDate > form.endDate) {
      setError('The leave end date must be on or after its start date.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveCalendarLeave(form, editingLeave?.id);
      setSelectedDate(saved.startDate);
      setMonth(new Date(`${saved.startDate}T00:00:00`));
      setFormOpen(false);
      setEditingLeave(null);
    } catch (saveError) {
      console.error('Could not save leave entry:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save the leave entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (leave: CalendarLeave) => {
    if (!window.confirm(`Remove ${leave.userName}'s leave from the shared calendar?`)) return;
    setDeletingId(leave.id);
    setError(null);
    try {
      await deleteCalendarLeave(leave.id);
    } catch (deleteError) {
      console.error('Could not remove leave entry:', deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Could not remove the leave entry.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section aria-label="Team calendar" className="flex max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-xs">
      <div className="flex shrink-0 flex-col gap-3 border-b border-stone-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#F37A1F]">
            <CalendarDays className="h-4 w-4" />
            <span>Team Calendar</span>
          </div>
          <h2 className="text-xl font-black text-[#0F1D38]">Reports &amp; Leave</h2>
          <p className="mt-1 text-xs text-stone-500">Shared with the whole team. Changes appear automatically.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-bold text-orange-800">
            <span className="h-2 w-2 rounded-full bg-[#F37A1F]" />
            Weekly report saved
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-800">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Team leave
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-800">
            <span className="h-2 w-2 rounded-full bg-violet-500" />
            Notes
          </span>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-[#F37A1F] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#df6a14]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add leave
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close team calendar"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto">
      <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(250px,0.8fr)]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2 px-1">
            <h3 className="text-sm font-black text-[#0F1D38]">{monthLabel(month)}</h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                className="rounded-lg p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const current = new Date();
                  setMonth(new Date(current.getFullYear(), current.getMonth(), 1));
                  setSelectedDate(today);
                }}
                className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-stone-600 transition hover:bg-stone-100"
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                className="rounded-lg p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-stone-100 pb-2 text-center">
            {weekdays.map((day) => (
              <span key={day} className="text-[10px] font-bold uppercase tracking-wide text-stone-400 sm:text-xs">
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map(({ date, dateKey, leaves, reports, notes, inMonth }) => (
              <button
                key={dateKey}
                type="button"
                onClick={() => setSelectedDate(dateKey)}
                aria-label={`${dateLabel(dateKey)}${leaves.length ? `, ${leaves.length} leave entries` : ''}${reports.length ? `, ${reports.length} weekly reports saved` : ''}${notes.length ? `, ${notes.length} notes` : ''}`}
                aria-pressed={selectedDate === dateKey}
                className={`min-h-[54px] min-w-0 border-b border-r border-stone-100 p-1 text-left transition sm:min-h-[68px] sm:p-1.5 ${
                  selectedDate === dateKey
                    ? 'bg-orange-50 ring-1 ring-inset ring-orange-300'
                    : 'hover:bg-stone-50'
                } ${inMonth ? '' : 'bg-stone-50/50'}`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold sm:h-7 sm:w-7 sm:text-xs ${
                    dateKey === today
                      ? 'bg-[#F37A1F] text-white'
                      : inMonth
                      ? 'text-stone-700'
                      : 'text-stone-300'
                  }`}
                >
                  {date.getDate()}
                </span>
                <span className="mt-1 flex flex-col gap-0.5">
                  {reports.slice(0, 1).map((summary) => (
                    <span key={summary.weekId} className="truncate rounded bg-orange-100 px-1 py-0.5 text-[8px] font-bold text-orange-800 sm:text-[9px]">
                      Report saved
                    </span>
                  ))}
                  {leaves.slice(0, 2).map((leave) => (
                    <span key={leave.id} className="truncate rounded bg-blue-50 px-1 py-0.5 text-[8px] font-semibold text-blue-800 sm:text-[9px]">
                      {leave.userName.split(' ')[0]} leave
                    </span>
                  ))}
                  {notes.slice(0, 1).map((note) => (
                    <span key={note.id} className="truncate rounded bg-violet-50 px-1 py-0.5 text-[8px] font-semibold text-violet-800 sm:text-[9px]">
                      {note.title}
                    </span>
                  ))}
                  {leaves.length + reports.length + notes.length > 3 && (
                    <span className="truncate px-1 text-[8px] font-semibold text-stone-500">
                      +{leaves.length + reports.length + notes.length - 3} more
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        <aside className="min-w-0 rounded-2xl border border-stone-100 bg-[#FBF9F5] p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-black text-[#0F1D38]">{dateLabel(selectedDate)}</h3>
            <button
              type="button"
              onClick={() => openNoteForm()}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-violet-100 px-2 py-1.5 text-[10px] font-bold text-violet-800 hover:bg-violet-200"
            >
              <Plus className="h-3 w-3" />
              Add note
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {selectedReports.map((summary) => (
              <div key={summary.weekId} className="flex gap-2.5 rounded-xl border border-orange-100 bg-white p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-[#F37A1F]">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#0F1D38]">Weekly report saved</p>
                  <p className="mt-0.5 text-[10px] text-stone-500">{summary.weekId} · by {summary.updatedBy}</p>
                </div>
              </div>
            ))}

            {selectedLeaves.map((leave) => {
              const member = teamMembersById.get(leave.userId);
              const canManage = isAdmin || leave.userId === userProfile?.uid;
              return (
                <div key={leave.id} className="rounded-xl border border-blue-100 bg-white p-3">
                  <div className="flex items-start gap-2.5">
                    <Avatar
                      name={leave.userName}
                      photoURL={member?.photoURL}
                      className="h-8 w-8 shrink-0 rounded-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-[#0F1D38]">{leave.userName} <span className="font-medium text-stone-400">· {leave.userRole}</span></p>
                      <p className="mt-0.5 text-[10px] text-stone-500">
                        {leave.startDate === leave.endDate
                          ? 'On leave today'
                          : `${leave.startDate} – ${leave.endDate}`}
                      </p>
                      {leave.note && <p className="mt-1 break-words text-[11px] text-stone-600">{leave.note}</p>}
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => openEditForm(leave)}
                          className="rounded-lg px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === leave.id}
                          onClick={() => void handleDelete(leave)}
                          aria-label={`Remove ${leave.userName}'s leave`}
                          className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                  </div>
                </div>
              );
            })}

            {selectedNotes.map((note) => {
              const canManage = isAdmin || note.userId === userProfile?.uid;
              return (
                <div key={note.id} className="rounded-xl border border-violet-100 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-xs font-bold text-[#0F1D38]">{note.title}</p>
                      <p className="mt-0.5 text-[10px] text-stone-500">Added by {note.userName}</p>
                      {note.note && <p className="mt-1.5 whitespace-pre-wrap break-words text-[11px] text-stone-600">{note.note}</p>}
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => openNoteForm(note)}
                          className="rounded-lg px-2 py-1 text-[10px] font-bold text-violet-700 hover:bg-violet-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === note.id}
                          onClick={() => void handleDeleteNote(note)}
                          aria-label={`Remove calendar note: ${note.title}`}
                          className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {selectedReports.length === 0 && selectedLeaves.length === 0 && selectedNotes.length === 0 && (
              <p className="rounded-xl border border-dashed border-stone-200 bg-white/70 px-3 py-5 text-center text-xs text-stone-400">
                Nothing scheduled for this day.
              </p>
            )}
          </div>
          <p className="mt-4 border-t border-stone-200 pt-3 text-[10px] leading-relaxed text-stone-500">
            {isAdmin
              ? 'You can manage leave for any active team member and edit any calendar note.'
              : 'Add and manage your own leave and notes. Calendar updates are shared with everyone.'}
          </p>
        </aside>
      </div>
      </div>

      {error && !formOpen && (
        <p role="alert" className="mx-5 mb-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 sm:mx-6">
          {error}
        </p>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <form onSubmit={(event) => void handleSave(event)} className="relative w-full max-w-md space-y-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl">
            <button
              type="button"
              aria-label="Close leave form"
              disabled={saving}
              onClick={closeForm}
              className="absolute right-4 top-4 rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="pr-8">
              <h3 className="text-lg font-black text-[#0F1D38]">{editingLeave ? 'Edit team leave' : 'Add team leave'}</h3>
              <p className="mt-1 text-xs text-stone-500">This entry will be visible to everyone on the team.</p>
            </div>

            {isAdmin && (
              <label className="block text-xs font-bold text-[#0F1D38]">
                Team member
                <select
                  required
                  value={form.userId}
                  onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                >
                  {teamMembers.map((member) => (
                    <option key={member.uid} value={member.uid}>{member.displayName} ({member.role})</option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-[#0F1D38]">
                First day of leave
                <input
                  required
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                />
              </label>
              <label className="block text-xs font-bold text-[#0F1D38]">
                Last day of leave
                <input
                  required
                  type="date"
                  min={form.startDate}
                  value={form.endDate}
                  onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                />
              </label>
            </div>
            <label className="block text-xs font-bold text-[#0F1D38]">
              Note <span className="font-normal text-stone-400">(optional)</span>
              <input
                maxLength={240}
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Optional note for the team"
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
              />
            </label>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" disabled={saving} onClick={closeForm} className="rounded-xl bg-stone-100 px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-200 disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={saving || !form.userId} className="rounded-xl bg-[#F37A1F] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#df6a14] disabled:opacity-50">
                {saving ? 'Saving...' : editingLeave ? 'Save changes' : 'Add leave'}
              </button>
            </div>
          </form>
        </div>
      )}

      {noteFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <form onSubmit={(event) => void handleSaveNote(event)} className="relative w-full max-w-md space-y-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl">
            <button
              type="button"
              aria-label="Close calendar note form"
              disabled={saving}
              onClick={closeNoteForm}
              className="absolute right-4 top-4 rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="pr-8">
              <h3 className="text-lg font-black text-[#0F1D38]">{editingNote ? 'Edit calendar note' : 'Add calendar note'}</h3>
              <p className="mt-1 text-xs text-stone-500">{dateLabel(selectedDate)} · visible to the whole team</p>
            </div>
            <label className="block text-xs font-bold text-[#0F1D38]">
              Title
              <input
                required
                maxLength={100}
                value={noteForm.title}
                onChange={(event) => setNoteForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Deadline, task, or important update"
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
              />
            </label>
            <label className="block text-xs font-bold text-[#0F1D38]">
              Details <span className="font-normal text-stone-400">(optional)</span>
              <textarea
                maxLength={1000}
                rows={4}
                value={noteForm.note}
                onChange={(event) => setNoteForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Add details for your team"
                className="mt-1 w-full resize-y rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
              />
            </label>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" disabled={saving} onClick={closeNoteForm} className="rounded-xl bg-stone-100 px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-200 disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={saving || !noteForm.title.trim()} className="rounded-xl bg-[#F37A1F] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#df6a14] disabled:opacity-50">
                {saving ? 'Saving...' : editingNote ? 'Save changes' : 'Add note'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
