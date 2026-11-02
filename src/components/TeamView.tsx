import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  Tag,
  Plus,
  X,
  Upload,
  Calendar,
  CheckCircle2,
  ListTodo,
  ExternalLink,
  Edit2,
  FileText,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { UserProfile, TaskItem, DailyReport } from '../types';
import {
  createUserProfile,
  deleteUserProfile,
  saveUserProfile,
} from '../services/db';
import { Avatar } from './Avatar';

function getLinkedInHref(value?: string): string | undefined {
  const profile = value?.trim();
  if (!profile) return undefined;
  if (/^[A-Za-z0-9][A-Za-z0-9-]{1,99}$/.test(profile)) {
    return `https://www.linkedin.com/in/${encodeURIComponent(profile)}`;
  }

  const normalized = /^https?:\/\//i.test(profile)
    ? profile
    : `https://${profile.replace(/^\/+/, '')}`;
  try {
    const url = new URL(normalized);
    const isLinkedInHost = url.hostname === 'linkedin.com' || url.hostname === 'www.linkedin.com';
    return isLinkedInHost && /^\/in\/[^/]+\/?$/i.test(url.pathname)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function getWhatsAppHref(value?: string): string | undefined {
  const digits = value?.replace(/\D/g, '');
  return digits && digits.length >= 7 && digits.length <= 15
    ? `https://wa.me/${digits}`
    : undefined;
}

const MemberSocialLinks: React.FC<{ member: UserProfile; stopPropagation?: boolean }> = ({
  member,
  stopPropagation = false,
}) => {
  const linkedInHref = getLinkedInHref(member.linkedInUrl);
  const whatsAppHref = getWhatsAppHref(member.whatsappNumber);
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (stopPropagation) event.stopPropagation();
  };

  if (!linkedInHref && !whatsAppHref) return null;

  return (
    <div className="flex items-center gap-2">
      {linkedInHref && (
        <a
          href={linkedInHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          aria-label={`${member.displayName}'s LinkedIn profile`}
          title={`LinkedIn: ${member.displayName}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0A66C2] text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#004182] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M5.2 7.4a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2ZM3.4 9h3.6v11H3.4V9Zm5.8 0h3.4v1.5h.1c.5-.9 1.6-1.9 3.4-1.9 3.6 0 4.3 2.4 4.3 5.5V20h-3.6v-5.2c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V20H9.2V9Z" />
          </svg>
        </a>
      )}
      {whatsAppHref && (
        <a
          href={whatsAppHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          aria-label={`Message ${member.displayName} on WhatsApp`}
          title={`WhatsApp: ${member.displayName}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#128C7E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M12.04 2a9.9 9.9 0 0 0-8.48 15.02L2.25 22l5.1-1.34A9.96 9.96 0 1 0 12.04 2Zm0 18.1c-1.48 0-2.93-.4-4.2-1.17l-.3-.18-3.03.8.81-2.95-.2-.31A8.15 8.15 0 1 1 12.04 20.1Zm4.47-6.1c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.92-1.18-.71-.63-1.19-1.41-1.33-1.65-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.36.51.57.18 1.09.16 1.5.1.46-.07 1.43-.58 1.63-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
          </svg>
        </a>
      )}
    </div>
  );
};

interface TeamViewProps {
  teamMembers: UserProfile[];
  tasks: TaskItem[];
  dailyReports: DailyReport[];
}

export const TeamView: React.FC<TeamViewProps> = ({
  teamMembers,
  tasks,
  dailyReports,
}) => {
  const { userProfile, isAdmin, updateCurrentProfile } = useAuth();

  // Selected member for detail modal
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);

  // Editing capability tags state (Admin only)
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);
  const [newTag, setNewTag] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberLinkedInUrl, setMemberLinkedInUrl] = useState('');
  const [memberWhatsAppNumber, setMemberWhatsAppNumber] = useState('');
  const [memberRole, setMemberRole] = useState<'admin' | 'member'>('member');
  const [memberCapabilities, setMemberCapabilities] = useState('');
  const [editingName, setEditingName] = useState('');
  const [editingEmail, setEditingEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [passwordResetTarget, setPasswordResetTarget] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordResetError, setPasswordResetError] = useState<string | null>(null);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);

  const openMemberEditor = (member: UserProfile) => {
    setEditingName(member.displayName);
    setEditingEmail(member.email);
    setEditingMember(member);
  };

  const handleAddCapability = async (member: UserProfile) => {
    if (!isAdmin || !newTag.trim() || !userProfile) return;
    const updatedCaps = [...(member.capabilities || []), newTag.trim()];
    const updatedMember = { ...member, capabilities: updatedCaps };

    try {
      await saveUserProfile(updatedMember);
      setNewTag('');
      if (editingMember?.uid === member.uid) {
        setEditingMember(updatedMember);
      }
      if (selectedMember?.uid === member.uid) {
        setSelectedMember(updatedMember);
      }
    } catch (err) {
      console.error('Failed to add capability:', err);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAdmin || !passwordResetTarget) return;
    if (newPassword.length < 6 || newPassword.length > 1024) {
      setPasswordResetError('Password must be between 6 and 1024 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordResetError('The passwords do not match.');
      return;
    }

    setResettingPassword(true);
    setPasswordResetError(null);
    setPasswordResetSuccess(null);
    try {
      await apiRequest<{ success: boolean }>(
        `/api/members/${encodeURIComponent(passwordResetTarget.uid)}/password`,
        {
          method: 'POST',
          body: JSON.stringify({ password: newPassword }),
        }
      );
      setNewPassword('');
      setConfirmPassword('');
      setPasswordResetSuccess(`Password updated for ${passwordResetTarget.displayName}. Share it with them securely.`);
    } catch (error) {
      setPasswordResetError(error instanceof Error ? error.message : 'Could not update the password.');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleCreateMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAdmin || !userProfile) return;
    setSavingMember(true);
    try {
      const member = await createUserProfile({
        email: memberEmail,
        displayName: memberName.trim(),
        role: memberRole,
        capabilities: memberCapabilities.split(',').map((tag) => tag.trim()).filter(Boolean),
        linkedInUrl: memberLinkedInUrl.trim(),
        whatsappNumber: memberWhatsAppNumber.trim(),
      });
      setMemberName('');
      setMemberEmail('');
      setMemberLinkedInUrl('');
      setMemberWhatsAppNumber('');
      setMemberRole('member');
      setMemberCapabilities('');
      setAddingMember(false);
    } catch (err) {
      console.error('Failed to add team member:', err);
      alert(err instanceof Error ? err.message : 'Failed to add team member.');
    } finally {
      setSavingMember(false);
    }
  };

  const handleSaveMember = async (member: UserProfile) => {
    if (!isAdmin || !userProfile) return;
    const updatedMember = {
      ...member,
      displayName: editingName.trim(),
      email: editingEmail.trim().toLowerCase(),
    };
    try {
      await saveUserProfile(updatedMember);
      if (userProfile.uid === member.uid) {
        await updateCurrentProfile(updatedMember);
      }
      setEditingMember(updatedMember);
      if (selectedMember?.uid === member.uid) setSelectedMember(updatedMember);
    } catch (err) {
      console.error('Failed to update team member:', err);
      alert(err instanceof Error ? err.message : 'Failed to update team member.');
    }
  };

  const handleDeleteMember = async (member: UserProfile) => {
    if (!isAdmin || !userProfile || userProfile.uid === member.uid) return;
    const confirmed = window.confirm(
      `Deactivate ${member.displayName}? They will lose access and disappear from active team, task, and report views. Their past activity and report history will remain saved.`
    );
    if (!confirmed) return;
    try {
      await deleteUserProfile(member.uid);
      setEditingMember(null);
      setSelectedMember(null);
    } catch (err) {
      console.error('Failed to remove team member:', err);
      alert(err instanceof Error ? err.message : 'Failed to remove team member.');
    }
  };

  const handleRemoveCapability = async (member: UserProfile, tagToRemove: string) => {
    if (!isAdmin || !userProfile) return;
    const updatedCaps = (member.capabilities || []).filter((t) => t !== tagToRemove);
    const updatedMember = { ...member, capabilities: updatedCaps };

    try {
      await saveUserProfile(updatedMember);
      if (editingMember?.uid === member.uid) {
        setEditingMember(updatedMember);
      }
      if (selectedMember?.uid === member.uid) {
        setSelectedMember(updatedMember);
      }
    } catch (err) {
      console.error('Failed to remove capability:', err);
    }
  };

  const handleRoleToggle = async (member: UserProfile) => {
    if (!isAdmin || !userProfile) return;
    const nextRole = member.role === 'admin' ? 'member' : 'admin';
    const updatedMember: UserProfile = { ...member, role: nextRole };

    try {
      await saveUserProfile(updatedMember);
      if (editingMember?.uid === member.uid) {
        setEditingMember(updatedMember);
      }
      if (selectedMember?.uid === member.uid) {
        setSelectedMember(updatedMember);
      }
    } catch (err) {
      console.error('Failed to change role:', err);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, member: UserProfile) => {
    if (!isAdmin || !userProfile) return;
    const input = e.currentTarget;
    const file = e.target.files?.[0];
    input.value = '';
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      alert('Choose a PNG, JPEG, WebP, or GIF image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Choose an image smaller than 2 MB.');
      return;
    }

    try {
      const photoURL = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('Could not read the selected image.'));
        };
        reader.onerror = () => reject(reader.error || new Error('Could not read the selected image.'));
        reader.readAsDataURL(file);
      });
      const updated = { ...member, photoURL };
      if (member.uid === userProfile.uid) {
        await updateCurrentProfile({ photoURL });
      } else {
        await saveUserProfile(updated);
      }
      if (editingMember?.uid === member.uid) {
        setEditingMember(updated);
      }
      if (selectedMember?.uid === member.uid) {
        setSelectedMember(updated);
      }
    } catch (error) {
      console.error('Failed to upload photo:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload photo.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F1D38]">
            Team 2 Roster
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Lead Assessment & Initial Response operational specialists. Click any card to inspect active tasks and reports.
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="px-3.5 py-1.5 rounded-xl bg-orange-100/70 border border-orange-200 text-[#F37A1F] text-xs font-bold flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Admin privileges: Team management enabled</span>
            </div>
            <button
              onClick={() => setAddingMember(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#F37A1F] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#df6a14] transition"
            >
              <Plus className="w-4 h-4" />
              Add Member
            </button>
          </div>
        )}

        {passwordResetTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <form
              onSubmit={handleResetPassword}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-stone-200 relative space-y-4"
            >
              <button
                type="button"
                disabled={resettingPassword}
                onClick={() => setPasswordResetTarget(null)}
                className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition disabled:opacity-50"
                aria-label="Close password reset"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-black text-[#0F1D38]">Reset member password</h2>
                <p className="mt-1 text-xs text-stone-500">
                  Set a new sign-in password for {passwordResetTarget.displayName}.
                </p>
              </div>
              <label className="block text-xs font-bold text-[#0F1D38]">
                New password
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={1024}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                />
              </label>
              <label className="block text-xs font-bold text-[#0F1D38]">
                Confirm new password
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={1024}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                />
              </label>
              <p className="text-[11px] text-stone-500">
                Use at least 6 characters. Share the new password with the member through a secure channel.
              </p>
              {passwordResetError && (
                <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {passwordResetError}
                </p>
              )}
              {passwordResetSuccess && (
                <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                  {passwordResetSuccess}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={resettingPassword}
                  onClick={() => setPasswordResetTarget(null)}
                  className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold hover:bg-stone-200 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPassword}
                  className="px-4 py-2 rounded-xl bg-[#F37A1F] text-white text-xs font-bold hover:bg-[#df6a14] transition disabled:opacity-50"
                >
                  {resettingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Team Cards Grid */}
      {teamMembers.length === 0 && (
        <div className="bg-white rounded-3xl p-8 border border-stone-200/80 text-center text-sm text-stone-500">
          No team members yet.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teamMembers.map((member) => {
          const memberTasks = tasks.filter(
            (t) =>
              t.assignedTo === member.uid
          );
          const openTasks = memberTasks.filter((t) => t.status !== 'done');
          const memberReports = dailyReports.filter(
            (r) =>
              r.userId === member.uid
          );
          return (
            <div
              key={member.uid}
              className="group relative flex min-h-[390px] flex-col justify-between rounded-3xl border border-stone-200/80 bg-white p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md sm:p-6"
            >
              <div>
                {/* Header with Photo & Role */}
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div
                    className="flex min-w-0 cursor-pointer items-center gap-4"
                    onClick={() => setSelectedMember(member)}
                  >
                    <div className="relative">
                      <Avatar
                        name={member.displayName}
                        photoURL={member.photoURL}
                        className="w-20 h-20 rounded-2xl ring-2 ring-stone-200 group-hover:ring-[#F37A1F] transition"
                      />
                      {member.role === 'admin' && (
                        <span
                          className="absolute -bottom-1 -right-1 bg-[#F37A1F] text-white p-1 rounded-full shadow-xs"
                          title="Admin"
                        >
                          <ShieldCheck className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-black text-[#0F1D38] transition group-hover:text-[#F37A1F]">
                        {member.displayName}
                      </h3>
                      <p className="mt-0.5 max-w-full truncate text-xs text-stone-500">
                        {member.email}
                      </p>
                      <div className="mt-2">
                        <MemberSocialLinks member={member} stopPropagation />
                      </div>
                    </div>
                  </div>

                  {/* Role Badge */}
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${
                      member.role === 'admin'
                        ? 'bg-orange-100 text-[#F37A1F]'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {member.role}
                  </span>
                </div>

                {/* Quick workload stats */}
                <div
                  className="my-4 grid cursor-pointer grid-cols-2 gap-3"
                  onClick={() => setSelectedMember(member)}
                >
                  <div className="rounded-2xl border border-stone-200/70 bg-[#FBF9F5] p-3 text-center transition hover:border-orange-200">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                      Open Tasks
                    </span>
                    <div className="text-lg font-black text-[#0F1D38]">{openTasks.length}</div>
                  </div>
                  <div className="rounded-2xl border border-stone-200/70 bg-[#FBF9F5] p-3 text-center transition hover:border-orange-200">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                      Daily Reports
                    </span>
                    <div className="text-lg font-black text-[#F37A1F]">{memberReports.length}</div>
                  </div>
                </div>

                {/* Capability Tags */}
                <div className="my-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    <span>Capabilities</span>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          openMemberEditor(member);
                        }}
                        className="text-[#F37A1F] hover:underline normal-case text-xs font-semibold"
                      >
                        Edit Tags
                      </button>
                    )}
                  </div>

                  <div className="flex min-h-12 flex-wrap content-start gap-1.5">
                    {(member.capabilities || []).length === 0 ? (
                      <span className="text-xs text-stone-400 italic">No capabilities set</span>
                    ) : (
                      member.capabilities.map((tag, i) => (
                        <span
                          key={i}
                          className="rounded-lg border border-stone-200/60 bg-stone-50 px-2.5 py-1 text-[11px] font-semibold text-stone-700"
                        >
                          {tag}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer CTA */}
              <div className={`mt-auto grid gap-2 border-t border-stone-100 pt-4 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <button
                  onClick={() => setSelectedMember(member)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-center text-[11px] font-bold text-[#a74b0c] transition hover:bg-orange-100"
                >
                  <span>Tasks &amp; Reports</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </button>

                {isAdmin && (
                  <button
                    onClick={() => openMemberEditor(member)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-center text-[11px] font-bold text-stone-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#a74b0c]"
                  >
                    <Edit2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Edit profile</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {addingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <form
            onSubmit={handleCreateMember}
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-stone-200 relative space-y-4"
          >
            <button
              type="button"
              onClick={() => setAddingMember(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-black text-[#0F1D38]">Add Team Member</h2>
              <p className="text-xs text-stone-500 mt-1">
                Add an approved roster profile. The member can sign up with this email; their name and role are set from this entry.
              </p>
            </div>
            <label className="block text-xs font-bold text-[#0F1D38]">
              Full name
              <input
                required
                value={memberName}
                onChange={(event) => setMemberName(event.target.value)}
                className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                placeholder="Enter name"
              />
            </label>
            <label className="block text-xs font-bold text-[#0F1D38]">
              Email address
              <input
                required
                type="email"
                value={memberEmail}
                onChange={(event) => setMemberEmail(event.target.value)}
                className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                placeholder="Enter email"
              />
            </label>
            <label className="block text-xs font-bold text-[#0F1D38]">
              LinkedIn profile URL or ID
              <input
                value={memberLinkedInUrl}
                onChange={(event) => setMemberLinkedInUrl(event.target.value)}
                className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                placeholder="linkedin.com/in/your-profile"
              />
            </label>
            <label className="block text-xs font-bold text-[#0F1D38]">
              WhatsApp number
              <input
                type="tel"
                value={memberWhatsAppNumber}
                onChange={(event) => setMemberWhatsAppNumber(event.target.value)}
                className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                placeholder="+91 98765 43210"
              />
            </label>
            <label className="block text-xs font-bold text-[#0F1D38]">
              Role
              <select
                value={memberRole}
                onChange={(event) => setMemberRole(event.target.value as 'admin' | 'member')}
                className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label className="block text-xs font-bold text-[#0F1D38]">
              Capabilities
              <input
                value={memberCapabilities}
                onChange={(event) => setMemberCapabilities(event.target.value)}
                className="mt-1 w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                placeholder="Comma-separated capabilities"
              />
            </label>
            <button
              type="submit"
              disabled={savingMember}
              className="w-full py-2.5 rounded-xl bg-[#F37A1F] text-white font-bold text-xs hover:bg-[#df6a14] transition disabled:opacity-50"
            >
              {savingMember ? 'Adding...' : 'Add Member'}
            </button>
          </form>
        </div>
      )}

      {/* Member Details Modal (Tasks & Recent Reports) */}
      {selectedMember && (() => {
        const selectedTasks = tasks.filter(
          (t) => t.assignedTo === selectedMember.uid
        );
        const selectedReports = dailyReports.filter(
          (r) => r.userId === selectedMember.uid
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-stone-200 relative max-h-[85vh] overflow-y-auto">
              <button
                onClick={() => setSelectedMember(null)}
                className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Profile Header */}
              <div className="flex items-center space-x-4 pb-6 border-b border-stone-100">
                <Avatar
                  name={selectedMember.displayName}
                  photoURL={selectedMember.photoURL}
                  className="w-16 h-16 rounded-2xl ring-2 ring-stone-200"
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xl font-black text-[#0F1D38]">
                      {selectedMember.displayName}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-orange-100 text-[#F37A1F]">
                      {selectedMember.role}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">{selectedMember.email}</p>
                  <div className="mt-2">
                    <MemberSocialLinks member={selectedMember} />
                  </div>

                  {/* Capabilities pills */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(selectedMember.capabilities || []).map((c, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Content Tabs: Assigned Tasks & Recent Reports */}
              <div className="space-y-6 mt-6">
                {/* Assigned Tasks */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-black text-[#0F1D38] flex items-center space-x-2">
                      <ListTodo className="w-4 h-4 text-[#F37A1F]" />
                      <span>Assigned Tasks</span>
                    </h3>
                    <span className="text-xs font-semibold text-stone-400">
                      {selectedTasks.length} total
                    </span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {selectedTasks.length === 0 ? (
                      <p className="text-xs text-stone-400 italic">No tasks assigned currently.</p>
                    ) : (
                      selectedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-3 rounded-xl border border-stone-200/80 bg-stone-50 flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-bold text-[#0F1D38]">{task.title}</p>
                            <span className="text-[10px] text-stone-500">
                              Due: {task.dueDate} • {task.priority} priority
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              task.status === 'done'
                                ? 'bg-emerald-100 text-emerald-800'
                                : task.status === 'in_progress'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-stone-200 text-stone-700'
                            }`}
                          >
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Daily Reports */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-black text-[#0F1D38] flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-[#F37A1F]" />
                      <span>Recent Daily Reports</span>
                    </h3>
                    <span className="text-xs font-semibold text-stone-400">
                      {selectedReports.length} submissions
                    </span>
                  </div>

                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {selectedReports.length === 0 ? (
                      <p className="text-xs text-stone-400 italic">No reports submitted yet.</p>
                    ) : (
                      selectedReports.slice(0, 4).map((report) => (
                        <div
                          key={report.id}
                          className="p-3.5 rounded-2xl border border-stone-200/80 bg-stone-50 space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between font-bold text-[#0F1D38]">
                            <span>📅 {report.date}</span>
                            <span className="text-stone-500">Daily report</span>
                          </div>
                          <p className="text-stone-600 whitespace-pre-line line-clamp-3">
                            {report.whatIDid}
                          </p>
                          {report.blockers && (
                            <p className="text-[11px] text-red-700 bg-red-50 p-1.5 rounded-lg">
                              <strong>Blockers:</strong> {report.blockers}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-xs animate-in fade-in duration-200 sm:items-center sm:p-4">
          <div className="relative my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-stone-200 bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-8">
            <button
              onClick={() => setEditingMember(null)}
              aria-label="Close profile editor"
              className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-black text-[#0F1D38] mb-1">
              Edit {editingMember.displayName}
            </h2>
            <p className="text-xs text-stone-500 mb-6">
              Update profile details, role, photo, and capability tags.
            </p>

            <div className="space-y-5">
              <div className="space-y-3">
                <label className="block text-xs font-bold text-[#0F1D38]">
                  Full name
                  <input
                    required
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                  />
                </label>
                <label className="block text-xs font-bold text-[#0F1D38]">
                  Email address
                  <input
                    required
                    type="email"
                    value={editingEmail}
                    disabled={editingMember.uid === userProfile?.uid}
                    onChange={(event) => setEditingEmail(event.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#F37A1F] disabled:bg-stone-100"
                  />
                </label>
                <label className="block text-xs font-bold text-[#0F1D38]">
                  LinkedIn profile URL or ID
                  <input
                    value={editingMember.linkedInUrl || ''}
                    onChange={(event) => setEditingMember((previous) => previous
                      ? { ...previous, linkedInUrl: event.target.value }
                      : previous)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                    placeholder="linkedin.com/in/your-profile"
                  />
                </label>
                <label className="block text-xs font-bold text-[#0F1D38]">
                  WhatsApp number
                  <input
                    type="tel"
                    value={editingMember.whatsappNumber || ''}
                    onChange={(event) => setEditingMember((previous) => previous
                      ? { ...previous, whatsappNumber: event.target.value }
                      : previous)}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                    placeholder="+91 98765 43210"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleSaveMember(editingMember)}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold hover:bg-stone-200 transition"
                >
                  Save Profile
                </button>
              </div>

              <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/70">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-[#0F1D38]">Account password</h3>
                    <p className="mt-1 text-[11px] text-stone-600">
                      Set a new password for this member. They can sign in with it immediately.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordResetTarget(editingMember);
                      setNewPassword('');
                      setConfirmPassword('');
                      setPasswordResetError(null);
                      setPasswordResetSuccess(null);
                    }}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-white border border-amber-200 text-[#9a4c0c] text-xs font-bold hover:bg-amber-100 transition"
                  >
                    Reset Password
                  </button>
                </div>
              </div>

              {/* Photo Upload / Update */}
              <div>
                <label className="block text-xs font-bold text-[#0F1D38] mb-1">
                  Upload Photo (Admin)
                </label>
                <div className="flex items-center space-x-3">
                  <Avatar
                    name={editingMember.displayName}
                    photoURL={editingMember.photoURL}
                    className="w-12 h-12 rounded-xl ring-2 ring-stone-200"
                  />
                  <label className="cursor-pointer px-3 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-xs font-bold text-[#0F1D38] flex items-center space-x-1.5 transition">
                    <Upload className="w-3.5 h-3.5 text-[#F37A1F]" />
                    <span>Choose Image File</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, editingMember)}
                    />
                  </label>
                </div>
              </div>

              {/* Role Toggle */}
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#0F1D38]">Role Assignment</span>
                  <p className="text-[11px] text-stone-500">Current: {editingMember.role}</p>
                </div>
                <button
                  type="button"
                  disabled={editingMember.uid === userProfile?.uid}
                  onClick={() => handleRoleToggle(editingMember)}
                  className="px-3 py-1.5 rounded-xl bg-orange-100 text-[#F37A1F] text-xs font-bold hover:bg-orange-200 transition disabled:opacity-40"
                >
                  Switch to {editingMember.role === 'admin' ? 'Member' : 'Admin'}
                </button>
              </div>

              {/* Capability Tags */}
              <div>
                <label className="block text-xs font-bold text-[#0F1D38] mb-2">
                  Capability Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(editingMember.capabilities || []).map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800 text-xs font-semibold"
                    >
                      <span>{tag}</span>
                      <button
                        onClick={() => handleRemoveCapability(editingMember, tag)}
                        className="text-stone-400 hover:text-red-600 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Add a capability"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
                  />
                  <button
                    onClick={() => handleAddCapability(editingMember)}
                    className="px-3 py-2 rounded-xl bg-[#F37A1F] text-white text-xs font-bold hover:bg-[#df6a14] transition"
                  >
                    Add Tag
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                {editingMember.uid !== userProfile?.uid && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteMember(editingMember)}
                    className="px-4 py-2 rounded-xl text-red-600 hover:bg-red-50 text-xs font-bold transition"
                  >
                    Deactivate Member
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-5 py-2 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
