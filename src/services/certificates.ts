import { Certificate } from '../types';
import { apiDownload, apiRequest } from './api';

export interface CertificateDetails {
  name: string;
  organization: string;
  issueDate: string;
  expiryDate: string;
}

function certificateForm(details: CertificateDetails, file?: File): FormData {
  const form = new FormData();
  form.set('name', details.name);
  form.set('organization', details.organization);
  form.set('issueDate', details.issueDate);
  form.set('expiryDate', details.expiryDate);
  if (file) form.set('file', file);
  return form;
}

export function getMyCertificates(): Promise<Certificate[]> {
  return apiRequest<Certificate[]>('/api/certificates');
}

export function getTeamCertificates(): Promise<Certificate[]> {
  return apiRequest<Certificate[]>('/api/team/certificates');
}

export function createCertificate(
  details: CertificateDetails,
  file: File,
  employeeId?: string
): Promise<Certificate> {
  const url = employeeId
    ? `/api/admin/certificates/${encodeURIComponent(employeeId)}`
    : '/api/certificates';
  return apiRequest<Certificate>(url, {
    method: 'POST',
    body: certificateForm(details, file),
  });
}

export function updateCertificate(
  certificateId: string,
  details: CertificateDetails,
  file?: File,
  isEmployeeCertificate = false
): Promise<Certificate> {
  const baseUrl = isEmployeeCertificate ? '/api/admin/certificates' : '/api/certificates';
  return apiRequest<Certificate>(`${baseUrl}/${encodeURIComponent(certificateId)}`, {
    method: 'PATCH',
    body: certificateForm(details, file),
  });
}

export function deleteCertificate(certificateId: string, isEmployeeCertificate = false): Promise<void> {
  const baseUrl = isEmployeeCertificate ? '/api/admin/certificates' : '/api/certificates';
  return apiRequest<void>(`${baseUrl}/${encodeURIComponent(certificateId)}`, {
    method: 'DELETE',
  });
}

export async function downloadCertificate(certificate: Certificate): Promise<void> {
  const blob = await apiDownload(
    `/api/certificates/${encodeURIComponent(certificate.id)}/file`
  );
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = certificate.originalFileName;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
}

export async function viewCertificate(
  certificate: Certificate
): Promise<string> {
  const blob = await apiDownload(
    `/api/certificates/${encodeURIComponent(certificate.id)}/file`
  );
  return URL.createObjectURL(new Blob([blob], { type: certificate.mimeType }));
}
