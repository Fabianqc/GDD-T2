import { Platform } from 'react-native';
import { getAccessToken } from './authService';
import type { ClinicalReport, ReportPeriodPreset } from '../types/clinicalReport';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (
  Platform.OS === 'web' ? 'http://localhost:8000' : 'http://10.0.2.2:8000'
);

export interface ReportQuery {
  period: ReportPeriodPreset;
  from_date?: string;
  to_date?: string;
}

function buildQuery(params: ReportQuery): string {
  const q = new URLSearchParams();
  q.set('period', params.period);
  if (params.period === 'custom') {
    if (params.from_date) q.set('from_date', params.from_date);
    if (params.to_date) q.set('to_date', params.to_date);
  }
  return q.toString();
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchClinicalReport(
  patientId: string,
  params: ReportQuery,
): Promise<ClinicalReport> {
  const headers = await authHeaders();
  const res = await fetch(
    `${API_URL}/dashboard/doctor/patient/${patientId}/clinical-report?${buildQuery(params)}`,
    { headers },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'No se pudo cargar el reporte clínico.' }));
    throw new Error(typeof err.detail === 'string' ? err.detail : 'Error al cargar reporte clínico.');
  }
  return res.json();
}

export async function downloadClinicalReport(
  patientId: string,
  params: ReportQuery,
  format: 'pdf' | 'csv',
): Promise<{ blob: Blob; filename: string; mime: string }> {
  const headers = await authHeaders();
  const res = await fetch(
    `${API_URL}/dashboard/doctor/patient/${patientId}/clinical-report/export?format=${format}&${buildQuery(params)}`,
    { headers },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'No se pudo exportar el reporte.' }));
    throw new Error(typeof err.detail === 'string' ? err.detail : 'Error al exportar reporte.');
  }

  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] || `reporte_clinico.${format}`;
  const mime = format === 'pdf' ? 'application/pdf' : 'text/csv';
  const blob = await res.blob();
  return { blob, filename, mime };
}

export async function shareOrSaveReportFile(
  blob: Blob,
  filename: string,
  mime: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const reader = new FileReader();
  const base64: string = await new Promise((resolve, reject) => {
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const b64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
  const uri = `${baseDir}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: 'Exportar reporte clínico' });
  }
}
