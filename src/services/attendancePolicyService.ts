import { Attendance, Shift, Employee } from '../types';
import { SystemSettings } from './settingsService';

export interface AdjustedAttendance extends Attendance {
  adjustedStatus: string;
  deductionHours: number;
  isSystemPunch: boolean;
  isHalfDay: boolean;
}

export const applyAttendancePolicy = (
  record: Attendance,
  shift: Shift | undefined,
  settings: SystemSettings
): AdjustedAttendance => {
  const adjusted: AdjustedAttendance = {
    ...record,
    adjustedStatus: record.status,
    deductionHours: 0,
    isSystemPunch: false,
    isHalfDay: false
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const isPastDay = record.date < todayStr;

  let effectiveStatus = record.status;
  
  // Dynamic missing punch detection for past days
  if (isPastDay) {
    if (record.check_in && !record.check_out && (effectiveStatus === 'present' || effectiveStatus === 'late')) {
      effectiveStatus = 'missing_checkout';
      adjusted.adjustedStatus = 'missing_checkout';
      adjusted.status = 'missing_checkout'; // Also reflect in main status for UI consistency
    } else if (!record.check_in && record.check_out && (effectiveStatus === 'present' || effectiveStatus === 'late')) {
      effectiveStatus = 'missing_checkin';
      adjusted.adjustedStatus = 'missing_checkin';
      adjusted.status = 'missing_checkin';
    }
  }

  if (effectiveStatus === 'missing_checkout') {
    const policy = settings.missingCheckoutPolicy;
    const hours = settings.missingCheckoutDeductionHours;

    switch (policy) {
      case 'deduct_hours':
        adjusted.deductionHours = hours;
        break;
      case 'half_day':
        adjusted.isHalfDay = true;
        break;
      case 'auto_check':
        if (shift && !record.check_out) {
          adjusted.check_out = shift.end_time;
          adjusted.adjustedStatus = 'present';
          adjusted.isSystemPunch = true;
        }
        break;
      case 'full_absence':
        adjusted.adjustedStatus = 'absent';
        break;
      case 'alert':
      default:
        // No changes
        break;
    }
  } else if (effectiveStatus === 'missing_checkin') {
    const policy = settings.missingCheckinPolicy;
    const hours = settings.missingCheckinDeductionHours;

    switch (policy) {
      case 'deduct_hours':
        adjusted.deductionHours = hours;
        break;
      case 'half_day':
        adjusted.isHalfDay = true;
        break;
      case 'auto_check':
        if (shift && !record.check_in) {
          adjusted.check_in = shift.start_time;
          adjusted.adjustedStatus = 'present';
          adjusted.isSystemPunch = true;
        }
        break;
      case 'full_absence':
        adjusted.adjustedStatus = 'absent';
        break;
      case 'alert':
      default:
        // No changes
        break;
    }
  }

  return adjusted;
};

