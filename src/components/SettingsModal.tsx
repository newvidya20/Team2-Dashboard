import React, { useEffect, useState } from 'react';
import { X, Settings, Mail, CheckCircle2, Upload, Linkedin, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AppSettings } from '../types';
import { saveSettings } from '../services/db';
import { Avatar } from './Avatar';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsSaved: (newSettings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsSaved,
}) => {
  const { userProfile, isAdmin, updateCurrentProfile } = useAuth();
  const [reportRecipientEmail, setReportRecipientEmail] = useState(settings.reportRecipientEmail || '');
  const [teamName, setTeamName] = useState(settings.teamName || '');
  const [linkedInUrl, setLinkedInUrl] = useState(userProfile?.linkedInUrl || '');
  const [whatsappNumber, setWhatsappNumber] = useState(userProfile?.whatsappNumber || '');
  const [saving, setSaving] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setReportRecipientEmail(settings.reportRecipientEmail || '');
    setTeamName(settings.teamName || '');
  }, [settings]);

  useEffect(() => {
    setLinkedInUrl(userProfile?.linkedInUrl || '');
    setWhatsappNumber(userProfile?.whatsappNumber || '');
  }, [userProfile?.uid, userProfile?.linkedInUrl, userProfile?.whatsappNumber]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !userProfile) return;
    setSaving(true);
    setNotice(null);

    try {
      const newSettings: AppSettings = {
        reportRecipientEmail: reportRecipientEmail.trim(),
        teamName: teamName.trim(),
      };
      await saveSettings(newSettings, userProfile);
      onSettingsSaved(newSettings);
      setNotice('Settings successfully updated!');
      setTimeout(() => setNotice(null), 3000);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setNotice(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !userProfile) return;

    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setNotice('Choose a PNG, JPEG, WebP, or GIF image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice('Choose an image smaller than 2 MB.');
      return;
    }

    setSavingPhoto(true);
    setNotice(null);
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
      await updateCurrentProfile({ photoURL });
      setNotice('Your profile photo was updated.');
    } catch (error) {
      console.error('Failed to update profile photo:', error);
      setNotice(`Error: ${error instanceof Error ? error.message : 'Could not update your photo.'}`);
    } finally {
      setSavingPhoto(false);
    }
  };

  const handlePhotoRemoval = async () => {
    if (!userProfile) return;
    setSavingPhoto(true);
    setNotice(null);
    try {
      await updateCurrentProfile({ photoURL: '' });
      setNotice('Your profile photo was removed.');
    } catch (error) {
      console.error('Failed to remove profile photo:', error);
      setNotice(`Error: ${error instanceof Error ? error.message : 'Could not remove your photo.'}`);
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleSaveContact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userProfile) return;
    setSavingContact(true);
    setNotice(null);
    try {
      await updateCurrentProfile({
        linkedInUrl: linkedInUrl.trim(),
        whatsappNumber: whatsappNumber.trim(),
      });
      setNotice('Your LinkedIn and WhatsApp details were saved.');
    } catch (error) {
      console.error('Failed to save contact details:', error);
      setNotice(`Error: ${error instanceof Error ? error.message : 'Could not save your contact details.'}`);
    } finally {
      setSavingContact(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-stone-200 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2.5 mb-2">
          <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#F37A1F] flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#0F1D38]">Hub Settings</h2>
            <p className="text-[11px] text-stone-400">Team 2 Operational Configuration</p>
          </div>
        </div>

        {notice && (
          <div className="my-3 p-3 rounded-xl bg-orange-50 border border-orange-200 text-[#F37A1F] text-xs font-semibold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <section className="mt-4 rounded-2xl border border-stone-200 p-4">
          <h3 className="text-xs font-bold text-[#0F1D38] mb-3">Your Profile Photo</h3>
          <div className="flex items-center gap-3">
            <Avatar
              name={userProfile?.displayName || ''}
              photoURL={userProfile?.photoURL}
              className="w-12 h-12 rounded-xl ring-2 ring-stone-200"
            />
            <label className="cursor-pointer px-3 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-xs font-bold text-[#0F1D38] flex items-center gap-1.5 transition">
              <Upload className="w-3.5 h-3.5 text-[#F37A1F]" />
              <span>{savingPhoto ? 'Saving...' : 'Choose Photo'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={savingPhoto}
                className="hidden"
                onChange={(event) => void handlePhotoUpload(event)}
              />
            </label>
            {userProfile?.photoURL && (
              <button
                type="button"
                disabled={savingPhoto}
                onClick={() => void handlePhotoRemoval()}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-[10px] text-stone-400 mt-2">
            PNG, JPEG, WebP, or GIF; maximum 2 MB. You can update your own photo here.
          </p>
        </section>

        <form onSubmit={(event) => void handleSaveContact(event)} className="mt-4 space-y-3 rounded-2xl border border-stone-200 p-4">
          <div>
            <h3 className="text-xs font-bold text-[#0F1D38]">Your Contact Details</h3>
            <p className="mt-1 text-[10px] text-stone-400">
              Add your own professional profile and WhatsApp number. These appear on your team profile.
            </p>
          </div>
          <label className="block text-xs font-bold text-[#0F1D38]">
            LinkedIn profile URL or ID
            <div className="relative mt-1">
              <Linkedin className="absolute left-3.5 top-3 h-4 w-4 text-stone-400" />
              <input
                type="text"
                value={linkedInUrl}
                onChange={(event) => setLinkedInUrl(event.target.value)}
                placeholder="linkedin.com/in/your-profile"
                className="w-full rounded-xl border border-stone-200 py-2.5 pl-10 pr-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
              />
            </div>
          </label>
          <label className="block text-xs font-bold text-[#0F1D38]">
            WhatsApp number
            <div className="relative mt-1">
              <MessageCircle className="absolute left-3.5 top-3 h-4 w-4 text-stone-400" />
              <input
                type="tel"
                value={whatsappNumber}
                onChange={(event) => setWhatsappNumber(event.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-xl border border-stone-200 py-2.5 pl-10 pr-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
              />
            </div>
          </label>
          <button
            type="submit"
            disabled={savingContact}
            className="w-full rounded-xl bg-[#F37A1F] py-2.5 text-xs font-bold text-white transition hover:bg-[#df6a14] disabled:opacity-50"
          >
            {savingContact ? 'Saving...' : 'Save My Contact Details'}
          </button>
        </form>

        {isAdmin && (
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#0F1D38] mb-1">
              Weekly Report Recipient Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="email"
                value={reportRecipientEmail}
                onChange={(e) => setReportRecipientEmail(e.target.value)}
                className="w-full rounded-xl border border-stone-200 py-2.5 pl-10 pr-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
              />
            </div>
            <p className="text-[10px] text-stone-400 mt-1">
              Optional email address used when preparing weekly report drafts.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F1D38] mb-1">
              Team Name / Unit Mandate
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F37A1F]"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-[#F37A1F] text-white font-bold text-xs hover:bg-[#df6a14] transition shadow-md disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Admin Settings'}
            </button>
          </div>
        </form>
        )}

      </div>
    </div>
  );
};
