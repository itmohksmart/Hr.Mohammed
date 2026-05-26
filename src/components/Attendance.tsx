import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Attendance as AttendanceType, Employee, Location, Shift } from '../types';
import { toast } from 'sonner';
import { Clock, CheckCircle2, XCircle, AlertCircle, LogIn, LogOut, Search, Printer, MapPin, Coffee, Calendar as CalendarIcon, UserX, Clock9, ShieldQuestion } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Calendar, List, Filter, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
// @ts-ignore
import domtoimage from 'dom-to-image-more';
import SmartAttendanceWidget from './SmartAttendanceWidget';
import { getSystemSettings, SystemSettings } from '../services/settingsService';
import { applyAttendancePolicy } from '../services/attendancePolicyService';

const statusLabels: Record<string, string> = {
  present: 'حاضر',
  absent: 'غائب',
  leave: 'مجاز',
  missing_checkout: 'غياب بصمة انصراف',
  missing_checkin: 'غياب بصمة حضور',
  time_off: 'زمنية الى نهاية الدوام',
  late: 'متأخر',
  holiday: 'عطلة'
};

const statusIcons: Record<string, React.ReactNode> = {
  present: <CheckCircle2 size={14} className="text-green-500" />,
  absent: <UserX size={14} className="text-red-500" />,
  leave: <Coffee size={14} className="text-blue-500" />,
  missing_checkout: <Clock9 size={14} className="text-orange-500" />,
  missing_checkin: <Clock9 size={14} className="text-orange-600" />,
  time_off: <Clock size={14} className="text-purple-500" />,
  late: <AlertCircle size={14} className="text-yellow-600" />,
  holiday: <CalendarIcon size={14} className="text-slate-500" />
};

const getStatusColorClasses = (status: string | undefined) => {
  switch (status) {
    case 'present': return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
    case 'absent': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
    case 'leave': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800';
    case 'missing_checkout': 
    case 'missing_checkin': return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800';
    case 'time_off': return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800';
    case 'late': return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800';
    case 'holiday': return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    default: return 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700';
  }
};

const getLateMinutesClasses = (minutes: number) => {
  if (minutes >= 30) {
    return "border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10 text-red-700 dark:text-red-400 hover:border-red-400 focus-visible:ring-red-500/20";
  }
  return "border-amber-200 dark:border-amber-800/50 bg-amber-50/10 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 hover:border-amber-400 focus-visible:ring-amber-500/20";
};

const getEarlyExitMinutesClasses = (minutes: number) => {
  if (minutes >= 30) {
    return "border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10 text-red-700 dark:text-red-400 hover:border-red-400 focus-visible:ring-red-500/20";
  }
  return "border-amber-200 dark:border-amber-800/50 bg-amber-50/10 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 hover:border-amber-400 focus-visible:ring-amber-500/20";
};

const getLateIconColor = (minutes: number) => {
  return minutes >= 30 ? "text-red-400" : "text-amber-400";
};

const getEarlyExitIconColor = (minutes: number) => {
  return minutes >= 30 ? "text-red-400" : "text-amber-400";
};

const getPdfStatusBadge = (status: string | undefined) => {
  if (!status) return <span className="text-slate-400 font-bold text-xs whitespace-nowrap">لم يسجل</span>;
  
  const colors: Record<string, { bg: string, text: string, border: string }> = {
    present: { bg: 'bg-green-100', text: 'text-green-800 font-extrabold', border: 'border-green-300' },
    absent: { bg: 'bg-red-100', text: 'text-red-800 font-extrabold', border: 'border-red-300' },
    leave: { bg: 'bg-blue-100', text: 'text-blue-800 font-extrabold', border: 'border-blue-300' },
    missing_checkout: { bg: 'bg-orange-100', text: 'text-orange-850 font-extrabold', border: 'border-orange-200' },
    missing_checkin: { bg: 'bg-orange-100', text: 'text-orange-850 font-extrabold', border: 'border-orange-200' },
    time_off: { bg: 'bg-purple-100', text: 'text-purple-800 font-extrabold', border: 'border-purple-300' },
    late: { bg: 'bg-yellow-105 bg-yellow-100', text: 'text-yellow-800 font-extrabold', border: 'border-yellow-300' },
    holiday: { bg: 'bg-slate-100', text: 'text-slate-600 font-extrabold', border: 'border-slate-300' },
  };

  const badge = colors[status] || { bg: 'bg-slate-50', text: 'text-slate-700 font-extrabold', border: 'border-slate-200' };
  const label = statusLabels[status] || 'لم يسجل';

  return (
    <span className={`px-2 py-0.5 rounded border text-[10px] whitespace-nowrap ${badge.bg} ${badge.text} ${badge.border}`}>
      {label}
    </span>
  );
};

