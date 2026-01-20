export interface Guest {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  category: string; // e.g., General, VIP, Staff
  checkInDay1: string | null; // ISO Date string or null
  checkInDay2: string | null; // ISO Date string or null
}

export interface ScanLog {
  id: string;
  guestId: string;
  guestName: string;
  timestamp: string;
  day: 1 | 2;
  status: 'SUCCESS' | 'DUPLICATE' | 'ERROR';
  message: string;
}

export type ViewState = 'DASHBOARD' | 'SCANNER' | 'REGISTRY' | 'SETUP';

export type SyncMode = 'ALONE' | 'HOST' | 'CLIENT';

export interface SyncMessage {
  type: 'INIT' | 'NEW_SCAN' | 'NEW_GUEST';
  payload: any;
}

export const COLORS = {
  primary: '#2563eb', // blue-600
  secondary: '#0f172a', // slate-900
  success: '#22c55e', // green-500
  warning: '#f59e0b', // amber-500
  danger: '#ef4444', // red-500
};