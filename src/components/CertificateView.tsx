import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  CalendarDays,
  Download,
  FileImage,
  FileText,
  Eye,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  X,
  Pencil,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  createCertificate,
  deleteCertificate,
  downloadCertificate,
  getMyCertificates,
  getTeamCertificates,
  updateCertificate,
  viewCertificate,
} from '../services/certificates';
import { Certificate, UserProfile } from '../types';

interface CertificateViewProps {
  teamMembers: UserProfile[];
}

interface CertificateFormState {
  name: string;
  organization: string;
  issueDate: string;
  expiryDate: string;
}

const emptyForm: CertificateFormState = {
  name: '',
  organization: '',
  issueDate: '',
  expiryDate: '',
};

function formatDate(date: string): string {
  if (!date) return 'No expiry date';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function CertificateView({ teamMembers }: CertificateViewProps) {
  const { userProfile, isAdmin } = useAuth();
  const employees = useMemo(
    () => teamMembers.filter((member) => member.role === 'member'),
    [teamMembers]
  );
  const [viewMode, setViewMode] = useState<'mine' | 'team'>('mine');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [myCertificates, setMyCertificates] = useState<Certificate[]>([]);
  const [teamCertificates, setTeamCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCertificate, setEditingCertificate] = useState<Certificate | null>(null);
  const [form, setForm] = useState<CertificateFormState>(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ certificate: Certificate; url: string } | null>(null);

  const refreshCertificates = useCallback(async () => {
    if (!userProfile) return;
    setLoading(true);
    setError(null);
    try {
      if (viewMode === 'team') {
        setTeamCertificates(await getTeamCertificates());
      } else {
        setMyCertificates(await getMyCertificates());
      }
    } catch (loadError) {
      console.error('Could not load certificates:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Could not load certificates.');
    } finally {
      setLoading(false);
    }
  }, [userProfile, viewMode]);

  useEffect(() => {
    void refreshCertificates();
  }, [refreshCertificates]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  useEffect(() => {
    if (employees.length && !employees.some((member) => member.uid === selectedEmployeeId)) {
      setSelectedEmployeeId(employees[0].uid);
    }
  }, [employees, selectedEmployeeId]);

  const adminTeamView = isAdmin && viewMode === 'team';
  const showingTeamCertificates = viewMode === 'team';
  const canAddCertificate = !showingTeamCertificates || adminTeamView;
  const visibleCertificates = (showingTeamCertificates ? teamCertificates : myCertificates)
    .filter((certificate) => showingTeamCertificates
      ? certificate.userId !== userProfile?.uid
      : certificate.userId === userProfile?.uid)
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const selectedEmployee = employees.find((member) => member.uid === selectedEmployeeId);

  const openCreateForm = () => {
    setEditingCertificate(null);
    setForm(emptyForm);
    setSelectedFile(null);
    setError(null);
    setFormOpen(true);
  };

  const openEditForm = (certificate: Certificate) => {
    setEditingCertificate(certificate);
    setForm({
      name: certificate.name,
      organization: certificate.organization,
      issueDate: certificate.issueDate,
      expiryDate: certificate.expiryDate,
    });
    setSelectedFile(null);
    setError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingCertificate(null);
    setSelectedFile(null);
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] || null;
    event.currentTarget.value = '';
    if (!file) return;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    const allowedExtensions = /\.(pdf|jpe?g|png)$/i;
    if (!allowedTypes.includes(file.type) || !allowedExtensions.test(file.name)) {
      setError('Choose a PDF, JPG, JPEG, or PNG certificate.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Certificate files must be 10 MB or smaller.');
      return;
    }
    setError(null);
    setSelectedFile(file);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCertificate && !selectedFile) {
      setError('Select the certificate file to upload.');
      return;
    }
    if (!userProfile || (adminTeamView && !selectedEmployeeId)) return;
    setSaving(true);
    setError(null);
    try {
      if (editingCertificate) {
        await updateCertificate(
          editingCertificate.id,
          form,
          selectedFile || undefined,
          adminTeamView && editingCertificate.ownerRole === 'member'
        );
      } else {
        await createCertificate(
          form,
          selectedFile!,
          adminTeamView ? selectedEmployeeId : undefined
        );
      }
      setFormOpen(false);
      setEditingCertificate(null);
      setSelectedFile(null);
      await refreshCertificates();
    } catch (saveError) {
      console.error('Could not save certificate:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save certificate.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (certificate: Certificate) => {
    const isEmployeeCertificate = adminTeamView && certificate.ownerRole === 'member';
    const ownerLabel = isEmployeeCertificate ? `${certificate.ownerName}'s ` : 'your ';
    if (!window.confirm(`Delete ${ownerLabel}certificate "${certificate.name}"? This cannot be undone.`)) {
      return;
    }
    setDeletingId(certificate.id);
    setError(null);
    try {
      await deleteCertificate(certificate.id, isEmployeeCertificate);
      await refreshCertificates();
    } catch (deleteError) {
      console.error('Could not delete certificate:', deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete certificate.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (certificate: Certificate) => {
    setDownloadingId(certificate.id);
    setError(null);
    try {
      await downloadCertificate(certificate);
    } catch (downloadError) {
      console.error('Could not download certificate:', downloadError);
      setError(downloadError instanceof Error ? downloadError.message : 'Could not download certificate.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleView = async (certificate: Certificate) => {
    setViewingId(certificate.id);
    setError(null);
    try {
      const url = await viewCertificate(certificate);
      setPreview({ certificate, url });
    } catch (viewError) {
      console.error('Could not preview certificate:', viewError);
      setError(viewError instanceof Error ? viewError.message : 'Could not preview certificate.');
    } finally {
      setViewingId(null);
    }
  };

  return (
    <section className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-[#F37A1F]">
              <Award className="h-5 w-5" />
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0F1D38]">
              {showingTeamCertificates ? 'Team Certificates' : 'My Certificates'}
            </h2>
          </div>
          <p className="mt-2 text-xs text-stone-500">
            {adminTeamView
              ? 'View other team members’ certificates and manage employee certificates.'
              : showingTeamCertificates
                ? 'View and download certificates shared by your teammates.'
                : 'Keep your professional qualifications organized and ready to download.'}
          </p>
        </div>
        {canAddCertificate && (
          <button
            onClick={openCreateForm}
            disabled={adminTeamView && !selectedEmployeeId}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F37A1F] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {adminTeamView ? 'Add Employee Certificate' : 'Add Certificate'}
          </button>
        )}
      </div>

      {userProfile && (
        <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex self-start rounded-xl bg-stone-100 p-1">
            <button
              onClick={() => setViewMode('mine')}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                viewMode === 'mine' ? 'bg-white text-[#0F1D38] shadow-xs' : 'text-stone-500'
              }`}
            >
              My Certificates
            </button>
            <button
              onClick={() => setViewMode('team')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition ${
                viewMode === 'team' ? 'bg-white text-[#F37A1F] shadow-xs' : 'text-stone-500'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Team Certificates
            </button>
          </div>
          {adminTeamView && (
            <label className="flex items-center gap-2 text-xs font-semibold text-stone-600">
              <UserRound className="h-4 w-4 text-stone-400" />
              <span className="whitespace-nowrap">Add for</span>
              <select
                value={selectedEmployeeId}
                onChange={(event) => setSelectedEmployeeId(event.target.value)}
                disabled={!employees.length}
                className="min-w-48 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-[#0F1D38] outline-none focus:ring-2 focus:ring-[#F37A1F]"
              >
                {employees.length ? (
                  employees.map((member) => (
                    <option key={member.uid} value={member.uid}>{member.displayName}</option>
                  ))
                ) : (
                  <option value="">No employees available</option>
                )}
              </select>
            </label>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss error" className="shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-xs font-semibold text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin text-[#F37A1F]" />
          Loading certificates...
        </div>
      ) : visibleCertificates.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleCertificates.map((certificate) => {
            const expired = certificate.expiryDate && certificate.expiryDate < new Date().toISOString().slice(0, 10);
            const Icon = certificate.mimeType.startsWith('image/') ? FileImage : FileText;
            const canManageCertificate =
              certificate.userId === userProfile?.uid ||
              (adminTeamView && certificate.ownerRole === 'member');
            return (
              <article
                key={certificate.id}
                className="flex min-h-64 flex-col rounded-3xl border border-stone-200/90 bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#F37A1F]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    expired
                      ? 'bg-red-50 text-red-700'
                      : certificate.expiryDate
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-stone-100 text-stone-600'
                  }`}>
                    {expired ? 'Expired' : certificate.expiryDate ? 'Active' : 'No expiry'}
                  </span>
                </div>
                <h3 className="mt-4 line-clamp-2 text-base font-black text-[#0F1D38]">{certificate.name}</h3>
                <p className="mt-1 text-xs font-semibold text-stone-500">{certificate.organization}</p>
                {showingTeamCertificates && (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-500">
                    <UserRound className="h-3.5 w-3.5" />
                    {certificate.ownerName || 'Employee'} · {certificate.ownerEmail}
                  </p>
                )}
                <div className="mt-4 space-y-2 border-t border-stone-100 pt-3 text-[11px] text-stone-500">
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-stone-400" />
                    Issued {formatDate(certificate.issueDate)}
                  </p>
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-stone-400" />
                    Expires {formatDate(certificate.expiryDate)}
                  </p>
                  <p className="truncate text-[10px] text-stone-400" title={certificate.originalFileName}>
                    {certificate.originalFileName}
                  </p>
                </div>
                <div className="mt-auto flex items-center gap-2 pt-4">
                  <button
                    onClick={() => void handleView(certificate)}
                    disabled={viewingId === certificate.id}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-[11px] font-bold text-[#0F1D38] transition hover:border-orange-200 hover:bg-orange-50 disabled:opacity-50"
                  >
                    {viewingId === certificate.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Eye className="h-3.5 w-3.5" />}
                    View
                  </button>
                  <button
                    onClick={() => void handleDownload(certificate)}
                    disabled={downloadingId === certificate.id}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-[11px] font-bold text-[#0F1D38] transition hover:border-orange-200 hover:bg-orange-50 disabled:opacity-50"
                  >
                    {downloadingId === certificate.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Download className="h-3.5 w-3.5" />}
                    Download
                  </button>
                  {canManageCertificate && (
                    <>
                      <button
                        onClick={() => openEditForm(certificate)}
                        aria-label={`Edit ${certificate.name}`}
                        className="rounded-xl border border-stone-200 p-2 text-stone-500 transition hover:bg-stone-50 hover:text-[#0F1D38]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => void handleDelete(certificate)}
                        disabled={deletingId === certificate.id}
                        aria-label={`Delete ${certificate.name}`}
                        className="rounded-xl border border-stone-200 p-2 text-stone-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        {deletingId === certificate.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-stone-300 bg-white px-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#F37A1F]">
            <Award className="h-7 w-7" />
          </span>
          <h3 className="mt-4 text-base font-black text-[#0F1D38]">
            {showingTeamCertificates ? 'No team certificates yet' : 'No certificates yet'}
          </h3>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-stone-500">
            {adminTeamView
              ? 'Certificates uploaded for other team members will appear here. You can add certificates for employees.'
              : showingTeamCertificates
                ? 'Certificates from other active team members will appear here.'
                : 'Upload a certificate to keep your professional achievements in one place.'}
          </p>
          {canAddCertificate && (!adminTeamView || selectedEmployeeId) && (
            <button
              onClick={openCreateForm}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#F37A1F] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" /> {adminTeamView ? 'Add Employee Certificate' : 'Add Certificate'}
            </button>
          )}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#0F1D38]/55 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="certificate-form-title"
            className="my-auto w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="certificate-form-title" className="text-xl font-black text-[#0F1D38]">
                  {editingCertificate ? 'Edit Certificate' : 'Add Certificate'}
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  {adminTeamView && selectedEmployee
                    ? `Managing certificates for ${selectedEmployee.displayName}.`
                    : 'Enter the certificate details and attach a file.'}
                </p>
              </div>
              <button
                onClick={closeForm}
                aria-label="Close"
                className="rounded-xl p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={(event) => void handleSave(event)} className="mt-6 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-[#0F1D38]">Certificate Name *</span>
                <input
                  required
                  maxLength={120}
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="e.g. Project Management Professional"
                  className="w-full rounded-xl border border-stone-200 px-3.5 py-3 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-[#0F1D38]">Issuing Organization *</span>
                <input
                  required
                  maxLength={160}
                  value={form.organization}
                  onChange={(event) => setForm({ ...form, organization: event.target.value })}
                  placeholder="e.g. Project Management Institute"
                  className="w-full rounded-xl border border-stone-200 px-3.5 py-3 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-[#0F1D38]">Issue Date *</span>
                  <input
                    required
                    type="date"
                    value={form.issueDate}
                    max={form.expiryDate || undefined}
                    onChange={(event) => setForm({ ...form, issueDate: event.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-3.5 py-3 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-[#0F1D38]">Expiry Date <span className="font-medium text-stone-400">(optional)</span></span>
                  <input
                    type="date"
                    value={form.expiryDate}
                    min={form.issueDate || undefined}
                    onChange={(event) => setForm({ ...form, expiryDate: event.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-3.5 py-3 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  />
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-[#0F1D38]">
                  Certificate File {editingCertificate ? '(optional replacement)' : '*'}
                </span>
                <span className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-[#FBF9F5] px-4 py-4 transition hover:border-orange-300 hover:bg-orange-50/50">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#F37A1F] shadow-xs">
                    {selectedFile ? <FileText className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-[#0F1D38]">
                      {selectedFile?.name || editingCertificate?.originalFileName || 'Choose a certificate file'}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-stone-500">PDF, JPG, JPEG, PNG · up to 10 MB</span>
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={handleFileSelection}
                    className="sr-only"
                  />
                </span>
              </label>
              {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}
              <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-stone-500 transition hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#F37A1F] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {saving ? 'Saving...' : editingCertificate ? 'Save Changes' : 'Upload Certificate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0F1D38]/70 p-3 backdrop-blur-sm sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="certificate-preview-title"
            className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between gap-4 border-b border-stone-200 px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <h3 id="certificate-preview-title" className="truncate text-sm font-black text-[#0F1D38]">
                  {preview.certificate.name}
                </h3>
                <p className="truncate text-xs text-stone-500">{preview.certificate.originalFileName}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleDownload(preview.certificate)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#F37A1F] px-3 py-2 text-xs font-bold text-white hover:bg-orange-600"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  aria-label="Close certificate preview"
                  className="rounded-xl p-2 text-stone-500 hover:bg-stone-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>
            {preview.certificate.mimeType.startsWith('image/') ? (
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-stone-100 p-4">
                <img
                  src={preview.url}
                  alt={preview.certificate.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <iframe
                title={preview.certificate.name}
                src={preview.url}
                className="min-h-[60vh] flex-1 bg-stone-100"
              />
            )}
          </section>
        </div>
      )}
    </section>
  );
}

export { CertificateView };
