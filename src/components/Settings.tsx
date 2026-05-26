import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Download, 
  Database, 
  ShieldCheck, 
  FileJson, 
  FileSpreadsheet,
  AlertCircle,
  Settings as SettingsIcon,
  Calendar,
  Plus,
  Trash2,
  FileText,
  HeadphonesIcon,
  Mail,
  Phone,
  User,
  RefreshCw,
  MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SmartLocationManager from './SmartLocationManager';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { motion } from 'motion/react';
import { getSystemSettings, updateSystemSetting, SystemSettings, subscribeToSettings } from '../services/settingsService';
import { Holiday } from '../types';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function Settings() {
  const [isExporting, setIsExporting] = useState(false);
  const [isResettingAttendance, setIsResettingAttendance] = useState(false);
  const [isResettingLeaves, setIsResettingLeaves] = useState(false);
  const [isResettingPayroll, setIsResettingPayroll] = useState(false);
  const [isResetAttendanceModalOpen, setIsResetAttendanceModalOpen] = useState(false);
  const [isResetLeavesModalOpen, setIsResetLeavesModalOpen] = useState(false);
  const [isResetPayrollModalOpen, setIsResetPayrollModalOpen] = useState(false);
  
  const [attendanceResetMode, setAttendanceResetMode] = useState<'all' | 'period'>('all');
  const [attendanceStartDate, setAttendanceStartDate] = useState('');
  const [attendanceEndDate, setAttendanceEndDate] = useState('');
  
  const [leavesResetMode, setLeavesResetMode] = useState<'all' | 'period'>('all');
  const [leavesStartDate, setLeavesStartDate] = useState('');
  const [leavesEndDate, setLeavesEndDate] = useState('');

  const [payrollResetMode, setPayrollResetMode] = useState<'all' | 'month'>('all');
  const [payrollResetMonth, setPayrollResetMonth] = useState(new Date().getMonth() + 1);
  const [payrollResetYear, setPayrollResetYear] = useState(new Date().getFullYear());

  const [resetAttendanceConfirmText, setResetAttendanceConfirmText] = useState('');
  const [resetLeavesConfirmText, setResetLeavesConfirmText] = useState('');
  const [resetPayrollConfirmText, setResetPayrollConfirmText] = useState('');
  const [autoDeductionEnabled, setAutoDeductionEnabled] = useState(true);
  const [autoHourDeductionEnabled, setAutoHourDeductionEnabled] = useState(true);
  const [unpaidLeaveEnabled, setUnpaidLeaveEnabled] = useState(false);
  const [smartAttendanceEnabled, setSmartAttendanceEnabled] = useState(false);
  const [calculateDelayEnabled, setCalculateDelayEnabled] = useState(false);
  const [photoAttendanceEnabled, setPhotoAttendanceEnabled] = useState(false);
  const [allowAttendanceReRegistration, setAllowAttendanceReRegistration] = useState(false);
  
  const [missingCheckoutPolicy, setMissingCheckoutPolicy] = useState<'alert' | 'deduct_hours' | 'half_day' | 'auto_check' | 'full_absence'>('alert');
  const [missingCheckoutDeductionHours, setMissingCheckoutDeductionHours] = useState(2);
  const [missingCheckinPolicy, setMissingCheckinPolicy] = useState<'alert' | 'deduct_hours' | 'half_day' | 'auto_check' | 'full_absence'>('alert');
  const [missingCheckinDeductionHours, setMissingCheckinDeductionHours] = useState(2);
  
  const [hrContact, setHrContact] = useState({ name: 'مسؤول الموارد البشرية', phone: '+964 780 000 0000', email: 'hr@company.com' });
  const [adminContact, setAdminContact] = useState({ name: 'مسؤول النظام', phone: '+964 770 000 0000', email: 'admin@company.com' });

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayType, setNewHolidayType] = useState<'fixed' | 'variable'>('fixed');

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getSystemSettings();
      setAutoDeductionEnabled(settings.autoAbsenceDeduction);
      setAutoHourDeductionEnabled(settings.autoHourDeduction);
      setUnpaidLeaveEnabled(settings.allowUnpaidLeave);
      setSmartAttendanceEnabled(settings.smartAttendanceEnabled);
      setCalculateDelayEnabled(settings.calculateDelayEnabled);
      setPhotoAttendanceEnabled(settings.photoAttendanceEnabled);
      setAllowAttendanceReRegistration(settings.allowAttendanceReRegistration);
      setMissingCheckoutPolicy(settings.missingCheckoutPolicy);
      setMissingCheckoutDeductionHours(settings.missingCheckoutDeductionHours);
      setMissingCheckinPolicy(settings.missingCheckinPolicy);
      setMissingCheckinDeductionHours(settings.missingCheckinDeductionHours);
      setHrContact(settings.hr_contact_info);
      setAdminContact(settings.admin_contact_info);
      setHolidays(settings.system_holidays);
    };
    loadSettings();

    // Subscribe to changes
    const subscription = subscribeToSettings((change) => {
      if (change.autoAbsenceDeduction !== undefined) setAutoDeductionEnabled(change.autoAbsenceDeduction);
      if (change.autoHourDeduction !== undefined) setAutoHourDeductionEnabled(change.autoHourDeduction);
      if (change.allowUnpaidLeave !== undefined) setUnpaidLeaveEnabled(change.allowUnpaidLeave);
      if (change.smartAttendanceEnabled !== undefined) setSmartAttendanceEnabled(change.smartAttendanceEnabled);
      if (change.calculateDelayEnabled !== undefined) setCalculateDelayEnabled(change.calculateDelayEnabled);
      if (change.photoAttendanceEnabled !== undefined) setPhotoAttendanceEnabled(change.photoAttendanceEnabled);
      if (change.allowAttendanceReRegistration !== undefined) setAllowAttendanceReRegistration(change.allowAttendanceReRegistration);
      if (change.missingCheckoutPolicy !== undefined) setMissingCheckoutPolicy(change.missingCheckoutPolicy as any);
      if (change.missingCheckoutDeductionHours !== undefined) setMissingCheckoutDeductionHours(change.missingCheckoutDeductionHours);
      if (change.missingCheckinPolicy !== undefined) setMissingCheckinPolicy(change.missingCheckinPolicy as any);
      if (change.missingCheckinDeductionHours !== undefined) setMissingCheckinDeductionHours(change.missingCheckinDeductionHours);
      if (change.hr_contact_info !== undefined) setHrContact(change.hr_contact_info as any);
      if (change.admin_contact_info !== undefined) setAdminContact(change.admin_contact_info as any);
      if (change.system_holidays !== undefined) setHolidays(change.system_holidays as any);
    });

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const handleToggleAutoDeduction = async (checked: boolean) => {
    setAutoDeductionEnabled(checked);
    await updateSystemSetting('autoAbsenceDeduction', checked);
    toast.success(`تم ${checked ? 'تفعيل' : 'إيقاف'} الاستقطاع التلقائي للغياب بنجاح`);
  };

  const handleToggleAutoHourDeduction = async (checked: boolean) => {
    setAutoHourDeductionEnabled(checked);
    await updateSystemSetting('autoHourDeduction', checked);
    toast.success(`تم ${checked ? 'تفعيل' : 'إيقاف'} الاستقطاع التلقائي للساعات بنجاح`);
  };

  const handleToggleUnpaidLeave = async (checked: boolean) => {
    setUnpaidLeaveEnabled(checked);
    await updateSystemSetting('allowUnpaidLeave', checked);
    toast.success(`تم ${checked ? 'تفعيل' : 'إيقاف'} ميزة طلب إجازة بدون راتب بنجاح`);
  };

  const handleToggleSmartAttendance = async (checked: boolean) => {
    setSmartAttendanceEnabled(checked);
    await updateSystemSetting('smartAttendanceEnabled', checked);
    toast.success(`تم ${checked ? 'تفعيل' : 'إيقاف'} الحضور عبر الموقع الجغرافي (GPS) بنجاح`);
  };

  const handleToggleCalculateDelay = async (checked: boolean) => {
    setCalculateDelayEnabled(checked);
    await updateSystemSetting('calculateDelayEnabled', checked);
    toast.success(`تم ${checked ? 'تفعيل' : 'إيقاف'} ميزة احتساب التأخير بنجاح`);
  };

  const handleTogglePhotoAttendance = async (checked: boolean) => {
    setPhotoAttendanceEnabled(checked);
    await updateSystemSetting('photoAttendanceEnabled', checked);
    toast.success(`تم ${checked ? 'تفعيل' : 'إيقاف'} الحضور بصورة السيلفي بنجاح`);
  };

  const handleToggleReRegistration = async (checked: boolean) => {
    setAllowAttendanceReRegistration(checked);
    await updateSystemSetting('allowAttendanceReRegistration', checked);
    toast.success(`تم ${checked ? 'تفعيل' : 'إيقاف'} إمكانية إعادة تسجيل الحضور بنجاح`);
  };

  const handleUpdateMissingPolicy = async (type: 'checkout' | 'checkin', field: 'policy' | 'hours', value: any) => {
    if (type === 'checkout') {
      if (field === 'policy') {
        setMissingCheckoutPolicy(value);
        await updateSystemSetting('missingCheckoutPolicy', value);
      } else {
        setMissingCheckoutDeductionHours(value);
        await updateSystemSetting('missingCheckoutDeductionHours', value);
      }
    } else {
      if (field === 'policy') {
        setMissingCheckinPolicy(value);
        await updateSystemSetting('missingCheckinPolicy', value);
      } else {
        setMissingCheckinDeductionHours(value);
        await updateSystemSetting('missingCheckinDeductionHours', value);
      }
    }
    toast.success('تم تحديث سياسة الحضور والانصراف بنجاح');
  };

  const handleAddHoliday = async () => {
    if (!newHolidayName || !newHolidayDate) {
      toast.error('يرجى ملء كافة حقول العطلة');
      return;
    }

    const newHoliday: Holiday = {
      id: Math.random().toString(36).substr(2, 9),
      name: newHolidayName,
      date: newHolidayDate,
      type: newHolidayType,
      created_at: new Date().toISOString(),
    };

    const updatedHolidays = [...holidays, newHoliday].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setHolidays(updatedHolidays);
    await updateSystemSetting('system_holidays', updatedHolidays);
    
    setNewHolidayName('');
    setNewHolidayDate('');
    toast.success('تم إضافة العطلة بنجاح');
  };

  const handleRemoveHoliday = async (id: string) => {
    const updatedHolidays = holidays.filter(h => h.id !== id);
    setHolidays(updatedHolidays);
    await updateSystemSetting('system_holidays', updatedHolidays);
    toast.success('تم حذف العطلة');
  };

  const updateContactInfo = async (type: 'hr' | 'admin', field: string, value: string) => {
    if (type === 'hr') {
      const updated = { ...hrContact, [field]: value };
      setHrContact(updated);
      await updateSystemSetting('hr_contact_info', updated);
    } else {
      const updated = { ...adminContact, [field]: value };
      setAdminContact(updated);
      await updateSystemSetting('admin_contact_info', updated);
    }
  };

  const handleResetAttendance = async () => {
    setIsResettingAttendance(true);
    const toastId = toast.loading('جاري تصفير سجلات الحضور...');
    try {
      let query = supabase.from('attendance').delete();
      
      if (attendanceResetMode === 'period') {
        if (!attendanceStartDate || !attendanceEndDate) {
          throw new Error('يرجى تحديد الفترة الزمنية المراد تصفيرها');
        }
        query = query.gte('date', attendanceStartDate).lte('date', attendanceEndDate);
      } else {
        query = query.not('id', 'is', null);
      }

      const { error } = await query;
      if (error) throw error;
      toast.success('تم تصفير سجلات الحضور والغياب بنجاح', { id: toastId });
      setIsResetAttendanceModalOpen(false);
      setAttendanceResetMode('all');
      setAttendanceStartDate('');
      setAttendanceEndDate('');
    } catch (err: any) {
      console.error('Reset error:', err);
      toast.error('حدث خطأ أثناء التصفير: ' + err.message, { id: toastId });
    } finally {
      setIsResettingAttendance(false);
    }
  };

  const handleResetLeaves = async () => {
    setIsResettingLeaves(true);
    const toastId = toast.loading('جاري تصفير سجلات الإجازات...');
    try {
      let query = supabase.from('leaves').delete();

      if (leavesResetMode === 'period') {
        if (!leavesStartDate || !leavesEndDate) {
          throw new Error('يرجى تحديد الفترة الزمنية المراد تصفيرها');
        }
        query = query.gte('start_date', leavesStartDate).lte('start_date', leavesEndDate);
      } else {
        query = query.not('id', 'is', null);
      }

      const { error } = await query;
      if (error) throw error;
      // You could also reset leave balances in 'employees' if that's what the feature implies
      toast.success('تم تصفير سجلات الإجازات بنجاح', { id: toastId });
      setIsResetLeavesModalOpen(false);
      setLeavesResetMode('all');
      setLeavesStartDate('');
      setLeavesEndDate('');
    } catch (err: any) {
      console.error('Reset leave error:', err);
      toast.error('حدث خطأ أثناء التصفير: ' + err.message, { id: toastId });
    } finally {
      setIsResettingLeaves(false);
    }
  };

  const handleResetPayroll = async () => {
    setIsResettingPayroll(true);
    const toastId = toast.loading('جاري تصفير مسودات الرواتب...');
    try {
      let query = supabase.from('payroll').delete();

      if (payrollResetMode === 'month') {
        query = query.eq('month', payrollResetMonth).eq('year', payrollResetYear);
      } else {
        query = query.not('id', 'is', null);
      }

      const { error } = await query;
      if (error) throw error;
      
      toast.success('تم تصفير مسودات الرواتب بنجاح', { id: toastId });
      setIsResetPayrollModalOpen(false);
      setPayrollResetMode('all');
      setResetPayrollConfirmText('');
    } catch (err: any) {
      console.error('Reset payroll error:', err);
      toast.error('حدث خطأ أثناء التصفير: ' + err.message, { id: toastId });
    } finally {
      setIsResettingPayroll(false);
    }
  };

  const exportAllData = async (format: 'xlsx' | 'json') => {
    setIsExporting(true);
    const toastId = toast.loading('جاري تحضير نسخة احتياطية من البيانات...');

    try {
      // Fetch all relevant tables
      const [
        { data: employees },
        { data: attendance },
        { data: leaves },
        { data: payroll },
        { data: locations },
        { data: departments },
        { data: userRoles }
      ] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('attendance').select('*'),
        supabase.from('leaves').select('*'),
        supabase.from('payroll').select('*'),
        supabase.from('locations').select('*'),
        supabase.from('departments').select('*'),
        supabase.from('user_roles').select('*')
      ]);

      const allData: Record<string, any[]> = {
        'Employees': (employees || []).map(emp => {
          const { first_name, last_name, ...rest } = emp;
          return {
            'الاسم الكامل': emp.name || `${first_name || ''} ${last_name || ''}`.trim(),
            ...rest,
            'موقع العمل': locations?.find(l => l.id === emp.location_id)?.name || 'غير محدد'
          };
        }),
        'Attendance': (attendance || []).map(att => {
          const emp = employees?.find(e => e.id === att.employee_id);
          return {
            'اسم الموظف': emp ? (emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()) : 'غير معروف',
            ...att,
            'موقع العمل': locations?.find(l => l.id === emp?.location_id)?.name || 'غير محدد'
          };
        }),
        'Leaves': (leaves || []).map(leave => {
          const emp = employees?.find(e => e.id === leave.employee_id);
          return {
            'اسم الموظف': emp ? (emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()) : 'غير معروف',
            ...leave
          };
        }),
        'Payroll': (payroll || []).map(pay => {
          const emp = employees?.find(e => e.id === pay.employee_id);
          return {
            'اسم الموظف': emp ? (emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()) : 'غير معروف',
            ...pay
          };
        }),
        'Locations': locations || [],
        'Departments': departments || [],
        'UserRoles': userRoles || []
      };

      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `HR-Mohammed-Backup-${timestamp}`;

      if (format === 'json') {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", fileName + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
      } else {
        const wb = XLSX.utils.book_new();
        
        Object.entries(allData).forEach(([sheetName, data]) => {
          const ws = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        XLSX.writeFile(wb, `${fileName}.xlsx`);
      }

      toast.success('تم تصدير النسخة الاحتياطية بنجاح', { id: toastId });
    } catch (error: any) {
      console.error('Backup error:', error);
      toast.error('فشل تصدير البيانات: ' + error.message, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const [diagnosticInfo, setDiagnosticInfo] = useState<{
    settingsTable: boolean;
    smartLocationsTable: boolean;
    employeeSmartLocationsTable: boolean;
    attendanceMethodColumn: boolean;
    biometricColumn: boolean;
    earlyExitColumn: boolean;
    employeeNumberColumn: boolean;
    backendStatus: 'ok' | 'failed' | 'not_checked';
    supabaseStatus: 'connected' | 'error' | 'not_configured' | 'not_checked';
    errorDetails: string | null;
    checking: boolean;
  }>({
    settingsTable: true,
    smartLocationsTable: true,
    employeeSmartLocationsTable: true,
    attendanceMethodColumn: true,
    biometricColumn: true,
    earlyExitColumn: true,
    employeeNumberColumn: true,
    backendStatus: 'not_checked',
    supabaseStatus: 'not_checked',
    errorDetails: null,
    checking: false
  });

  const runDiagnostics = async () => {
    setDiagnosticInfo(prev => ({ ...prev, checking: true, errorDetails: null }));
    
    try {
      // 1. Check Backend Connectivity
      let bStatus: 'ok' | 'failed' = 'failed';
      let sStatus: 'connected' | 'error' | 'not_configured' = 'not_configured';
      let errDetails = null;

      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const healthData = await res.json();
          bStatus = 'ok';
          sStatus = healthData.supabase?.status || 'not_configured';
          if (healthData.supabase?.error) errDetails = healthData.supabase.error;
        }
      } catch (e: any) {
        console.error("Backend health check failed:", e);
        bStatus = 'failed';
        errDetails = e.message;
      }

      // 2. Check Database Tables/Columns via Client SDK
      const [
        { error: settingsError },
        { error: smartLocError },
        { error: empSmartLocError },
        { error: empError },
        { error: bioError },
        { error: earlyExitError },
        { error: empNoError }
      ] = await Promise.all([
        supabase.from('system_settings').select('count').limit(1),
        supabase.from('smart_locations').select('count', { count: 'exact', head: true }).limit(1),
        supabase.from('employee_smart_locations').select('count', { count: 'exact', head: true }).limit(1),
        supabase.from('employees').select('attendance_method').limit(1),
        supabase.from('employees').select('biometric_credential_id').limit(1),
        supabase.from('attendance').select('early_exit_minutes').limit(1),
        supabase.from('employees').select('employee_number').limit(1)
      ]);

      setDiagnosticInfo({
        settingsTable: !settingsError,
        smartLocationsTable: !smartLocError,
        employeeSmartLocationsTable: !empSmartLocError,
        attendanceMethodColumn: !empError,
        biometricColumn: !bioError,
        earlyExitColumn: !earlyExitError,
        employeeNumberColumn: !empNoError,
        backendStatus: bStatus,
        supabaseStatus: sStatus,
        errorDetails: errDetails,
        checking: false
      });
    } catch (err: any) {
      console.error("Diagnostics failure:", err);
      setDiagnosticInfo(prev => ({ ...prev, checking: false, errorDetails: err.message }));
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="space-y-6 pb-20 md:pb-0" dir="rtl">
      {/* Diagnostics Alert if something is missing */}
      {(!diagnosticInfo.settingsTable || !diagnosticInfo.attendanceMethodColumn || !diagnosticInfo.biometricColumn || !diagnosticInfo.smartLocationsTable || !diagnosticInfo.employeeSmartLocationsTable || !diagnosticInfo.earlyExitColumn || !diagnosticInfo.employeeNumberColumn) && !diagnosticInfo.checking && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-500 p-6 rounded-[24px] flex flex-col gap-4 animate-in fade-in zoom-in duration-500">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-100 dark:bg-amber-800 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
              <AlertCircle size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100">تنبيه: نحتاج لتحديث قاعدة البيانات للميزات الجديدة</h3>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                لتمكين ميزة "البصمة الحقيقية" أو الحضور الذكي، نحتاج لإضافة بعض الأعمدة والجداول الجديدة في مشروع Supabase الخاص بك.
              </p>
            </div>
          </div>
          
          <div className="bg-white/50 dark:bg-black/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-2">كيفية الحل (ضروري جداً):</h4>
            <ol className="text-xs text-amber-800 dark:text-amber-400 list-decimal list-inside space-y-2">
              <li>افتح لوحة تحكم <strong>Supabase</strong> الخاصة بمشروعك.</li>
              <li>انتقل إلى قسم <strong>SQL Editor</strong>.</li>
              <li>انسخ الكود الموجود في قسم "التشخيص الفني" بأسفل هذه الصفحة.</li>
              <li>الصقه في Supabase واضغط على <strong>Run</strong>.</li>
            </ol>
          </div>
          <Button 
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-12"
            onClick={() => {
              const element = document.getElementById('technical-diagnosis');
              element?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            الانتقال إلى كود الإصلاح
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">الإعدادات</h2>
        <p className="text-slate-500 dark:text-slate-400">إدارة النظام والبيانات والخصوصية</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Data Management Card */}
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-[24px] overflow-hidden">
          <CardHeader className="border-b border-slate-50 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Database size={20} />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">إدارة البيانات والنسخ الاحتياطي</CardTitle>
                <CardDescription className="text-xs">تحميل سجلات النظام بالكامل للرجوع إليها في أي وقت</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                نقترح إجراء نسخة احتياطية دورية (أسبوعياً أو شهرياً) لضمان سلامة بيانات المنشأة. النسخة تحتوي على كافة سجلات الموظفين، الحضور، الإجازات، والرواتب.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button 
                onClick={() => exportAllData('xlsx')} 
                disabled={isExporting}
                variant="outline"
                className="h-12 rounded-xl flex items-center justify-center gap-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <FileSpreadsheet size={18} className="text-green-600" />
                <span>تصدير Excel (جداول)</span>
                <Download size={14} className="mr-auto opacity-50" />
              </Button>

              <Button 
                onClick={() => exportAllData('json')} 
                disabled={isExporting}
                variant="outline"
                className="h-12 rounded-xl flex items-center justify-center gap-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <FileJson size={18} className="text-amber-600" />
                <span>تصدير JSON (تقني)</span>
                <Download size={14} className="mr-auto opacity-50" />
              </Button>
            </div>


          </CardContent>
        </Card>

        {/* System Security Card */}
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-[24px] overflow-hidden">
          <CardHeader className="border-b border-slate-50 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <ShieldCheck size={20} />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">خصوصية وأمان النظام</CardTitle>
                <CardDescription className="text-xs">معلومات حول تشفير وحماية بياناتك</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm font-bold">تشفير البيانات</span>
                  <span className="text-[10px] text-slate-500">كافة البيانات مشفرة باستخدام معايير AES-256</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              </div>
              
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm font-bold">اتصال آمن (SSL)</span>
                  <span className="text-[10px] text-slate-500">النظام يستخدم شهادات أمان مفعلة بالكامل</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg opacity-60">
                <div className="flex flex-col">
                  <span className="text-sm font-bold">الربط مع البريد (قريباً)</span>
                  <span className="text-[10px] text-slate-500">إرسال تقارير دورية إلى بريد المسؤول</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">قيد التطوير</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Holidays Management Card */}
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-[24px] overflow-hidden md:col-span-2">
          <CardHeader className="border-b border-slate-50 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Calendar size={20} />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">إعدادات الدوام والعطل</CardTitle>
                <CardDescription className="text-xs">إدارة العطل الرسمية وأيام التوقف عن العمل</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form to add holiday */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">إضافة عطلة جديدة</h4>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="holiday-name" className="text-xs">اسم العطلة</Label>
                    <Input 
                      id="holiday-name"
                      placeholder="مثال: عيد الفطر"
                      value={newHolidayName}
                      onChange={(e) => setNewHolidayName(e.target.value)}
                      className="h-10 rounded-xl border-slate-200 dark:border-slate-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="holiday-date" className="text-xs">التاريخ</Label>
                    <Input 
                      id="holiday-date"
                      type="date"
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      className="h-10 rounded-xl border-slate-200 dark:border-slate-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">نوع العطلة</Label>
                    <Select value={newHolidayType} onValueChange={(val: any) => setNewHolidayType(val)}>
                      <SelectTrigger className="h-10 rounded-xl border-slate-200 dark:border-slate-800">
                        <SelectValue placeholder="اختر النوع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">ثابتة سنويًا</SelectItem>
                        <SelectItem value="variable">تاريخ محدد (لمرة واحدة)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={handleAddHoliday}
                    className="w-full h-10 rounded-xl bg-primary hover:bg-primary/90 text-white flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    <span>إضافة العطلة</span>
                  </Button>
                </div>
              </div>

              {/* List of holidays */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">قائمة العطل الحالية</h4>
                <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                        <tr>
                          <th className="p-3">اسم العطلة</th>
                          <th className="p-3">التاريخ</th>
                          <th className="p-3">النوع</th>
                          <th className="p-3 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {holidays.length > 0 ? holidays.map((holiday) => (
                          <tr key={holiday.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{holiday.name}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-400">
                              {new Date(holiday.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                holiday.type === 'fixed' 
                                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' 
                                  : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                              }`}>
                                {holiday.type === 'fixed' ? 'ثابتة' : 'متغيرة'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <button 
                                onClick={() => handleRemoveHoliday(holiday.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-slate-400 italic">لا توجد عطل مسجلة حالياً</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
                  <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-tight">
                    ملاحظة: العطل الثابتة يتم تكرارها سنوياً في نفس التاريخ، بينما العطل المتغيرة تسري فقط في التاريخ المذكور.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Support Card */}
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-[24px] overflow-hidden md:col-span-2">
          <CardHeader className="border-b border-slate-50 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/30 rounded-xl flex items-center justify-center text-rose-600 dark:text-rose-400">
                <HeadphonesIcon size={20} />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">الدعم الفني والتواصل</CardTitle>
                <CardDescription className="text-xs">بيانات التواصل مع مسؤولي النظام والموارد البشرية</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* HR Support */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-[20px] border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm text-primary">
                    <User size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">بيانات مسؤول الموارد البشرية (HR)</h4>
                    <p className="text-[10px] text-slate-500">للاستفسارات المتعلقة بالدوام، الإجازات والرواتب</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px]">الاسم</Label>
                    <Input 
                      value={hrContact.name} 
                      onChange={(e) => updateContactInfo('hr', 'name', e.target.value)}
                      className="h-8 text-xs rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">الهاتف</Label>
                    <Input 
                      value={hrContact.phone} 
                      onChange={(e) => updateContactInfo('hr', 'phone', e.target.value)}
                      className="h-8 text-xs rounded-lg" dir="ltr"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-[10px]">البريد الإلكتروني</Label>
                    <Input 
                      value={hrContact.email} 
                      onChange={(e) => updateContactInfo('hr', 'email', e.target.value)}
                      className="h-8 text-xs rounded-lg"
                    />
                  </div>
                </div>
                <div className="pt-2 flex gap-2 border-t border-slate-200 dark:border-slate-700">
                  <a href={`tel:${hrContact.phone}`} className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-white dark:bg-slate-900 rounded-lg text-[10px] shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50">
                    <Phone size={12} /> اتصال
                  </a>
                  <a href={`mailto:${hrContact.email}`} className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-white dark:bg-slate-900 rounded-lg text-[10px] shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50">
                    <Mail size={12} /> بريد
                  </a>
                </div>
              </div>

              {/* System Admin Support */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-[20px] border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm text-indigo-500">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">بيانات مسؤول النظام (Admin)</h4>
                    <p className="text-[10px] text-slate-500">للمشاكل التقنية، كلمات المرور والصلاحيات</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px]">الاسم</Label>
                    <Input 
                      value={adminContact.name} 
                      onChange={(e) => updateContactInfo('admin', 'name', e.target.value)}
                      className="h-8 text-xs rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">الهاتف</Label>
                    <Input 
                      value={adminContact.phone} 
                      onChange={(e) => updateContactInfo('admin', 'phone', e.target.value)}
                      className="h-8 text-xs rounded-lg" dir="ltr"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-[10px]">البريد الإلكتروني</Label>
                    <Input 
                      value={adminContact.email} 
                      onChange={(e) => updateContactInfo('admin', 'email', e.target.value)}
                      className="h-8 text-xs rounded-lg"
                    />
                  </div>
                </div>
                <div className="pt-2 flex gap-2 border-t border-slate-200 dark:border-slate-700">
                  <a href={`tel:${adminContact.phone}`} className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-white dark:bg-slate-900 rounded-lg text-[10px] shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50">
                    <Phone size={12} /> اتصال
                  </a>
                  <a href={`mailto:${adminContact.email}`} className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-white dark:bg-slate-900 rounded-lg text-[10px] shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50">
                    <Mail size={12} /> بريد
                  </a>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Preferences Card */}
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-[24px] overflow-hidden md:col-span-2">
          <CardHeader className="border-b border-slate-50 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <FileText size={20} />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">السياسة العامة</CardTitle>
                <CardDescription className="text-xs">إدارة القوانين والسياسات المطبقة في النظام</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="max-w-xl space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-[16px] border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col gap-1 pr-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">السماح بإجازات بدون راتب</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[280px]">
                    عند التفعيل، سيتمكن الموظف من طلب إجازة بدون راتب في حال استنفاد رصيد إجازاته السنوية بالكامل.
                  </span>
                </div>
                <Switch 
                  checked={unpaidLeaveEnabled} 
                  onCheckedChange={handleToggleUnpaidLeave}
                  className="data-[state=checked]:bg-primary mr-4"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Preferences Card */}
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-[24px] overflow-hidden md:col-span-2">
          <CardHeader className="border-b border-slate-50 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400">
                <SettingsIcon size={20} />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">تفضيلات المعالجة</CardTitle>
                <CardDescription className="text-xs">إدارة العمليات التلقائية في النظام</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="max-w-xl space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-[16px] border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col gap-1 pr-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">الاستقطاع التلقائي للغياب</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[280px]">
                    عند التفعيل، سيقوم النظام تلقائياً بخصم أيام الغياب المسجلة من راتب الموظف عند توليد الرواتب الشهرية.
                  </span>
                </div>
                <Switch 
                  checked={autoDeductionEnabled} 
                  onCheckedChange={handleToggleAutoDeduction}
                  className="data-[state=checked]:bg-green-500 mr-4"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-[16px] border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col gap-1 pr-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">الاستقطاع التلقائي للساعات</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[280px]">
                    عند التفعيل، سيتم تطبيق استقطاع الساعات تلقائياً بناءً على سياسة نسيان البصمة المحددة.
                  </span>
                </div>
                <Switch 
                  checked={autoHourDeductionEnabled} 
                  onCheckedChange={handleToggleAutoHourDeduction}
                  className="data-[state=checked]:bg-green-500 mr-4"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Smart Attendance Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-[24px] overflow-hidden md:col-span-2">
          <CardHeader className="border-b border-slate-50 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-50 dark:bg-teal-900/30 rounded-xl flex items-center justify-center text-teal-600 dark:text-teal-400">
                <MapPin size={20} />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">نظام الحضور الذكي (Smart Attendance)</CardTitle>
                <CardDescription className="text-xs">إدارة حضور الموظفين عبر الموقع الجغرافي والتحقق بالصورة</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="max-w-xl space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-[16px] border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col gap-1 pr-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">الحضور عبر الموقع الجغرافي (GPS)</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[280px]">
                    لا يمكن للموظف تسجيل الحضور إلا إذا كان ضمن النطاق الجغرافي (المحيط) المحدد لموقع العمل الخاص به.
                  </span>
                </div>
                <Switch 
                  checked={smartAttendanceEnabled} 
                  onCheckedChange={handleToggleSmartAttendance}
                  className="data-[state=checked]:bg-teal-500 mr-4"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-[16px] border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col gap-1 pr-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">الحضور بصورة السيلفي</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[280px]">
                    يتم طلب إرفاق صورة من كاميرا الهاتف الأمامية عند تسجيل الدخول أو الخروج للتأكد من هوية الموظف.
                  </span>
                </div>
                <Switch 
                  checked={photoAttendanceEnabled} 
                  onCheckedChange={handleTogglePhotoAttendance}
                  className="data-[state=checked]:bg-teal-500 mr-4"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-[16px] border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col gap-1 pr-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">إعادة تسجيل الحضور/الانصراف</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[280px]">
                    عند التفعيل، سيتمكن الموظف من إعادة تسجيل الحضور أو الانصراف مرة أخرى في نفس اليوم (تحديث القيد).
                  </span>
                </div>
                <Switch 
                  checked={allowAttendanceReRegistration} 
                  onCheckedChange={handleToggleReRegistration}
                  className="data-[state=checked]:bg-teal-500 mr-4"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-[16px] border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col gap-1 pr-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">احتساب التأخير تلقائياً</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[280px]">
                    عند التفعيل، سيقوم النظام باحتساب دقائق التأخير بناءً على وقت بدء وردية (Shift) كل موظف.
                  </span>
                </div>
                <Switch 
                  checked={calculateDelayEnabled} 
                  onCheckedChange={handleToggleCalculateDelay}
                  className="data-[state=checked]:bg-teal-500 mr-4"
                />
              </div>

              {/* Attendance and Departure Policy Section */}
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-orange-50 dark:bg-orange-900/30 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400">
                    <FileText size={16} />
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100">سياسة الحضور والانصراف</h4>
                </div>

                {/* Missing Checkout Policy */}
                <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-[20px] border border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col gap-1 pr-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">عند نسيان بصمة الانصراف (Missing Check-out)</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      حدد الإجراء الذي سيتخذه النظام تلقائياً في حال نسيان الموظف لبصمة الانصراف.
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    <Select value={missingCheckoutPolicy} onValueChange={(val: any) => handleUpdateMissingPolicy('checkout', 'policy', val)}>
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue placeholder="اختر السياسة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alert">تنبيه فقط (الافتراضي)</SelectItem>
                        <SelectItem value="deduct_hours">خصم ساعات محددة</SelectItem>
                        <SelectItem value="half_day">احتساب نصف يوم عمل</SelectItem>
                        <SelectItem value="auto_check">انصراف تلقائي بنهاية الوردية</SelectItem>
                        <SelectItem value="full_absence">احتساب غياب كامل</SelectItem>
                      </SelectContent>
                    </Select>

                    {missingCheckoutPolicy === 'deduct_hours' && (
                      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                        <Input 
                          type="number" 
                          min="0.5" 
                          max="12" 
                          step="0.5"
                          value={missingCheckoutDeductionHours}
                          onChange={(e) => handleUpdateMissingPolicy('checkout', 'hours', parseFloat(e.target.value))}
                          className="h-10 w-24 rounded-xl text-center"
                        />
                        <span className="text-xs text-slate-500">ساعة خصم</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Missing Checkin Policy */}
                <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-[20px] border border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col gap-1 pr-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">عند نسيان بصمة الحضور (Missing Check-in)</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      حدد الإجراء الذي سيتخذه النظام تلقائياً في حال نسيان الموظف لبصمة الحضور.
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    <Select value={missingCheckinPolicy} onValueChange={(val: any) => handleUpdateMissingPolicy('checkin', 'policy', val)}>
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue placeholder="اختر السياسة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alert">تنبيه فقط (الافتراضي)</SelectItem>
                        <SelectItem value="deduct_hours">خصم ساعات محددة</SelectItem>
                        <SelectItem value="half_day">احتساب نصف يوم عمل</SelectItem>
                        <SelectItem value="auto_check">حضور تلقائي ببداية الوردية</SelectItem>
                        <SelectItem value="full_absence">احتساب غياب كامل</SelectItem>
                      </SelectContent>
                    </Select>

                    {missingCheckinPolicy === 'deduct_hours' && (
                      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                        <Input 
                          type="number" 
                          min="0.5" 
                          max="12" 
                          step="0.5"
                          value={missingCheckinDeductionHours}
                          onChange={(e) => handleUpdateMissingPolicy('checkin', 'hours', parseFloat(e.target.value))}
                          className="h-10 w-24 rounded-xl text-center"
                        />
                        <span className="text-xs text-slate-500">ساعة خصم</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {smartAttendanceEnabled && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <SmartLocationManager />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Danger Zone */}
      <div className="mt-8 border border-red-900/40 bg-red-950/10 dark:bg-red-950/20 rounded-[24px] overflow-hidden">
        <div className="p-6 md:p-8 border-b border-red-900/20 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl md:text-2xl font-black text-red-500">منطقة الخطر: تصفير السجلات</h3>
            <p className="text-sm text-red-400/80">حذف نهائي للبيانات والبدء من جديد</p>
          </div>
          <div className="w-12 h-12 bg-red-950/50 text-red-500 rounded-full flex items-center justify-center shrink-0 border border-red-900/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <AlertCircle size={24} />
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {/* Reset Attendance */}
          <div className="bg-red-950/20 border border-red-900/30 rounded-[20px] p-6 hover:bg-red-950/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 text-red-400 font-bold">
                <h4 className="text-base md:text-lg">تصفير سجلات الحضور لجميع الموظفين</h4>
                <AlertCircle size={16} />
              </div>
              <p className="text-xs md:text-sm text-red-400/70 leading-relaxed max-w-3xl">
                سيؤدي هذا الإجراء إلى حذف كافة بيانات الحضور والانصراف السابقة نهائياً لكل الموظفين والبدء بسجل نظيف فارغ. لا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
            
            <Dialog open={isResetAttendanceModalOpen} onOpenChange={(open) => {
              setIsResetAttendanceModalOpen(open);
              if (!open) setResetAttendanceConfirmText('');
            }}>
              <DialogTrigger render={
                <Button 
                  variant="outline"
                  className="rounded-xl h-11 px-6 border-red-900/50 bg-red-950/30 text-red-500 hover:bg-red-900/50 hover:text-red-400 font-bold transition-all shrink-0"
                />
              }>
                  <RefreshCw size={16} className="ml-2" />
                  تصفير الحضور والغياب
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]" dir="rtl">
                <DialogHeader className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertCircle size={20} />
                    <DialogTitle className="text-xl">تأكيد تصفير الحضور والغياب</DialogTitle>
                  </div>
                  <DialogDescription className="text-base text-slate-300 bg-red-950/20 p-4 rounded-xl border border-red-900/30">
                    هل أنت متأكد تماماً من رغبتك في حذف كافة بيانات الحضور والغياب؟ يرجى أخذ <strong className="text-white">نسخة احتياطية</strong> قبل اتخاذ هذا القرار.
                  </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-slate-200">نوع التصفير:</Label>
                    <Select value={attendanceResetMode} onValueChange={(val: any) => setAttendanceResetMode(val)}>
                      <SelectTrigger className="h-12 rounded-xl border-red-900/30 bg-red-950/10 text-red-400">
                        <SelectValue placeholder="اختر نوع التصفير" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                        <SelectItem value="all">تصفير كافة السجلات (كامل)</SelectItem>
                        <SelectItem value="period">تصفير لفترة زمنية محددة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {attendanceResetMode === 'period' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-red-950/20 border border-red-900/30"
                    >
                      <div className="space-y-2">
                        <Label className="text-xs text-red-400">من تاريخ:</Label>
                        <Input 
                          type="date"
                          value={attendanceStartDate}
                          onChange={e => setAttendanceStartDate(e.target.value)}
                          className="h-10 rounded-lg border-red-900/30 bg-red-950/20 text-red-400"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-red-400">إلى تاريخ:</Label>
                        <Input 
                          type="date"
                          value={attendanceEndDate}
                          onChange={e => setAttendanceEndDate(e.target.value)}
                          className="h-10 rounded-lg border-red-900/30 bg-red-950/20 text-red-400"
                        />
                      </div>
                    </motion.div>
                  )}

                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-slate-200">يرجى كتابة كلمة "تصفير" للتأكيد:</Label>
                    <Input 
                      value={resetAttendanceConfirmText} 
                      onChange={e => setResetAttendanceConfirmText(e.target.value)}
                      className="border-red-900/50 focus-visible:ring-red-500/20 bg-red-950/10 text-red-500 text-center font-black text-xl h-14"
                      placeholder="تصفير"
                    />
                  </div>
                </div>

                <DialogFooter className="flex-col sm:justify-start">
                  <Button 
                    variant="destructive" 
                    onClick={handleResetAttendance} 
                    disabled={isResettingAttendance || resetAttendanceConfirmText !== 'تصفير'}
                    className="rounded-xl w-full h-14 text-base font-bold"
                  >
                    <RefreshCw size={18} className="ml-2" />
                    {isResettingAttendance ? 'جاري الحذف...' : 'احذف كافة سجلات الحضور الآن'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Reset Leaves */}
          <div className="bg-red-950/20 border border-red-900/30 rounded-[20px] p-6 hover:bg-red-950/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 text-red-400 font-bold">
                <h4 className="text-base md:text-lg">تصفير سجلات الإجازات لجميع الموظفين</h4>
                <AlertCircle size={16} />
              </div>
              <p className="text-xs md:text-sm text-red-400/70 leading-relaxed max-w-3xl">
                سيؤدي هذا الإجراء إلى حذف كافة بيانات الإجازات (المرضية، السنوية وغيرها) والأرصدة لجميع الموظفين نهائياً.
              </p>
            </div>
            
            <Dialog open={isResetLeavesModalOpen} onOpenChange={(open) => {
              setIsResetLeavesModalOpen(open);
              if (!open) setResetLeavesConfirmText('');
            }}>
              <DialogTrigger render={
                <Button 
                  variant="outline"
                  className="rounded-xl h-11 px-6 border-red-900/50 bg-red-950/30 text-red-500 hover:bg-red-900/50 hover:text-red-400 font-bold transition-all shrink-0"
                />
              }>
                  <RefreshCw size={16} className="ml-2" />
                  تصفير الإجازات
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]" dir="rtl">
                <DialogHeader className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertCircle size={20} />
                    <DialogTitle className="text-xl">تأكيد تصفير الإجازات</DialogTitle>
                  </div>
                  <DialogDescription className="text-base text-slate-300 bg-red-950/20 p-4 rounded-xl border border-red-900/30">
                    هل أنت متأكد تماماً من رغبتك في حذف كافة بيانات الإجازات؟ يرجى أخذ <strong className="text-white">نسخة احتياطية</strong> قبل اتخاذ هذا القرار.
                  </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-slate-200">نوع التصفير:</Label>
                    <Select value={leavesResetMode} onValueChange={(val: any) => setLeavesResetMode(val)}>
                      <SelectTrigger className="h-12 rounded-xl border-red-900/30 bg-red-950/10 text-red-400">
                        <SelectValue placeholder="اختر نوع التصفير" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                        <SelectItem value="all">تصفير كافة السجلات (كامل)</SelectItem>
                        <SelectItem value="period">تصفير لفترة زمنية محددة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {leavesResetMode === 'period' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-red-950/20 border border-red-900/30"
                    >
                      <div className="space-y-2">
                        <Label className="text-xs text-red-400">من تاريخ:</Label>
                        <Input 
                          type="date"
                          value={leavesStartDate}
                          onChange={e => setLeavesStartDate(e.target.value)}
                          className="h-10 rounded-lg border-red-900/30 bg-red-950/20 text-red-400"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-red-400">إلى تاريخ:</Label>
                        <Input 
                          type="date"
                          value={leavesEndDate}
                          onChange={e => setLeavesEndDate(e.target.value)}
                          className="h-10 rounded-lg border-red-900/30 bg-red-950/20 text-red-400"
                        />
                      </div>
                    </motion.div>
                  )}

                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-slate-200">يرجى كتابة كلمة "تصفير" للتأكيد:</Label>
                    <Input 
                      value={resetLeavesConfirmText} 
                      onChange={e => setResetLeavesConfirmText(e.target.value)}
                      className="border-red-900/50 focus-visible:ring-red-500/20 bg-red-950/10 text-red-500 text-center font-black text-xl h-14"
                      placeholder="تصفير"
                    />
                  </div>
                </div>

                <DialogFooter className="flex-col sm:justify-start">
                  <Button 
                    variant="destructive" 
                    onClick={handleResetLeaves} 
                    disabled={isResettingLeaves || resetLeavesConfirmText !== 'تصفير'}
                    className="rounded-xl w-full h-14 text-base font-bold"
                  >
                    <RefreshCw size={18} className="ml-2" />
                    {isResettingLeaves ? 'جاري الحذف...' : 'احذف كافة الإجازات الآن'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Reset Payroll */}
          <div className="bg-red-950/20 border border-red-900/30 rounded-[20px] p-6 hover:bg-red-950/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 text-red-400 font-bold">
                <h4 className="text-base md:text-lg">تصفير مسودات وقوائم الرواتب</h4>
                <AlertCircle size={16} />
              </div>
              <p className="text-xs md:text-sm text-red-400/70 leading-relaxed max-w-3xl">
                سيؤدي هذا الإجراء إلى حذف كافة مسودات وقوائم الرواتب التي تم إنشاؤها مسبقاً. تأكد من ترحيل الرواتب أو أخذ نسخة احتياطية قبل التصفير.
              </p>
            </div>
            
            <Dialog open={isResetPayrollModalOpen} onOpenChange={(open) => {
              setIsResetPayrollModalOpen(open);
              if (!open) setResetPayrollConfirmText('');
            }}>
              <DialogTrigger render={
                <Button 
                  variant="outline"
                  className="rounded-xl h-11 px-6 border-red-900/50 bg-red-950/30 text-red-500 hover:bg-red-900/50 hover:text-red-400 font-bold transition-all shrink-0"
                />
              }>
                  <RefreshCw size={16} className="ml-2" />
                  تصفير مسودات الرواتب
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]" dir="rtl">
                <DialogHeader className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertCircle size={20} />
                    <DialogTitle className="text-xl">تأكيد تصفير الرواتب</DialogTitle>
                  </div>
                  <DialogDescription className="text-base text-slate-300 bg-red-950/20 p-4 rounded-xl border border-red-900/30">
                    هل أنت متأكد تماماً من رغبتك في حذف مسودات الرواتب؟ يرجى أخذ <strong className="text-white">نسخة احتياطية</strong> قبل اتخاذ هذا القرار.
                  </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-slate-200">نوع التصفير:</Label>
                    <Select value={payrollResetMode} onValueChange={(val: any) => setPayrollResetMode(val)}>
                      <SelectTrigger className="h-12 rounded-xl border-red-900/30 bg-red-950/10 text-red-400">
                        <SelectValue placeholder="اختر نوع التصفير" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                        <SelectItem value="all">تصفير كافة السجلات (كامل)</SelectItem>
                        <SelectItem value="month">تصفير لشهر وسنة محددة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {payrollResetMode === 'month' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-red-950/20 border border-red-900/30"
                    >
                      <div className="space-y-2">
                        <Label className="text-xs text-red-400">الشهر:</Label>
                        <Select value={payrollResetMonth.toString()} onValueChange={(v) => setPayrollResetMonth(parseInt(v))}>
                          <SelectTrigger className="h-10 rounded-lg border-red-900/30 bg-red-950/20 text-red-400">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                            {[...Array(12)].map((_, i) => (
                              <SelectItem key={i+1} value={(i+1).toString()}>{i+1}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-red-400">السنة:</Label>
                        <Select value={payrollResetYear.toString()} onValueChange={(v) => setPayrollResetYear(parseInt(v))}>
                          <SelectTrigger className="h-10 rounded-lg border-red-900/30 bg-red-950/20 text-red-400">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                            {[2024, 2025, 2026, 2027].map(year => (
                              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </motion.div>
                  )}

                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-slate-200">يرجى كتابة كلمة "تصفير" للتأكيد:</Label>
                    <Input 
                      value={resetPayrollConfirmText} 
                      onChange={e => setResetPayrollConfirmText(e.target.value)}
                      className="border-red-900/50 focus-visible:ring-red-500/20 bg-red-950/10 text-red-500 text-center font-black text-xl h-14"
                      placeholder="تصفير"
                    />
                  </div>
                </div>

                <DialogFooter className="flex-col sm:justify-start">
                  <Button 
                    variant="destructive" 
                    onClick={handleResetPayroll} 
                    disabled={isResettingPayroll || resetPayrollConfirmText !== 'تصفير'}
                    className="rounded-xl w-full h-14 text-base font-bold"
                  >
                    <RefreshCw size={18} className="ml-2" />
                    {isResettingPayroll ? 'جاري الحذف...' : 'احذف كافة مسودات الرواتب الآن'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
      {/* Technical Diagnosis Card */}
      <Card id="technical-diagnosis" className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-[24px] overflow-hidden mt-6">
        <CardHeader className="border-b border-slate-50 dark:border-slate-800 pb-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400">
              <RefreshCw size={20} className={diagnosticInfo.checking ? "animate-spin" : ""} />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg font-bold">التشخيص الفني والربط (Technical Diagnostics)</CardTitle>
              <CardDescription className="text-xs">التحقق من حالة الاتصال وقاعدة البيانات</CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={runDiagnostics} 
            disabled={diagnosticInfo.checking} 
            className="rounded-lg text-[10px] h-8 gap-2"
          >
            <RefreshCw size={14} className={diagnosticInfo.checking ? "animate-spin" : ""} />
            تحديث الفحص
          </Button>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className={`p-4 rounded-2xl border flex flex-col gap-2 ${diagnosticInfo.backendStatus === 'ok' ? 'bg-green-50 border-green-100 dark:bg-green-950/10' : 'bg-red-50 border-red-100 dark:bg-red-950/10'}`}>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">حالة خادم (API)</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${diagnosticInfo.backendStatus === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-bold">{diagnosticInfo.backendStatus === 'ok' ? 'متصل' : 'غير متصل'}</span>
              </div>
            </div>
            <div className={`p-4 rounded-2xl border flex flex-col gap-2 ${diagnosticInfo.supabaseStatus === 'connected' ? 'bg-green-50 border-green-100 dark:bg-green-950/10' : (diagnosticInfo.supabaseStatus === 'not_configured' ? 'bg-slate-50 border-slate-100 dark:bg-slate-800/50' : 'bg-red-50 border-red-100 dark:bg-red-950/10')}`}>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ربط سوبابيس (Admin)</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${diagnosticInfo.supabaseStatus === 'connected' ? 'bg-green-500' : (diagnosticInfo.supabaseStatus === 'not_configured' ? 'bg-slate-400' : 'bg-red-500')}`} />
                <span className="text-sm font-bold">
                  {diagnosticInfo.supabaseStatus === 'connected' ? 'متصل' : 
                   diagnosticInfo.supabaseStatus === 'not_configured' ? 'غير مهيأ' : 'خطأ في الربط'}
                </span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">سلامة الجداول</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${diagnosticInfo.settingsTable && diagnosticInfo.smartLocationsTable ? 'bg-green-500' : 'bg-amber-500'}`} />
                <span className="text-sm font-bold">{(diagnosticInfo.settingsTable && diagnosticInfo.smartLocationsTable) ? 'سليمة' : 'تحتاج تحديث'}</span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">الهيكل البرمجي</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${diagnosticInfo.attendanceMethodColumn && diagnosticInfo.employeeNumberColumn ? 'bg-green-500' : 'bg-amber-500'}`} />
                <span className="text-sm font-bold">{(diagnosticInfo.attendanceMethodColumn && diagnosticInfo.employeeNumberColumn) ? 'مكتمل' : 'ناقص'}</span>
              </div>
            </div>
          </div>

          {diagnosticInfo.errorDetails && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl flex items-start gap-3">
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold text-red-700 dark:text-red-400">تفاصيل الخطأ المرصود:</p>
                <p className="text-[10px] text-red-600 dark:text-red-400/80 mt-1 font-mono break-words">{diagnosticInfo.errorDetails}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={`p-3 rounded-xl border flex items-center justify-between ${diagnosticInfo.settingsTable ? 'bg-green-50 border-green-100 dark:bg-green-950/10' : 'bg-red-50 border-red-100 dark:bg-red-950/10'}`}>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold">جدول الإعدادات</span>
                <span className="text-[9px] text-slate-400">system_settings</span>
              </div>
              {diagnosticInfo.settingsTable ? <ShieldCheck size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-500" />}
            </div>
            <div className={`p-3 rounded-xl border flex items-center justify-between ${diagnosticInfo.smartLocationsTable ? 'bg-green-50 border-green-100 dark:bg-green-950/10' : 'bg-red-50 border-red-100 dark:bg-red-950/10'}`}>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold">جدول المواقع الذكية</span>
                <span className="text-[9px] text-slate-400">smart_locations</span>
              </div>
              {diagnosticInfo.smartLocationsTable ? <ShieldCheck size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-500" />}
            </div>
            <div className={`p-3 rounded-xl border flex items-center justify-between ${diagnosticInfo.employeeSmartLocationsTable ? 'bg-green-50 border-green-100 dark:bg-green-950/10' : 'bg-red-50 border-red-100 dark:bg-red-950/10'}`}>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold">ربط الموظف بالمواقع</span>
                <span className="text-[9px] text-slate-400">employee_smart_locations</span>
              </div>
              {diagnosticInfo.employeeSmartLocationsTable ? <ShieldCheck size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-500" />}
            </div>
            <div className={`p-3 rounded-xl border flex items-center justify-between ${diagnosticInfo.attendanceMethodColumn ? 'bg-green-50 border-green-100 dark:bg-green-950/10' : 'bg-red-50 border-red-200 dark:bg-red-950/10'}`}>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold">عمود طريقة الحضور</span>
                <span className="text-[9px] text-slate-400">attendance_method</span>
              </div>
              {diagnosticInfo.attendanceMethodColumn ? <ShieldCheck size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-500" />}
            </div>
            <div className={`p-3 rounded-xl border flex items-center justify-between ${diagnosticInfo.biometricColumn ? 'bg-green-50 border-green-100 dark:bg-green-950/10' : 'bg-red-50 border-red-200 dark:bg-red-950/10'}`}>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold">عمود تسجيل البصمة</span>
                <span className="text-[9px] text-slate-400">biometric_credential_id</span>
              </div>
              {diagnosticInfo.biometricColumn ? <ShieldCheck size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-500" />}
            </div>
            <div className={`p-3 rounded-xl border flex items-center justify-between ${diagnosticInfo.earlyExitColumn ? 'bg-green-50 border-green-100 dark:bg-green-950/10' : 'bg-red-50 border-red-200 dark:bg-red-950/10'}`}>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold">عمود الانصراف المبكر</span>
                <span className="text-[9px] text-slate-400">early_exit_minutes</span>
              </div>
              {diagnosticInfo.earlyExitColumn ? <ShieldCheck size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-500" />}
            </div>
            <div className={`p-3 rounded-xl border flex items-center justify-between ${diagnosticInfo.employeeNumberColumn ? 'bg-green-50 border-green-100 dark:bg-green-950/10' : 'bg-red-50 border-red-200 dark:bg-red-950/10'}`}>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold">عمود رقم الموظف</span>
                <span className="text-[9px] text-slate-400">employee_number</span>
              </div>
              {diagnosticInfo.employeeNumberColumn ? <ShieldCheck size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-500" />}
            </div>
          </div>

          {(!diagnosticInfo.settingsTable || !diagnosticInfo.attendanceMethodColumn || !diagnosticInfo.biometricColumn || !diagnosticInfo.smartLocationsTable || !diagnosticInfo.employeeNumberColumn) && (
            <div className="mt-6 p-4 bg-slate-900 rounded-xl border border-slate-800 text-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-xs font-bold text-amber-400">حل المشكلة: قم بتنفيذ هذا الكود في Supabase SQL Editor</h5>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-[10px] text-slate-400 hover:text-white"
                  onClick={() => {
                    const sql = `
-- 1. Add columns to employees if missing
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employee_number TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS attendance_method TEXT DEFAULT 'standard';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS allowed_locations_ids JSONB DEFAULT '[]';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS biometric_credential_id TEXT;

-- 2. Trigger schema reload to ensure API sees the changes
NOTIFY pgrst, 'reload schema';

-- 3. Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create smart_locations table
CREATE TABLE IF NOT EXISTS public.smart_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius DOUBLE PRECISION DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create join table
CREATE TABLE IF NOT EXISTS public.employee_smart_locations (
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    smart_location_id UUID REFERENCES public.smart_locations(id) ON DELETE CASCADE,
    PRIMARY KEY (employee_id, smart_location_id)
);

-- 6. Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_smart_locations ENABLE ROW LEVEL SECURITY;

-- 7. Set RLS Policies (Safe approach)
DO $$ 
BEGIN
    -- System Settings Policies
    DROP POLICY IF EXISTS "Everyone can read settings" ON public.system_settings;
    DROP POLICY IF EXISTS "Admins can manage settings" ON public.system_settings;
    
    CREATE POLICY "Everyone can read settings" ON public.system_settings FOR SELECT USING (true);
    CREATE POLICY "Admins can manage settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);

    -- Smart Locations Policies
    DROP POLICY IF EXISTS "Everyone can read smart locations" ON public.smart_locations;
    DROP POLICY IF EXISTS "Admins can manage smart locations" ON public.smart_locations;

    CREATE POLICY "Everyone can read smart locations" ON public.smart_locations FOR SELECT USING (true);
    CREATE POLICY "Admins can manage smart locations" ON public.smart_locations FOR ALL USING (true) WITH CHECK (true);

    -- Employee Smart Locations Policies
    DROP POLICY IF EXISTS "Everyone can read employee smart locations" ON public.employee_smart_locations;
    DROP POLICY IF EXISTS "Admins can manage employee smart locations" ON public.employee_smart_locations;

    CREATE POLICY "Everyone can read employee smart locations" ON public.employee_smart_locations FOR SELECT USING (true);
    CREATE POLICY "Admins can manage employee smart locations" ON public.employee_smart_locations FOR ALL USING (true) WITH CHECK (true);
END $$;
                    `;
                    navigator.clipboard.writeText(sql);
                    toast.success('تم نسخ الكود البرمجي SQL إلى الحافظة');
                  }}
                >
                  نسخ الكود SQL
                </Button>
              </div>
              <pre className="text-[10px] font-mono bg-black/40 p-3 rounded-lg overflow-x-auto max-h-[200px]" dir="ltr">
{`-- Execute this in Supabase SQL Editor:
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employee_number TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS attendance_method TEXT DEFAULT 'standard';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS allowed_locations_ids JSONB DEFAULT '[]';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS biometric_credential_id TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS early_exit_minutes INTEGER DEFAULT 0;

-- Trigger schema reload to fix "column not in cache" error
NOTIFY pgrst, 'reload schema';

CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.smart_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius DOUBLE PRECISION DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_smart_locations (
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    smart_location_id UUID REFERENCES public.smart_locations(id) ON DELETE CASCADE,
    PRIMARY KEY (employee_id, smart_location_id)
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_smart_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Public Read Settings" ON public.system_settings;
DROP POLICY IF EXISTS "Full Access Settings" ON public.system_settings;
CREATE POLICY "Public Read Settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Full Access Settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Locations" ON public.smart_locations;
DROP POLICY IF EXISTS "Full Access Locations" ON public.smart_locations;
CREATE POLICY "Public Read Locations" ON public.smart_locations FOR SELECT USING (true);
CREATE POLICY "Full Access Locations" ON public.smart_locations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Emp Locations" ON public.employee_smart_locations;
DROP POLICY IF EXISTS "Full Access Emp Locations" ON public.employee_smart_locations;
CREATE POLICY "Public Read Emp Locations" ON public.employee_smart_locations FOR SELECT USING (true);
CREATE POLICY "Full Access Emp Locations" ON public.employee_smart_locations FOR ALL USING (true) WITH CHECK (true);`}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
