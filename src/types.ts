export type Role = 'admin' | 'hr' | 'employee' | 'sector_manager';

export interface UserRole {
  id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  allowed_radius?: number; // in meters
  created_at: string;
}

export interface SmartLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  is_active: boolean;
  created_at: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  location_id?: string;
  job_title: string;
  hire_date: string;
  termination_date?: string;
  salary: number;
  work_location: string; // Keeping for backward compatibility or removing if safe
  status: 'active' | 'inactive' | 'probation';
  attendance_method?: 'gps' | 'gps_photo' | 'gps_biometric';
  allowed_locations_ids?: string[];
  biometric_credential_id?: string;
  face_descriptor?: string;
  shift_id?: string;
  current_lat?: number;
  current_lng?: number;
  last_location_update?: string;
  created_at: string;
  location?: Location;
  shift?: Shift;
  employee_number?: string;
}

export interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  check_in_grace: number;
  check_out_grace: number;
  work_days: number[];
  created_at: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  check_in_photo?: string;
  check_out_photo?: string;
  status: 'present' | 'absent' | 'leave' | 'missing_checkout' | 'missing_checkin' | 'time_off' | 'late' | 'holiday';
  late_minutes?: number;
  early_exit_minutes?: number;
  created_at: string;
  employee?: Employee;
}

export interface Leave {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  type: 'sick' | 'regular' | 'unpaid' | 'other' | 'hourly';
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  created_at: string;
  employee?: Employee;
}

export interface Payroll {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  base_salary: number;
  bonuses: number;
  deductions: number;
  deduction_reasons?: { reason: string; amount: number; days: string[] }[];
  net_salary: number;
  status: 'pending' | 'paid';
  created_at: string;
  employee?: Employee;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  type: 'fixed' | 'variable'; 
  created_at: string;
}

export interface Notification {
  id: string;
  user_id?: string;
  target_role?: string;
  employee_id?: string;
  title: string;
  message: string;
  is_read: boolean;
  type: string;
  created_at: string;
}

export interface OrgNode {
  id: string;
  chart_id?: string;
  title: string;
  type: 'department' | 'role' | 'person' | 'empty';
  employee_id?: string;
  parent_id: string | null;
  color?: string; // Hex color for the header
  display_order: number;
  shift_info?: string; // e.g. "12-12 ساعة"
  employee?: Employee;
  layout?: 'horizontal' | 'vertical';
}

export interface Reward {
  id: string;
  employee_id: string;
  amount: number;
  reason: string;
  date: string;
  created_at: string;
  employee?: Employee;
}
