import { supabase } from '../lib/supabase';

export interface SystemSettings {
  smartAttendanceEnabled: boolean;
  photoAttendanceEnabled: boolean;
  allowAttendanceReRegistration: boolean;
  calculateDelayEnabled: boolean;
  autoAbsenceDeduction: boolean;
  autoHourDeduction: boolean;
  allowUnpaidLeave: boolean;
  hr_contact_info: { name: string; phone: string; email: string };
  admin_contact_info: { name: string; phone: string; email: string };
  system_holidays: any[];
  missingCheckoutPolicy: 'alert' | 'deduct_hours' | 'half_day' | 'auto_check' | 'full_absence';
  missingCheckoutDeductionHours: number;
  missingCheckinPolicy: 'alert' | 'deduct_hours' | 'half_day' | 'auto_check' | 'full_absence';
  missingCheckinDeductionHours: number;
}

const DEFAULT_SETTINGS: SystemSettings = {
  smartAttendanceEnabled: false,
  photoAttendanceEnabled: false,
  allowAttendanceReRegistration: false,
  calculateDelayEnabled: false,
  autoAbsenceDeduction: true,
  autoHourDeduction: true,
  allowUnpaidLeave: false,
  hr_contact_info: { name: 'مسؤول الموارد البشرية', phone: '+964 780 000 0000', email: 'hr@company.com' },
  admin_contact_info: { name: 'مسؤول النظام', phone: '+964 770 000 0000', email: 'admin@company.com' },
  system_holidays: [
    { id: '1', name: 'رأس السنة الميلادية', date: '2026-01-01', type: 'fixed', created_at: new Date().toISOString() },
    { id: '2', name: 'عيد الجيش', date: '2026-01-06', type: 'fixed', created_at: new Date().toISOString() },
    { id: '3', name: 'عيد العمال', date: '2026-05-01', type: 'fixed', created_at: new Date().toISOString() },
  ],
  missingCheckoutPolicy: 'alert',
  missingCheckoutDeductionHours: 2,
  missingCheckinPolicy: 'alert',
  missingCheckinDeductionHours: 2
};

export const getSystemSettings = async (): Promise<SystemSettings> => {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*');

    const settings = { ...DEFAULT_SETTINGS };

    // 1. Initial values from localStorage for zero-latency UI
    Object.keys(settings).forEach(key => {
      const localValue = localStorage.getItem(key);
      if (localValue !== null) {
        try {
          (settings as any)[key] = JSON.parse(localValue);
        } catch {
          (settings as any)[key] = localValue;
        }
      }
    });

    if (error) {
       console.warn('System settings table error, using local storage:', error.message);
       return settings;
    }

    // 2. Override with Real Database data for global synchronization
    if (data && data.length > 0) {
      data.forEach(row => {
        if (row.key in settings) {
          (settings as any)[row.key] = row.value;
          // Sync back to local storage for next session start
          localStorage.setItem(row.key, typeof row.value === 'string' ? row.value : JSON.stringify(row.value));
        }
      });
    }

    return settings;
  } catch (err) {
    console.error('Error fetching system settings:', err);
    return DEFAULT_SETTINGS;
  }
};

export const updateSystemSetting = async (key: keyof SystemSettings, value: any) => {
  // Always update localStorage as immediate fallback
  localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));

  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() });

    if (error) {
      console.warn('Failed to save to Supabase, but saved locally:', error.message);
    }
    return { success: !error };
  } catch (err) {
    console.error('Error updating system setting:', err);
    return { success: false, error: err };
  }
};

export const subscribeToSettings = (callback: (settings: Partial<SystemSettings>) => void) => {
  return supabase
    .channel('system_settings_changes')
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'system_settings' 
    }, (payload) => {
      if (payload.new && (payload.new as any).key) {
        const { key, value } = payload.new as any;
        callback({ [key]: value });
      }
    })
    .subscribe();
};