export default function Attendance() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null);
  const [currentEmployeeData, setCurrentEmployeeData] = useState<Employee | null>(null);
  const [monthlyAttendance, setMonthlyAttendance] = useState<AttendanceType[]>([]);
  const [selectedEmployeeForMonthly, setSelectedEmployeeForMonthly] = useState<string | 'all'>('all');
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    fetchData();
    fetchUserRole();
  }, [selectedDate, viewMode, selectedMonth, selectedEmployeeForMonthly]);

  const fetchUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();
      if (data) {
        setUserRole(data.role);
        // Set default view mode to monthly for regular employees
        if (data.role === 'employee') {
          setViewMode('monthly');
        }
      }
      
      // Get current employee ID
      const { data: currentEmp, error: empErr } = await supabase
        .from('employees')
        .select('*, location:locations(name), shift:shifts(name)')
        .eq('email', session.user.email)
        .maybeSingle();

      if (currentEmp) {
        setCurrentEmployeeId(currentEmp.id);
        setCurrentEmployeeData({
          ...currentEmp,
          name: currentEmp.name || `${currentEmp.first_name || ''} ${currentEmp.last_name || ''}`.trim()
        });
        if (!selectedEmployeeForMonthly || selectedEmployeeForMonthly === 'all') {
          setSelectedEmployeeForMonthly(currentEmp.id);
        }
      } else if (empErr) {
        console.error("Error fetching current employee:", empErr);
      }
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Fetch user role first to decide filtering
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();
    
    const role = roleData?.role || 'employee';
    const isHRorAdmin = role === 'admin' || role === 'hr';
    const isSectorManager = role === 'sector_manager';

    const systemSettings = await getSystemSettings();
    setSettings(systemSettings);

    if (viewMode === 'daily') {
      let empQuery = supabase.from('employees').select('*, location:locations(*)');
      
      // If admin/HR, we might want to only show active by default but we need a way to see all if needed
      // For the widget, we definitely need the current employee regardless of status
      
      let attQuery = supabase.from('attendance').select('*, employee:employees(*)').eq('date', selectedDate);

      // If sector manager, we need to find their location first
      if (isSectorManager) {
        const { data: managerEmp } = await supabase
          .from('employees')
          .select('location_id')
          .eq('email', session.user.email)
          .single();
        
        if (managerEmp?.location_id) {
          empQuery = empQuery.eq('location_id', managerEmp.location_id);
          attQuery = attQuery.filter('employee.location_id', 'eq', managerEmp.location_id);
          setLocationFilter(managerEmp.location_id);
        }
      } else if (!isHRorAdmin) {
        // If employee, only fetch their own data
        const { data: currentUserEmp } = await supabase
          .from('employees')
          .select('id')
          .eq('email', session.user.email)
          .single();
        
        if (currentUserEmp) {
          empQuery = empQuery.eq('id', currentUserEmp.id);
          attQuery = attQuery.eq('employee_id', currentUserEmp.id);
        }
      }

      const { data: empData } = await empQuery;
      const { data: attData } = await attQuery;
      const { data: shiftData } = await supabase.from('shifts').select('*');
      
      if (empData) {
        setEmployees(empData.map(emp => ({
          ...emp,
          name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
        })));
      }
      if (attData) {
        setAttendance(attData.map(att => {
          const emp = empData?.find(e => e.id === att.employee_id);
          const shift = shiftData?.find(s => s.id === emp?.shift_id);
          const applied = applyAttendancePolicy(att as any, shift, systemSettings);
          return {
            ...applied,
            employee: att.employee ? {
              ...att.employee,
              name: att.employee.name || `${att.employee.first_name || ''} ${att.employee.last_name || ''}`.trim()
            } : undefined
          };
        }) as any);
      }
      if (shiftData) setShifts(shiftData);
    } else {
      // Monthly view
      const start = startOfMonth(parseISO(`${selectedMonth}-01`));
      const end = endOfMonth(start);

      let empId = selectedEmployeeForMonthly;
      if (role === 'employee' && currentEmployeeId) {
        empId = currentEmployeeId;
      }

      const { data: attData } = await supabase
        .from('attendance')
        .select('*, employee:employees(*)')
        .eq('employee_id', empId)
        .gte('date', format(start, 'yyyy-MM-dd'))
        .lte('date', format(end, 'yyyy-MM-dd'));
      
      const { data: shiftData } = await supabase.from('shifts').select('*');
      if (shiftData) setShifts(shiftData);

      if (attData) {
        const emp = (await supabase.from('employees').select('shift_id').eq('id', empId).single()).data;
        const shift = shiftData?.find(s => s.id === emp?.shift_id);
        setMonthlyAttendance(attData.map(att => applyAttendancePolicy(att as any, shift, systemSettings)) as any);
      }

      // Also need employee list for dropdown if admin, or just the current employee for normal users
      if (isHRorAdmin || isSectorManager) {
        const { data: empData } = await supabase
          .from('employees')
          .select('*, location:locations(*)');
        if (empData) {
          setEmployees(empData.map(emp => ({
            ...emp,
            name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
          })));
        }
      } else if (empId) {
        const { data: empData } = await supabase
          .from('employees')
          .select('*, location:locations(*)')
          .eq('id', empId)
          .single();
        if (empData) {
          setEmployees([{
             ...empData,
             name: empData.name || `${empData.first_name || ''} ${empData.last_name || ''}`.trim()
          }]);
        }
      }
    }

    const { data: locData } = await supabase.from('locations').select('*');
    if (locData) setLocations(locData);
    
    const { data: shiftData } = await supabase.from('shifts').select('*');
    if (shiftData) setShifts(shiftData);
    
    setLoading(false);
  };

  const calculateLateMinutes = (checkIn: string, employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    const shift = shifts.find(s => s.id === employee?.shift_id);
    
    if (!shift || !checkIn) return 0;
    
    const [ciH, ciM] = checkIn.split(':').map(Number);
    const [stH, stM] = shift.start_time.split(':').map(Number);
    
    const ciTotal = ciH * 60 + ciM;
    const stTotal = stH * 60 + stM;
    
    const diff = ciTotal - (stTotal + shift.check_in_grace);
    return diff > 0 ? diff : 0;
  };

  const calculateEarlyExitMinutes = (checkOut: string, employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    const shift = shifts.find(s => s.id === employee?.shift_id);
    
    if (!shift || !checkOut) return 0;
    
    const [coH, coM] = checkOut.split(':').map(Number);
    const [etH, etM] = shift.end_time.split(':').map(Number);
    
    const coTotal = coH * 60 + coM;
    const etTotal = etH * 60 + etM;
    
    const diff = (etTotal - shift.check_out_grace) - coTotal;
    return diff > 0 ? diff : 0;
  };

  const handleUpdateTime = async (employeeId: string, type: 'check_in' | 'check_out', time: string, specificDate?: string) => {
    const targetDate = specificDate || selectedDate;
    const targetState = viewMode === 'daily' ? attendance : monthlyAttendance;
    const existingRecord = targetState.find(a => a.employee_id === employeeId && a.date === targetDate);
    
    const lateMinutes = type === 'check_in' ? calculateLateMinutes(time, employeeId) : (existingRecord?.late_minutes || 0);
    const earlyExitMinutes = type === 'check_out' ? calculateEarlyExitMinutes(time, employeeId) : (existingRecord?.early_exit_minutes || 0);
    const newStatus = type === 'check_in' ? (lateMinutes > 0 ? 'late' : 'present') : (existingRecord?.status || 'present');

    const updateState = (prev: AttendanceType[]) => {
      const record = prev.find(a => a.employee_id === employeeId && a.date === targetDate);
      if (record) {
        return prev.map(a => (a.employee_id === employeeId && a.date === targetDate) ? { 
          ...a, 
          [type]: time, 
          late_minutes: lateMinutes,
          early_exit_minutes: earlyExitMinutes,
          status: newStatus as any
        } : a);
      }
      return [...prev, { 
        employee_id: employeeId, 
        date: targetDate, 
        [type]: time,
        late_minutes: lateMinutes,
        early_exit_minutes: earlyExitMinutes,
        status: newStatus as any
      } as AttendanceType];
    };

    if (viewMode === 'daily') {
      setAttendance(updateState);
    } else {
      setMonthlyAttendance(updateState);
    }

    const { error } = await supabase
      .from('attendance')
      .upsert({
        employee_id: employeeId,
        date: targetDate,
        [type]: time,
        late_minutes: lateMinutes,
        early_exit_minutes: earlyExitMinutes,
        status: newStatus
      }, { onConflict: 'employee_id,date' });

    if (error) {
      if ((error.message === 'Failed to fetch' || error.message.includes('fetch')) && !navigator.onLine) {
        toast.success('أنت في وضع عدم الاتصال حالياً. تم حفظ تسجيل الدخول/الخروج وسيتم المزامنة عندما تتصل بالإنترنت.');
      } else {
        toast.error('خطأ في تحديث الوقت: ' + error.message);
      }
      fetchData();
    }
  };

  const handleUpdateStatus = async (employeeId: string, status: string, lateMinutes: number = 0, specificDate?: string, earlyExitMinutes: number = 0) => {
    const targetDate = specificDate || selectedDate;
    
    const updateState = (prev: AttendanceType[]) => {
      const existing = prev.find(a => a.employee_id === employeeId && a.date === targetDate);
      if (existing) {
        return prev.map(a => (a.employee_id === employeeId && a.date === targetDate) ? { ...a, status: status as any, late_minutes: lateMinutes, early_exit_minutes: earlyExitMinutes } : a);
      }
      return [...prev, { employee_id: employeeId, date: targetDate, status: status as any, late_minutes: lateMinutes, early_exit_minutes: earlyExitMinutes } as AttendanceType];
    };

    if (viewMode === 'daily') {
      setAttendance(updateState);
    } else {
      setMonthlyAttendance(updateState);
    }

    const { error } = await supabase
      .from('attendance')
      .upsert({
        employee_id: employeeId,
        date: targetDate,
        status: status,
        late_minutes: lateMinutes,
        early_exit_minutes: earlyExitMinutes
      }, { onConflict: 'employee_id,date' });

    if (error) {
      if ((error.message === 'Failed to fetch' || error.message.includes('fetch')) && !navigator.onLine) {
         toast.success('تم الحفظ في وضع عدم الاتصال، سيتم إرسال التحديث عند عودة الإنترنت.');
      } else {
         toast.error('خطأ في تحديث الحالة: ' + error.message);
      }
      fetchData();
    }
  };

  const handlePrint = () => {
    const printStyles = `
      @media print {
        body * { visibility: hidden; }
        .print-section, .print-section * { visibility: visible; }
        .print-section { 
          position: absolute; 
          left: 0; 
          top: 0; 
          width: 100%; 
          padding: 20px;
        }
        .no-print { display: none !important; }
        .print-only { display: block !important; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
        th { background-color: #f2f2f2; }
      }
    `;
    const styleSheet = document.createElement("style");
    styleSheet.innerText = printStyles;
    document.head.appendChild(styleSheet);
    window.print();
    document.head.removeChild(styleSheet);
  };

  const exportMonthlyToPDF = async () => {
    const reportElement = document.getElementById('monthly-pdf-report-template');
    if (!reportElement) {
      toast.error('لم يتم العثور على قالب التقرير');
      return;
    }

    setPdfLoading(true);
    const toastId = toast.loading('جاري توليد ملف PDF بجودة عالية وتجهيز التحميل...');

    try {
      // Temporarily bring the template to the viewport for perfect layout calculations
      const oldLeft = reportElement.style.left;
      const oldTop = reportElement.style.top;
      reportElement.style.left = '0px';
      reportElement.style.top = '0px';

      // 1.5x scale guarantees high-quality crispness while keeping the file size extremely lightweight
      const scale = 1.5;

      const dataUrl = await domtoimage.toJpeg(reportElement, {
        bgcolor: '#ffffff',
        width: 800 * scale,
        height: 1130 * scale,
        quality: 0.75,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: '800px',
          height: '1130px',
          left: '0px',
          top: '0px'
        }
      });

      // Restore position immediately back to absolute offscreen coordinates
      reportElement.style.left = oldLeft;
      reportElement.style.top = oldTop;

      // Initialize jsPDF pointing to standard single A4 page
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210 mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297 mm

      // Draw the crisp captured image onto the A4 page using JPEG compression format
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);

      const empNameClean = (selectedEmployeeName || 'الموظف').trim().replace(/\s+/g, '_');
      pdf.save(`تقرير_حضور_${empNameClean}_${selectedMonth}.pdf`);
      
      toast.success('تم تحميل التقرير الشهري بنجاح في صفحة واحدة وبدقة عالية!', { id: toastId });
    } catch (error) {
      console.error('PDF Export Error:', error);
      toast.error('حدث خطأ في تصدير ملف PDF، يرجى المحاولة لاحقاً', { id: toastId });
    } finally {
      setPdfLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = (emp.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation = locationFilter === 'all' || emp.location_id === locationFilter;
    return matchesSearch && matchesLocation;
  });

  const isHRorAdmin = userRole === 'admin' || userRole === 'hr';
  const isSectorManager = userRole === 'sector_manager';
  const canManageAttendance = isHRorAdmin || isSectorManager;

  const selectedEmployeeName = employees.find(e => e.id === selectedEmployeeForMonthly)?.name;

  const getDaysInMonth = () => {
    const start = startOfMonth(parseISO(`${selectedMonth}-01`));
    const end = endOfMonth(start);
    return eachDayOfInterval({ start, end });
  };

  const getAvatarGradient = (name: string) => {
    const gradients = [
      'bg-gradient-to-br from-indigo-500 to-purple-600',
      'bg-gradient-to-br from-blue-500 to-cyan-500',
      'bg-gradient-to-br from-emerald-400 to-teal-500',
      'bg-gradient-to-br from-rose-400 to-red-500',
      'bg-gradient-to-br from-amber-400 to-orange-500',
      'bg-gradient-to-br from-fuchsia-500 to-pink-600',
    ];
    const charCode = name ? name.charCodeAt(0) : 0;
    return gradients[charCode % gradients.length];
  };

  return (
    <div className="space-y-6">
      {currentEmployeeId ? (
        <SmartAttendanceWidget 
          currentEmployee={currentEmployeeData} 
          todayAttendance={attendance.find(a => a.employee_id === currentEmployeeId) || null}
          onAttendanceUpdate={fetchData} 
        />
      ) : (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-6 rounded-[24px] flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-800 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
            <ShieldQuestion size={24} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">حسابك غير مرتبط بسجل موظف</h3>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">لتتمكن من تسجيل الحضور والانصراف، يجب إضافة بريدك الإلكتروني ({employees.length > 0 ? "الحالي" : "الذي تستخدمه"}) في قائمة الموظفين.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">سجل الحضور {(viewMode === 'daily' ? 'اليومي' : 'الشهري')}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{format(new Date(), 'EEEE, d MMMM yyyy', { locale: ar })}</p>
          </div>
          
          <div className="flex bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-xl no-print shadow-inner">
            <button
              onClick={() => setViewMode('daily')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'daily' 
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400 scale-100' 
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 scale-95 hover:scale-100'
              }`}
            >
              <List size={16} />
              يومي
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'monthly' 
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400 scale-100' 
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 scale-95 hover:scale-100'
              }`}
            >
              <Calendar size={16} />
              شهري
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 self-stretch sm:self-center flex-1 max-w-2xl">
          {viewMode === 'daily' ? (
            <>
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <Clock size={16} className="text-slate-400" />
                <Input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border-none bg-transparent h-10 text-sm focus-visible:ring-0 p-0 w-32"
                />
              </div>
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input 
                  placeholder="بحث عن موظف..." 
                  className="pr-10 rounded-lg h-10 text-sm border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 w-full" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <Calendar size={16} className="text-slate-400" />
                <Input 
                  type="month" 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="border-none bg-transparent h-10 text-sm focus-visible:ring-0 p-0 w-40"
                />
              </div>
              {(isHRorAdmin || isSectorManager) && (
                <div className="flex-1">
                  <Select 
                    value={selectedEmployeeForMonthly} 
                    onValueChange={setSelectedEmployeeForMonthly}
                  >
                    <SelectTrigger className="w-full rounded-lg h-10 text-sm border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold">
                      <SelectValue placeholder="اختر الموظف">
                        {employees.find(emp => String(emp.id) === String(selectedEmployeeForMonthly))?.name || 'جاري التحميل...'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {viewMode === 'daily' && (
            <Select 
              value={locationFilter} 
              onValueChange={setLocationFilter}
              disabled={isSectorManager}
            >
              <SelectTrigger className="w-full sm:w-48 rounded-lg h-10 text-sm border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold">
                <SelectValue placeholder="تصفية حسب الموقع">
                  {locationFilter === 'all' 
                    ? 'جميع المواقع' 
                    : (locations.find(l => String(l.id) === String(locationFilter))?.name || 'جاري التحميل...')
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {!isSectorManager && <SelectItem value="all">جميع المواقع</SelectItem>}
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex gap-2">
          {viewMode === 'monthly' && (
            <Button 
              onClick={exportMonthlyToPDF}
              className="rounded-lg h-10 px-4 text-xs font-bold bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-md shadow-red-500/10 hover:shadow-red-500/25 transition-all flex items-center gap-2"
            >
              <FileText size={16} />
              تصدير PDF الشهري (صفحة واحدة)
            </Button>
          )}
          <Button 
            onClick={handlePrint}
            variant="outline" 
            className="rounded-lg h-10 px-4 text-xs font-bold border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Printer size={16} className="ml-2" />
            طباعة التقرير
          </Button>
        </div>
      </div>
      
      {/* Metrics Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 my-6">
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-4 md:p-5 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-2xl flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
              {viewMode === 'daily' ? 'الموظفين الحاضرين' : 'أيام الحضور'}
            </p>
            <h4 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100">
              {viewMode === 'daily' ? attendance.filter(a => a.status === 'present').length : monthlyAttendance.filter(a => a.status === 'present').length}
            </h4>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-4 md:p-5 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center shrink-0">
            <UserX size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
               {viewMode === 'daily' ? 'الموظفين الغائبين' : 'أيام الغياب'}
            </p>
            <h4 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100">
              {viewMode === 'daily' ? attendance.filter(a => a.status === 'absent').length : monthlyAttendance.filter(a => a.status === 'absent').length}
            </h4>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-4 md:p-5 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center shrink-0">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
              {viewMode === 'daily' ? 'حالات التأخير' : 'أيام التأخير'}
            </p>
            <h4 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100">
              {viewMode === 'daily' ? attendance.filter(a => a.status === 'late').length : monthlyAttendance.filter(a => a.status === 'late').length}
            </h4>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-4 md:p-5 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0">
            <Coffee size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">
               {viewMode === 'daily' ? 'الموظفين المجازين' : 'أيام الإجازة'}
            </p>
            <h4 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100">
              {viewMode === 'daily' ? attendance.filter(a => a.status === 'leave').length : monthlyAttendance.filter(a => a.status === 'leave').length}
            </h4>
          </div>
        </div>
      </div>

      <div className="print-only hidden mb-8 text-center">
        <h1 className="text-2xl font-bold">تقرير الحضور والغياب {(viewMode === 'daily' ? 'اليومي' : 'الشهري')}</h1>
        <p className="text-sm text-slate-500 mt-2">
          {viewMode === 'daily' ? `التاريخ: ${selectedDate}` : `الشهر: ${selectedMonth}`}
        </p>
      </div>

      {viewMode === 'daily' ? (
        <div className="panel shadow-sm overflow-x-auto border-slate-100 dark:border-slate-800 rounded-[24px] print-section">
          <Table className="min-w-[800px]">
            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                <TableHead className="text-right text-slate-500 dark:text-slate-400 font-bold py-4 text-xs uppercase tracking-wider">الموظف</TableHead>
                <TableHead className="text-right text-slate-500 dark:text-slate-400 font-bold py-4 text-xs uppercase tracking-wider">الوردية</TableHead>
                <TableHead className="text-right text-slate-500 dark:text-slate-400 font-bold py-4 text-xs uppercase tracking-wider">الحالة</TableHead>
                <TableHead className="text-right text-slate-500 dark:text-slate-400 font-bold py-4 text-xs uppercase tracking-wider">بصمة الحضور</TableHead>
                <TableHead className="text-right text-slate-500 dark:text-slate-400 font-bold py-4 text-xs uppercase tracking-wider">بصمة الانصراف</TableHead>
                <TableHead className="text-right text-slate-500 dark:text-slate-400 font-bold py-4 text-xs uppercase tracking-wider">دقائق التأخير</TableHead>
                <TableHead className="text-right text-slate-500 dark:text-slate-400 font-bold py-4 text-xs uppercase tracking-wider">انصراف مبكر</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((emp) => {
                const record = attendance.find(a => a.employee_id === emp.id);
                const shift = shifts.find(s => s.id === emp.shift_id);
                const dateObj = new Date(selectedDate);
                const isWorkDay = shift ? shift.work_days.includes(dateObj.getDay()) : (dateObj.getDay() !== 5 && dateObj.getDay() !== 6);
                const effectiveStatus = record?.status || (!isWorkDay ? 'holiday' : '');
                
                return (
                  <TableRow key={emp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-all border-slate-50 dark:border-slate-800 group">
                    <TableCell className="py-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-11 h-11 ${getAvatarGradient(emp.name || '')} text-white rounded-2xl flex items-center justify-center font-black text-sm shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300`}>
                          {(emp.name || '')[0]}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-black text-slate-900 dark:text-slate-100 text-[13px]">{emp.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                            <MapPin size={10} />
                            {emp.location?.name || 'غير محدد'}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-5">
                      <div className="flex flex-col gap-0.5">
                        {emp.shift_id ? (
                          <>
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-lg inline-block max-w-max">
                              {shifts.find(s => s.id === emp.shift_id)?.name}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock size={10} className="text-slate-400" />
                              {shifts.find(s => s.id === emp.shift_id)?.start_time} - {shifts.find(s => s.id === emp.shift_id)?.end_time}
                            </span>
                          </>
                        ) : (
                          <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-100/50 dark:border-amber-900/30 px-2.1 py-0.5 rounded-lg inline-block max-w-max">
                            بلا وردية
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-5">
                      <div className="print-only hidden font-bold text-sm">
                        {effectiveStatus ? statusLabels[effectiveStatus] : 'لم يسجل'}
                      </div>
                      <div className="no-print">
                        <Select 
                          value={effectiveStatus} 
                          onValueChange={(val) => handleUpdateStatus(emp.id, val, record?.late_minutes)}
                          disabled={!canManageAttendance}
                        >
                          <SelectTrigger className={`w-40 h-9 rounded-full text-[11px] font-black tracking-wide border transition-all shadow-sm cursor-pointer hover:brightness-105 ${getStatusColorClasses(effectiveStatus === '' ? undefined : effectiveStatus)}`}>
                            <SelectValue placeholder="اختر الحالة">
                              <div className="flex items-center gap-2">
                                {effectiveStatus ? statusIcons[effectiveStatus] : <Clock9 size={14} className="text-slate-400" />}
                                <span>{effectiveStatus ? statusLabels[effectiveStatus] : 'تحديد الحالة'}</span>
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-slate-100 dark:border-slate-800 p-1 shadow-xl">
                            <SelectItem value="present" className="rounded-lg focus:bg-green-50 dark:focus:bg-green-900/20">
                              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                                <CheckCircle2 size={14} />
                                <span>حاضر</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="absent" className="rounded-lg focus:bg-red-50 dark:focus:bg-red-900/20">
                              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                                <UserX size={14} />
                                <span>غائب</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="leave" className="rounded-lg focus:bg-blue-50 dark:focus:bg-blue-900/20">
                              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                                <Coffee size={14} />
                                <span>مجاز</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="late" className="rounded-lg focus:bg-yellow-50 dark:focus:bg-yellow-900/20">
                              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                                <AlertCircle size={14} />
                                <span>متأخر</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="missing_checkin" className="rounded-lg focus:bg-orange-50 dark:focus:bg-orange-900/20">
                              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                                <Clock9 size={14} />
                                <span>غياب بصمة حضور</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="missing_checkout" className="rounded-lg focus:bg-orange-50 dark:focus:bg-orange-900/20">
                              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 text-xs">
                                <Clock9 size={14} />
                                <span>غياب بصمة انصراف</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="time_off" className="rounded-lg focus:bg-purple-50 dark:focus:bg-purple-900/20">
                              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                                <Clock size={14} />
                                <span>زمنية</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="holiday" className="rounded-lg focus:bg-slate-100 dark:focus:bg-slate-800">
                              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                <CalendarIcon size={14} />
                                <span>عطلة</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="relative inline-flex items-center no-print gap-1.5 ctrl-time-box">
                        <div className="relative inline-flex items-center group/input">
                          <Clock size={14} className="absolute right-3 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors group-hover/input:text-blue-500 z-10" />
                          <Input 
                            type="time"
                            className="custom-time-input w-28 sm:w-32 pl-2 pr-8 h-10 text-[13px] font-bold rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-500 focus-visible:ring-blue-500/10 transition-all cursor-pointer shadow-sm text-center"
                            value={record?.check_in || ''}
                            onChange={(e) => handleUpdateTime(emp.id, 'check_in', e.target.value)}
                          />
                        </div>
                        {canManageAttendance && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 shrink-0 border border-transparent hover:border-blue-100 dark:hover:border-blue-900/40 transition-all"
                            title="بصمة حضور الآن"
                            onClick={() => handleUpdateTime(emp.id, 'check_in', format(new Date(), 'HH:mm'))}
                          >
                            <LogIn size={14} />
                          </Button>
                        )}
                      </div>
                      <span className="print-only hidden font-bold text-xs">{record?.check_in || '--:--'}</span>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="relative inline-flex items-center no-print gap-1.5 ctrl-time-box">
                        <div className="relative inline-flex items-center group/input">
                          <Clock size={14} className="absolute right-3 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors group-hover/input:text-red-500 z-10" />
                          <Input 
                            type="time"
                            className="custom-time-input w-28 sm:w-32 pl-2 pr-8 h-10 text-[13px] font-bold rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:border-red-500 focus-visible:ring-red-500/10 transition-all cursor-pointer shadow-sm text-center"
                            value={record?.check_out || ''}
                            onChange={(e) => handleUpdateTime(emp.id, 'check_out', e.target.value)}
                          />
                        </div>
                        {canManageAttendance && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0 border border-transparent hover:border-red-100 dark:hover:border-red-900/40 transition-all"
                            title="بصمة انصراف الآن"
                            onClick={() => handleUpdateTime(emp.id, 'check_out', format(new Date(), 'HH:mm'))}
                          >
                            <LogOut size={14} />
                          </Button>
                        )}
                      </div>
                      <span className="print-only hidden font-bold text-xs">{record?.check_out || '--:--'}</span>
                    </TableCell>
                    <TableCell className="py-4">
                      {(record?.late_minutes || 0) > 0 && (
                        <div className="relative inline-flex items-center no-print animate-in fade-in zoom-in duration-200">
                          <AlertCircle size={14} className={`absolute right-3 ${getLateIconColor(record?.late_minutes || 0)} pointer-events-none`} />
                          <Input 
                            type="number"
                            placeholder="دقائق"
                            className={`w-24 pl-3 pr-9 h-10 text-[13px] font-bold rounded-xl transition-all text-center placeholder:opacity-50 ${getLateMinutesClasses(record?.late_minutes || 0)}`}
                            value={record?.late_minutes === 0 ? '' : record?.late_minutes}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                              handleUpdateStatus(emp.id, record?.status || 'late', val, undefined, record?.early_exit_minutes || 0);
                            }}
                          />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      {(record?.check_out) && (
                        <div className="relative inline-flex items-center no-print animate-in fade-in zoom-in duration-200">
                          <Clock size={14} className={`absolute right-3 ${getEarlyExitIconColor(record?.early_exit_minutes || 0)} pointer-events-none`} />
                          <Input 
                            type="number"
                            placeholder="دقائق"
                            className={`w-24 pl-3 pr-9 h-10 text-[13px] font-bold rounded-xl transition-all text-center placeholder:opacity-50 ${getEarlyExitMinutesClasses(record?.early_exit_minutes || 0)}`}
                            value={record?.early_exit_minutes === 0 ? '' : record?.early_exit_minutes}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                              handleUpdateStatus(emp.id, record?.status || 'present', record?.late_minutes || 0, undefined, val);
                            }}
                          />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="panel shadow-sm overflow-x-auto border-slate-100 dark:border-slate-800 rounded-[24px] print-section">
          {selectedEmployeeName && (
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                سجل الموظف: <span className="text-blue-600 dark:text-blue-400">{selectedEmployeeName}</span>
              </h3>
            </div>
          )}
          <Table className="min-w-[800px]">
            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
              <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                <TableHead className="text-right text-slate-500 dark:text-slate-400 font-bold py-4 text-xs uppercase tracking-wider">التاريخ</TableHead>
                <TableHead className="text-right text-slate-500 dark:text-slate-400 font-bold py-4 text-xs uppercase tracking-wider">اليوم</TableHead>
                <TableHead className="text-right text-slate-500 dark:text-slate-400 font-bold py-4 text-xs uppercase tracking-wider">الحالة</TableHead>
                <TableHead className="text-right text-slate-500 dark:text-slate-400 font-bold py-4 text-xs uppercase tracking-wider">الحضور</TableHead>
                <TableHead className="text-right text-slate-500 dark:text-slate-400 font-bold py-4 text-xs uppercase tracking-wider">الانصراف</TableHead>
                <TableHead className="text-right text-slate-500 dark:text-slate-400 font-bold py-4 text-xs uppercase tracking-wider">التأخير</TableHead>
                <TableHead className="text-right text-slate-500 dark:text-slate-400 font-bold py-4 text-xs uppercase tracking-wider">الانصراف المبكر</TableHead>
                <TableHead className="text-right text-slate-500 dark:text-slate-400 font-bold py-4 text-xs uppercase tracking-wider">ملاحظات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getDaysInMonth().map((day) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const record = monthlyAttendance.find(a => a.date === dayStr);
                const isToday = isSameDay(day, new Date());
                
                const currentEmp = employees.find(e => e.id === (selectedEmployeeForMonthly || currentEmployeeId));
                const currentShift = shifts.find(s => s.id === currentEmp?.shift_id);
                
                const isWorkDay = currentShift 
                  ? currentShift.work_days.includes(day.getDay())
                  : (day.getDay() !== 5 && day.getDay() !== 6);
                
                const isOffDay = !isWorkDay;

                return (
                  <TableRow 
                    key={dayStr} 
                    className={`group transition-all border-slate-50 dark:border-slate-800 ${
                      isToday ? 'bg-blue-50/30 dark:bg-blue-900/10 hover:bg-blue-50/50 dark:hover:bg-blue-900/20' : 
                      isOffDay ? 'bg-slate-50/30 dark:bg-slate-800/30 hover:bg-slate-50/60 dark:hover:bg-slate-800/40' : 
                      'hover:bg-slate-50/80 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <TableCell className="py-4 font-bold text-slate-700 dark:text-slate-300">
                      {format(day, 'd MMMM', { locale: ar })}
                    </TableCell>
                    <TableCell className="py-4 text-slate-500 dark:text-slate-400">
                      {format(day, 'EEEE', { locale: ar })}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="no-print">
                        <Select 
                          value={record?.status || (isOffDay ? 'holiday' : '')} 
                          onValueChange={(val) => handleUpdateStatus(currentEmp?.id || '', val, record?.late_minutes, dayStr, record?.early_exit_minutes || 0)}
                          disabled={!canManageAttendance}
                        >
                          <SelectTrigger className={`w-40 rounded-xl h-10 text-[11px] font-bold transition-all border shadow-sm ${getStatusColorClasses(record?.status || (isOffDay ? 'holiday' : undefined))}`}>
                            <SelectValue placeholder="اختر الحالة">
                              <div className="flex items-center gap-2">
                                {(record?.status || (isOffDay ? 'holiday' : null)) && statusIcons[record?.status || (isOffDay ? 'holiday' : '')]}
                                <span>{record?.status ? statusLabels[record.status] : (isOffDay ? statusLabels['holiday'] : 'لم يسجل')}</span>
                              </div>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-slate-100 dark:border-slate-800 p-1 shadow-xl">
                            <SelectItem value="present" className="rounded-lg focus:bg-green-50 dark:focus:bg-green-900/20">
                              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                                <CheckCircle2 size={14} />
                                <span>حاضر</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="absent" className="rounded-lg focus:bg-red-50 dark:focus:bg-red-900/20">
                              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                                <UserX size={14} />
                                <span>غائب</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="leave" className="rounded-lg focus:bg-blue-50 dark:focus:bg-blue-900/20">
                              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                                <Coffee size={14} />
                                <span>مجاز</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="late" className="rounded-lg focus:bg-yellow-50 dark:focus:bg-yellow-900/20">
                              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                                <AlertCircle size={14} />
                                <span>متأخر</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="missing_checkin" className="rounded-lg focus:bg-orange-50 dark:focus:bg-orange-900/20">
                              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                                <Clock9 size={14} />
                                <span>غياب بصمة حضور</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="missing_checkout" className="rounded-lg focus:bg-orange-50 dark:focus:bg-orange-900/20">
                              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 text-xs">
                                <Clock9 size={14} />
                                <span>غياب بصمة انصراف</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="time_off" className="rounded-lg focus:bg-purple-50 dark:focus:bg-purple-900/20">
                              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                                <Clock size={14} />
                                <span>زمنية</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="holiday" className="rounded-lg focus:bg-slate-100 dark:focus:bg-slate-800">
                              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                <CalendarIcon size={14} />
                                <span>عطلة</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="print-only hidden font-bold text-sm">
                        {record?.status ? statusLabels[record.status] : (isOffDay ? statusLabels['holiday'] : 'لم يسجل')}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="relative inline-flex items-center no-print gap-1.5 ctrl-time-box">
                        <div className="relative inline-flex items-center group/input">
                          <Clock size={14} className="absolute right-3 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors group-hover/input:text-blue-500 z-10" />
                          <Input 
                            type="time"
                            className="custom-time-input w-28 sm:w-32 pl-2 pr-8 h-10 text-[13px] font-bold rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-500 focus-visible:ring-blue-500/10 transition-all cursor-pointer shadow-sm text-center"
                            value={record?.check_in || ''}
                            onChange={(e) => handleUpdateTime(currentEmp?.id || '', 'check_in', e.target.value, dayStr)}
                            disabled={!canManageAttendance}
                          />
                        </div>
                        {canManageAttendance && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 shrink-0 border border-transparent hover:border-blue-100 dark:hover:border-blue-900/40 transition-all"
                            title="بصمة حضور الآن"
                            onClick={() => handleUpdateTime(currentEmp?.id || '', 'check_in', format(new Date(), 'HH:mm'), dayStr)}
                          >
                            <LogIn size={14} />
                          </Button>
                        )}
                      </div>
                      <span className="print-only hidden font-bold text-xs">{record?.check_in || '--:--'}</span>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="relative inline-flex items-center no-print gap-1.5 ctrl-time-box">
                        <div className="relative inline-flex items-center group/input">
                          <Clock size={14} className="absolute right-3 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors group-hover/input:text-red-500 z-10" />
                          <Input 
                            type="time"
                            className="custom-time-input w-28 sm:w-32 pl-2 pr-8 h-10 text-[13px] font-bold rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:border-red-500 focus-visible:ring-red-500/10 transition-all cursor-pointer shadow-sm text-center"
                            value={record?.check_out || ''}
                            onChange={(e) => handleUpdateTime(currentEmp?.id || '', 'check_out', e.target.value, dayStr)}
                            disabled={!canManageAttendance}
                          />
                        </div>
                        {canManageAttendance && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0 border border-transparent hover:border-red-100 dark:hover:border-red-900/40 transition-all"
                            title="بصمة انصراف الآن"
                            onClick={() => handleUpdateTime(currentEmp?.id || '', 'check_out', format(new Date(), 'HH:mm'), dayStr)}
                          >
                            <LogOut size={14} />
                          </Button>
                        )}
                      </div>
                      <span className="print-only hidden font-bold text-xs">{record?.check_out || '--:--'}</span>
                    </TableCell>
                    <TableCell className="py-4">
                      {(record?.late_minutes || 0) > 0 ? (
                        <div className="relative inline-flex items-center no-print animate-in fade-in zoom-in duration-200">
                          <Input 
                            type="number"
                            placeholder="دقائق"
                            className={`w-24 pl-3 pr-9 h-10 text-[13px] font-bold rounded-xl transition-all text-center placeholder:opacity-50 ${getLateMinutesClasses(record?.late_minutes || 0)}`}
                            value={record?.late_minutes === 0 ? '' : record?.late_minutes}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                              handleUpdateStatus(currentEmp?.id || '', record?.status || 'late', val, dayStr, record?.early_exit_minutes || 0);
                            }}
                            disabled={!canManageAttendance}
                          />
                          <AlertCircle size={14} className={`absolute right-3 ${getLateIconColor(record?.late_minutes || 0)} pointer-events-none`} />
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-xs">-</span>
                      )}
                      <span className="print-only hidden font-bold text-xs">
                        {record?.late_minutes ? `تأخير ${record.late_minutes} د ` : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      {(record?.check_out || (record?.early_exit_minutes || 0) > 0) ? (
                        <div className="relative inline-flex items-center no-print animate-in fade-in zoom-in duration-200">
                          <Input 
                            type="number"
                            placeholder="مبكر"
                            className={`w-24 pl-3 pr-9 h-10 text-[13px] font-bold rounded-xl transition-all text-center placeholder:opacity-50 ${getEarlyExitMinutesClasses(record?.early_exit_minutes || 0)}`}
                            value={record?.early_exit_minutes === 0 ? '' : record?.early_exit_minutes}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                              handleUpdateStatus(currentEmp?.id || '', record?.status || 'present', record?.late_minutes || 0, dayStr, val);
                            }}
                            disabled={!canManageAttendance}
                          />
                          <Clock size={14} className={`absolute right-3 ${getEarlyExitIconColor(record?.early_exit_minutes || 0)} pointer-events-none`} />
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 text-xs">-</span>
                      )}
                      <span className="print-only hidden font-bold text-xs">
                        {record?.early_exit_minutes ? `مبكر ${record.early_exit_minutes} د` : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 text-slate-400 text-xs">
                      -
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Monthly PDF Report Template for PDF export (hidden off-screen) */}
      <div 
        id="monthly-pdf-report-template" 
        className="absolute bg-white text-slate-900 font-sans border-0 select-none z-[-50] overflow-hidden" 
        style={{ 
          width: '800px', 
          height: '1130px', 
          position: 'absolute', 
          left: '-10000px', 
          top: '-10000px', 
          padding: '28px 36px',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}
        dir="rtl"
      >
        {/* Header Block */}
        <div className="flex justify-between items-center border-b-2 border-slate-900 pb-5 mb-5 shrink-0">
          <div className="flex-1 text-right">
            <h3 className="text-xs font-black text-slate-800 leading-tight">النظام السحابي الموحد للمنتسبين</h3>
            <p className="text-[7.5px] font-bold text-slate-400 mt-0.5 uppercase tracking-wide">Unified Staff Portal</p>
          </div>
          <div className="text-center px-5 py-2 border border-slate-300 rounded-lg bg-slate-50/50 min-w-[240px] shadow-sm">
            <h2 className="text-[13px] font-black text-slate-900 leading-none">تقرير خلاصة الحضور الشهري</h2>
            <p className="text-[8px] font-bold text-slate-400 mt-1.5 uppercase tracking-wider">Monthly Attendance Statement</p>
          </div>
          <div className="flex-1 text-left flex flex-col items-end">
            <div className="text-[8.5px] font-bold text-slate-500">تاريخ الإصدار: {format(new Date(), 'yyyy-MM-dd')}</div>
            <div className="text-[8.5px] font-mono text-slate-400 mt-0.5">DOC-ID: HR-{selectedMonth?.replace('-', '')}-{selectedEmployeeForMonthly ? selectedEmployeeForMonthly.substring(0, 5) : 'EMP'}</div>
            <div className="text-[8.5px] font-bold text-emerald-700 mt-1.5 bg-emerald-50/70 border border-emerald-200/50 px-2 py-0.5 rounded-md inline-block">معتمد رسمياً</div>
          </div>
        </div>

        {/* Employee Info Grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 bg-slate-50 p-3 rounded-xl mb-3 border border-slate-100 shrink-0">
          <div>
            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">اسم الموظف</span>
            <span className="text-xs font-black text-slate-800 whitespace-nowrap">{selectedEmployeeName || 'الموظف'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">الشهر المستهدف</span>
            <span className="text-xs font-black text-slate-800 whitespace-nowrap text-blue-700">
              {(() => {
                try {
                  return format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy', { locale: ar });
                } catch (e) {
                  return selectedMonth;
                }
              })()}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">الوردية الحالية</span>
            <span className="text-xs font-extrabold text-slate-700 whitespace-nowrap">
              {shifts.find(s => s.id === employees.find(e => e.id === (selectedEmployeeForMonthly || currentEmployeeId))?.shift_id)?.name || 'بدون وردية'}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">موقع العمل</span>
            <span className="text-xs font-extrabold text-slate-700 whitespace-nowrap">
              {locations.find(l => l.id === employees.find(e => e.id === (selectedEmployeeForMonthly || currentEmployeeId))?.location_id)?.name || 'غير محدد'}
            </span>
          </div>
        </div>

        {/* KPI Scorecards */}
        <div className="grid grid-cols-5 gap-2 mb-3 shrink-0">
          <div className="bg-green-50/70 p-2 rounded-xl border border-green-150 text-center">
            <span className="text-[9px] font-black text-green-700 block mb-0.5">أيام الحضور</span>
            <span className="text-sm font-black text-green-800">
              {monthlyAttendance.filter(a => a.status === 'present' || a.status === 'late').length}
            </span>
          </div>
          <div className="bg-red-50/70 p-2 rounded-xl border border-red-150 text-center">
            <span className="text-[9px] font-black text-red-700 block mb-0.5">أيام الغياب</span>
            <span className="text-sm font-black text-red-800">
              {monthlyAttendance.filter(a => a.status === 'absent').length}
            </span>
          </div>
          <div className="bg-yellow-50/70 p-2 rounded-xl border border-yellow-150 text-center">
            <span className="text-[9px] font-black text-yellow-700 block mb-0.5">أيام التأخير</span>
            <span className="text-sm font-black text-yellow-800">
              {monthlyAttendance.filter(a => a.status === 'late').length}
            </span>
          </div>
          <div className="bg-amber-50/70 p-2 rounded-xl border border-amber-150 text-center">
            <span className="text-[9px] font-black text-amber-700 block mb-0.5">دقائق التأخير</span>
            <span className="text-sm font-black text-amber-800">
              {monthlyAttendance.reduce((sum, a) => sum + (a.late_minutes || 0), 0)}
            </span>
          </div>
          <div className="bg-orange-50/70 p-2 rounded-xl border border-orange-150 text-center">
            <span className="text-[9px] font-black text-orange-700 block mb-0.5">انصراف مبكر</span>
            <span className="text-sm font-black text-orange-850">
              {monthlyAttendance.reduce((sum, a) => sum + (a.early_exit_minutes || 0), 0)}
            </span>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden flex-1 min-h-0">
          <table className="w-full text-[10px] table-fixed">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-1 px-2 text-right text-[9.5px] w-[18%]">التاريخ</th>
                <th className="py-1 px-2 text-right text-[9.5px] w-[15%]">اليوم</th>
                <th className="py-1 px-2 text-center text-[9.5px] w-[17%]">الحالة</th>
                <th className="py-1 px-2 text-center text-[9.5px] w-[12%]">حضور</th>
                <th className="py-1 px-2 text-center text-[9.5px] w-[12%]">انصراف</th>
                <th className="py-1 px-2 text-center text-[9.5px] w-[13%]">تأخير</th>
                <th className="py-1 px-2 text-center text-[9.5px] w-[13%]">خروج مبكر</th>
              </tr>
            </thead>
            <tbody>
              {getDaysInMonth().map((day) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const record = monthlyAttendance.find(a => a.date === dayStr);
                const currentEmp = employees.find(e => e.id === (selectedEmployeeForMonthly || currentEmployeeId));
                const currentShift = shifts.find(s => s.id === currentEmp?.shift_id);
                const isWorkDay = currentShift 
                  ? currentShift.work_days.includes(day.getDay())
                  : (day.getDay() !== 5 && day.getDay() !== 6);
                const isOffDay = !isWorkDay;
                const recordStatus = record?.status || (isOffDay ? 'holiday' : '');

                return (
                  <tr key={dayStr} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/30">
                    <td className="py-0.5 px-2 font-semibold text-slate-700 text-[9px] h-[22px]">
                      {format(day, 'd MMMM', { locale: ar })}
                    </td>
                    <td className="py-0.5 px-2 text-slate-500 text-[9px] h-[22px]">
                      {format(day, 'EEEE', { locale: ar })}
                    </td>
                    <td className="py-0.5 px-2 text-center text-[9px] h-[22px]">
                      {getPdfStatusBadge(recordStatus)}
                    </td>
                    <td className="py-0.5 px-2 font-mono text-slate-600 text-center text-[9px] h-[22px]">
                      {record?.check_in || '--:--'}
                    </td>
                    <td className="py-0.5 px-2 font-mono text-slate-600 text-center text-[9px] h-[22px]">
                      {record?.check_out || '--:--'}
                    </td>
                    <td className="py-0.5 px-2 font-semibold text-slate-700 text-center text-[9px] h-[22px]">
                      {record?.late_minutes ? `${record.late_minutes} د` : '-'}
                    </td>
                    <td className="py-0.5 px-2 font-semibold text-slate-700 text-center text-[9px] h-[22px]">
                      {record?.early_exit_minutes ? `${record.early_exit_minutes} د` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Audit signatures */}
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200 shrink-0">
          <div className="text-right">
            <p className="font-bold text-[10px] text-slate-700">توقيع مسؤول الموارد البشرية</p>
            <div className="h-10 w-44 border-b border-dashed border-slate-300 mt-2"></div>
          </div>
          <div className="text-center bg-slate-50 border border-slate-200/65 rounded-xl p-2 w-32 shrink-0">
            <span className="text-[8px] font-bold text-slate-400 block mb-2">ختم المؤسسة الرسمي</span>
            <div className="h-8"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
