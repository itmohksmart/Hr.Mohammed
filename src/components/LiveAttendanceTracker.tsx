import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  UserX, 
  Search, 
  MapPin, 
  Camera, 
  Mail, 
  Phone, 
  Send, 
  Download, 
  RefreshCw, 
  FileSpreadsheet, 
  User, 
  Sparkles,
  Check,
  X,
  FileText,
  AlertTriangle,
  Contact2
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'motion/react';
import { Attendance, Employee, Location, Shift } from '../types';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface LiveAttendanceTrackerProps {
  attendance: Attendance[];
  employees: Employee[];
  locations: Location[];
  shifts: Shift[];
  selectedDate: string;
  onRefresh: () => void;
  userRole: string | null;
}

export default function LiveAttendanceTracker({
  attendance,
  employees,
  locations,
  shifts,
  selectedDate,
  onRefresh,
  userRole
}: LiveAttendanceTrackerProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'punctual' | 'late' | 'not_registered'>('all');
  const [localSearch, setLocalSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all');
  
  // Modals state
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [notifEmployee, setNotifEmployee] = useState<Employee | null>(null);
  const [notifTitle, setNotifTitle] = useState('تنبيه بخصوص التأخير عن الدوام');
  const [notifMessage, setNotifMessage] = useState('');
  const [isSendingNotif, setIsSendingNotif] = useState(false);
  
  // Excuse delay modal
  const [excuseEmployee, setExcuseEmployee] = useState<{ emp: Employee; record: Attendance } | null>(null);
  const [excuseReason, setExcuseReason] = useState('');
  const [isSavingExcuse, setIsSavingExcuse] = useState(false);

  // 1. Calculate stats with extreme precision
  const trackingStats = useMemo(() => {
    // Under active day context
    const dateObj = new Date(selectedDate);
    const dayOfWeek = dateObj.getDay();

    const stats = {
      totalEmployees: 0,
      activeToday: 0,
      checkedIn: 0,
      onTime: 0,
      late: 0,
      notCheckedInYet: 0,
      averageLateMinutes: 0,
      excusedCount: 0
    };

    // Filter employees that should be active today based on shifts
    const activeEmps = employees.filter(emp => {
      if (emp.status !== 'active') return false;
      const shift = shifts.find(s => s.id === emp.shift_id);
      if (shift) {
        return shift.work_days.includes(dayOfWeek);
      }
      // Default fallback (exclude Fri/Sat)
      return dayOfWeek !== 5 && dayOfWeek !== 6;
    });

    stats.totalEmployees = employees.length;
    stats.activeToday = activeEmps.length;

    let totalLateMin = 0;

    activeEmps.forEach(emp => {
      const record = attendance.find(a => a.employee_id === emp.id);
      if (record) {
        stats.checkedIn++;
        if (record.status === 'late') {
          stats.late++;
          totalLateMin += record.late_minutes || 0;
        } else {
          stats.onTime++;
        }
      } else {
        stats.notCheckedInYet++;
      }
    });

    stats.averageLateMinutes = stats.late > 0 ? Math.round(totalLateMin / stats.late) : 0;
    
    return stats;
  }, [attendance, employees, shifts, selectedDate]);

  // 2. Filter employees and their daily records
  const trackingList = useMemo(() => {
    const dateObj = new Date(selectedDate);
    const dayOfWeek = dateObj.getDay();

    // Get active employees for this day
    const activeEmps = employees.filter(emp => {
      if (emp.status !== 'active') return false;
      
      // Match location filter
      if (selectedLocation !== 'all' && emp.location_id !== selectedLocation) {
        return false;
      }

      // Search query
      if (localSearch.trim() !== '') {
        const query = localSearch.toLowerCase();
        const empName = emp.name ? emp.name.toLowerCase() : '';
        const empEmail = emp.email ? emp.email.toLowerCase() : '';
        const empTitle = emp.job_title ? emp.job_title.toLowerCase() : '';
        if (!empName.includes(query) && !empEmail.includes(query) && !empTitle.includes(query)) {
          return false;
        }
      }

      const shift = shifts.find(s => s.id === emp.shift_id);
      if (shift) {
        return shift.work_days.includes(dayOfWeek);
      }
      return dayOfWeek !== 5 && dayOfWeek !== 6;
    });

    // Map to tracking info
    const fullList = activeEmps.map(emp => {
      const record = attendance.find(a => a.employee_id === emp.id);
      const shift = shifts.find(s => s.id === emp.shift_id);
      const location = locations.find(l => l.id === emp.location_id);

      return {
        employee: emp,
        record: record || null,
        shift: shift || null,
        location: location || null,
        status: record ? record.status : 'not_registered'
      };
    });

    // Apply view tabs
    if (activeTab === 'punctual') {
      return fullList.filter(item => item.record && item.status !== 'late');
    } else if (activeTab === 'late') {
      return fullList.filter(item => item.status === 'late');
    } else if (activeTab === 'not_registered') {
      return fullList.filter(item => !item.record);
    }

    return fullList;
  }, [attendance, employees, locations, shifts, selectedDate, selectedLocation, localSearch, activeTab]);

  // Actions
  const handleSendNotification = async () => {
    if (!notifEmployee) return;
    if (!notifTitle.trim() || !notifMessage.trim()) {
      toast.error('يرجى ملء كافة حقول التنبيه');
      return;
    }

    setIsSendingNotif(true);
    const toastId = toast.loading('جاري إرسال التنبيه الإداري...');
    
    try {
      const { error } = await supabase.from('notifications').insert({
        employee_id: notifEmployee.id,
        title: notifTitle.trim(),
        message: notifMessage.trim(),
        type: 'alert',
        is_read: false
      });

      if (error) throw error;

      toast.success(`تم إرسال التنبيه بنجاح للموظف: ${notifEmployee.name}`, { id: toastId });
      setNotifEmployee(null);
      setNotifMessage('');
    } catch (err: any) {
      console.error('Error sending tracking notification:', err);
      toast.error('حدث خطأ أثناء الإرسال: ' + err.message, { id: toastId });
    } finally {
      setIsSendingNotif(false);
    }
  };

  const handleApplyExcuse = async () => {
    if (!excuseEmployee) return;
    if (!excuseReason.trim()) {
      toast.error('يرجى كتابة سبب الإعفاء أو العذر المقبول');
      return;
    }

    setIsSavingExcuse(true);
    const toastId = toast.loading('جاري اعتماد العذر وإعفاء التأخير...');

    try {
      // Excusing lates means changing status to present and preserving late records
      const { error } = await supabase
        .from('attendance')
        .update({
          status: 'present',
          // Optionally add a note or log details
        })
        .eq('id', excuseEmployee.record.id);

      if (error) throw error;

      // Add a notification notifying the employee they were excused
      await supabase.from('notifications').insert({
        employee_id: excuseEmployee.emp.id,
        title: 'اعتماد عذر وتأكيد الحضور',
        message: `تم قبول عذرك الإداري المقدم لتاريخ اليوم بخصوص تأخيرك لسبب: (${excuseReason}) وترقية حالة حضورك للمنضبطين بنجاح.`,
        type: 'broadcast',
        is_read: false
      });

      toast.success(`تم إعفاء الموظف ${excuseEmployee.emp.name} وإلغاء احتساب التأخير بنجاح`, { id: toastId });
      setExcuseEmployee(null);
      setExcuseReason('');
      onRefresh(); // Trigger update
    } catch (err: any) {
      console.error('Excuse delay error:', err);
      toast.error('فشل حفظ التعديل: ' + err.message, { id: toastId });
    } finally {
      setIsSavingExcuse(false);
    }
  };

  const exportLateListToExcel = () => {
    const dataToExport = trackingList.map((item, index) => {
      let delayStatus = 'غير مسجل';
      if (item.record) {
        delayStatus = item.record.status === 'late' ? `متأخر بـ ${item.record.late_minutes} دقيقة` : 'منضبط بالوقت';
      }

      return {
        '#': index + 1,
        'اسم الموظف': item.employee.name,
        'القسم/الوظيفة': item.employee.job_title || item.employee.department,
        'الوردية': item.shift?.name || 'الوردية الافتراضية',
        'وقت بدء الوردية': item.shift ? item.shift.start_time : '08:00',
        'تسجيل الحضور': item.record?.check_in || 'لم يسجل',
        'الحالة والتأخير': delayStatus,
        'رابط موقع الحضور': item.record ? 'رابط خريطة' : 'لا يوجد'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير تتبع وحالات الحضور');
    
    // Auto-fit columns
    const max_len = dataToExport.reduce((prev: any, next: any) => {
      return Object.keys(next).reduce((acc: any, key: string) => {
        const val = String(next[key] || '');
        acc[key] = Math.max(acc[key] || 0, val.length + 4);
        return acc;
      }, prev);
    }, {});
    worksheet['!cols'] = Object.keys(max_len).map(key => ({ wch: max_len[key] }));

    XLSX.writeFile(workbook, `Tafasila_Live_Tracking_${selectedDate}.xlsx`);
    toast.success('تم تصدير ملف إكسل لعمليات التتبع والفرز بنجاح');
  };

  // Percent computed
  const disciplineRate = useMemo(() => {
    const checked = trackingStats.checkedIn;
    if (checked === 0) return 0;
    return Math.round((trackingStats.onTime / checked) * 100);
  }, [trackingStats]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Modern Dashboard Stats with customized widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Dynamic Discipline Gauge */}
        <Card className="bg-gradient-to-br from-indigo-950/20 to-slate-900 border border-slate-800 rounded-[28px] overflow-hidden flex flex-col justify-between relative group shadow-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-505/10 bg-indigo-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles size={16} className="text-indigo-400" />
                  معدل الانضباط اليومي
                </CardTitle>
                <CardDescription className="text-slate-400 text-[11px] mt-1">نسبة الحاضرين بالوقت المحدد من إجمالي الحضور</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2 pb-6 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-4xl font-extrabold text-white tracking-tight">{disciplineRate}%</span>
              <p className="text-xs text-indigo-300 font-medium">معدل الدقة والالتزام اليومي</p>
            </div>
            {/* Minimal Circular Progress Indicator */}
            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" className="text-slate-800" fill="transparent" />
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" className="text-indigo-500 transition-all duration-1000" 
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - disciplineRate / 100)}`}
                  fill="transparent" 
                />
              </svg>
              <span className="absolute text-[10px] font-black text-indigo-300">{disciplineRate}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Checked In On Time Card */}
        <Card className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 py-6 px-5 flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/5">
            <CheckCircle2 size={28} />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block">الحضور المنضبط (بالوقت)</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100">{trackingStats.onTime}</span>
              <span className="text-[11px] text-slate-400 font-bold">من أصل {trackingStats.checkedIn} حضروا</span>
            </div>
          </div>
        </Card>

        {/* Lates Summary Card */}
        <Card className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 py-6 px-5 flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-14 h-14 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center shrink-0 shadow-sm shadow-red-500/5">
            <AlertCircle size={28} />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block">المتأخرين المتتبعين</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-red-600 dark:text-red-400">{trackingStats.late}</span>
              <span className="text-[11px] text-slate-400 font-bold">بمتوسط {trackingStats.averageLateMinutes} دقيقة تأخير</span>
            </div>
          </div>
        </Card>

        {/* Remainder/Not Registered Card */}
        <Card className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 py-6 px-5 flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/5">
            <UserX size={28} />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block">لم يسجلوا حضور بعد</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-amber-600 dark:text-amber-400">{trackingStats.notCheckedInYet}</span>
              <span className="text-[11px] text-slate-400 font-bold">من أصل {trackingStats.activeToday} موظفين اليوم</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
        
        {/* Tracking Tabs switches */}
        <div className="flex flex-wrap bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl shadow-inner gap-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'all' 
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            الجميع ({trackingStats.checkedIn + trackingStats.notCheckedInYet})
          </button>
          <button
            onClick={() => setActiveTab('punctual')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'punctual' 
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <CheckCircle2 size={14} />
            المنضبطين ({trackingStats.onTime})
          </button>
          <button
            onClick={() => setActiveTab('late')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'late' 
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <AlertCircle size={14} />
            المتأخرين اليوم ({trackingStats.late})
          </button>
          <button
            onClick={() => setActiveTab('not_registered')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'not_registered' 
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <UserX size={14} />
            لم يسجلوا ({trackingStats.notCheckedInYet})
          </button>
        </div>

        {/* Local Search and Actions Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          
          {/* Work location quick selector */}
          <div className="w-full sm:w-48">
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="h-11 rounded-xl text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                <SelectValue placeholder="تصفية بالموقع الجغرافي" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                <SelectItem value="all">كل مواقع العمل</SelectItem>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative flex-1 sm:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input 
              placeholder="بحث سريع للتتبع..."
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              className="h-11 pr-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={onRefresh}
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw size={16} />
            </Button>
            <Button
              onClick={exportLateListToExcel}
              className="h-11 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all border-none"
            >
              <FileSpreadsheet size={16} />
              تصدير المراقبة
            </Button>
          </div>
        </div>
      </div>

      {/* Primary Live Tracker List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/30">
              <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800/50">
                <TableHead className="text-right text-slate-500 font-bold py-4 text-xs">الموظف بتتبع الهوية</TableHead>
                <TableHead className="text-right text-slate-500 font-bold py-4 text-xs">الوردية المحددة</TableHead>
                <TableHead className="text-right text-slate-500 font-bold py-4 text-xs">موقع الحضور الإداري</TableHead>
                <TableHead className="text-right text-slate-500 font-bold py-4 text-xs">توقيت تسجيل الحضور</TableHead>
                <TableHead className="text-right text-slate-500 font-bold py-4 text-xs">توقيت الانصراف</TableHead>
                <TableHead className="text-right text-slate-500 font-bold py-4 text-xs">معدل التأخير / المحاكاة</TableHead>
                <TableHead className="text-center text-slate-500 font-bold py-4 text-xs">كاميرا السيلفي</TableHead>
                <TableHead className="text-left text-slate-500 font-bold py-4 text-xs pl-6">تطبيقات التتبع المباشر</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {trackingList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-slate-400 dark:text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <UserX size={44} className="text-slate-300 dark:text-slate-700" />
                        <span className="text-sm font-bold">لا توجد سجلات تتبع مطابقة لخيارات الفرز الحالية.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  trackingList.map((item, index) => {
                    const { employee, record, shift, location, status } = item;
                    return (
                      <motion.tr 
                        key={employee.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15, delay: index * 0.02 }}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 border-slate-100 dark:border-slate-800/50"
                      >
                        {/* Name and avatar */}
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-600 dark:text-slate-300 border border-slate-250 border-slate-200 dark:border-slate-700 shrink-0">
                              {employee.name ? employee.name.charAt(0) : <User size={16} />}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-none">{employee.name || 'بدون اسم'}</span>
                              <span className="text-[11px] text-slate-400 font-bold">{employee.job_title || 'موظف'} - {employee.department}</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Shift details */}
                        <TableCell className="py-4">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100/60 dark:bg-slate-800 px-2 py-1 rounded-md">
                            {shift ? `${shift.name} (${shift.start_time})` : 'وردية غير محددة'}
                          </span>
                        </TableCell>

                        {/* Assigned location */}
                        <TableCell className="py-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                            <MapPin size={14} className="text-indigo-500 shrink-0" />
                            <span>{location ? location.name : 'لا يوجد موقع جغرافي'}</span>
                          </div>
                        </TableCell>

                        {/* Check-In time */}
                        <TableCell className="py-4 font-mono text-sm">
                          {record?.check_in ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 dark:bg-emerald-500/5 px-2.5 py-1 rounded-lg">
                              {record.check_in}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700 font-medium">--:--</span>
                          )}
                        </TableCell>

                        {/* Check-Out time */}
                        <TableCell className="py-4 font-mono text-sm">
                          {record?.check_out ? (
                            <span className="text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10 dark:bg-blue-500/5 px-2.5 py-1 rounded-lg">
                              {record.check_out}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700 font-medium">--:--</span>
                          )}
                        </TableCell>

                        {/* Delay Status */}
                        <TableCell className="py-4">
                          {status === 'not_registered' ? (
                            <Badge className="bg-amber-100 dark:bg-amber-900/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 rounded-lg text-[10px] font-black">
                              غير مسجل بعد
                            </Badge>
                          ) : status === 'late' ? (
                            <div className="flex items-center gap-1.5 animate-pulse">
                              <Badge className="bg-red-500 text-white rounded-lg text-[10px] font-extrabold border-none">
                                متأخر {record?.late_minutes} دقيقة
                              </Badge>
                            </div>
                          ) : (
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/10 rounded-lg text-[10px] font-extrabold">
                              حاضر منضبط
                            </Badge>
                          )}
                        </TableCell>

                        {/* Camera Selfie click */}
                        <TableCell className="py-4 text-center">
                          {record?.check_in_photo ? (
                            <button
                              onClick={() => setSelectedPhoto(record.check_in_photo!)}
                              className="w-10 h-10 rounded-xl overflow-hidden border border-indigo-500/30 hover:border-indigo-500 hover:scale-110 active:scale-95 transition-all shadow-sm shadow-indigo-500/5 mx-auto flex items-center justify-center bg-indigo-50 cursor-pointer"
                            >
                              <img 
                                src={record.check_in_photo} 
                                alt="Selfie" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </button>
                          ) : record?.check_in ? (
                            <span className="text-xs text-slate-300 dark:text-slate-700 flex items-center justify-center">
                              <Camera size={16} className="text-slate-200" />
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300 dark:text-slate-700 font-bold font-mono">--</span>
                          )}
                        </TableCell>

                        {/* Actions pl-6 */}
                        <TableCell className="py-4 pl-6 text-left">
                          <div className="flex items-center justify-start gap-1.5">
                            
                            {/* Excused Button */}
                            {status === 'late' && (
                              <Button
                                onClick={() => setExcuseEmployee({ emp: employee, record: record! })}
                                variant="outline"
                                className="h-8 px-2.5 rounded-lg border-emerald-900/30 bg-emerald-50/10 hover:bg-emerald-500 hover:border-emerald-500 text-emerald-600 hover:text-white dark:hover:text-white dark:border-emerald-800 text-[11px] font-bold cursor-pointer transition-all"
                              >
                                قبول عذره
                              </Button>
                            )}

                            {/* Direct notification popup */}
                            {status === 'late' && (
                              <Button
                                onClick={() => {
                                  setNotifEmployee(employee);
                                  setNotifMessage(`مساء الخير زميلي ${employee.name}.\nلقد رصد النظام تأخرك عن موعد الوردية الافتراضية بمقدار (${record?.late_minutes || 15} دقيقة).\nيرجى محاولة التواجد في الموعد المحدد أو تقديم تبرير إداري لإلغاء النقاط وإعادة تصفير القيد.`);
                                }}
                                variant="outline"
                                className="h-8 px-2.5 rounded-lg border-rose-900/30 bg-rose-50/10 hover:bg-rose-500 hover:border-rose-500 text-rose-500 hover:text-white dark:hover:text-white dark:border-rose-800 text-[11px] font-bold cursor-pointer transition-all"
                              >
                                تبليغ إداري
                              </Button>
                            )}

                            {/* Standard Call or communication logs if not registered yet */}
                            {status === 'not_registered' && (
                              <Button
                                onClick={() => {
                                  setNotifEmployee(employee);
                                  setNotifMessage(`عزيزي الموظف ${employee.name}.\nحتى اللحظة لم يتم تسجيل بصمة حضورك لليوم (${selectedDate}).\nيرجى مراجعة الإدارة إذا كنت معذوراً أو تسجيل حضورك فوراً تلافياً للغياب.`);
                                }}
                                variant="outline"
                                className="h-8 px-2.5 rounded-lg border-indigo-900/30 bg-indigo-50/10 hover:bg-indigo-600 hover:border-indigo-600 text-indigo-600 hover:text-white dark:hover:text-white dark:border-indigo-800 text-[11px] font-bold cursor-pointer transition-all"
                              >
                                تذكير بالحضور
                              </Button>
                            )}

                            {/* Quick phone call context */}
                            {employee.phone && (
                              <a 
                                href={`tel:${employee.phone}`}
                                className="inline-flex w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-150 justify-center items-center text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                title="اتصال مباشر"
                              >
                                <Phone size={13} />
                              </a>
                            )}
                          </div>
                        </TableCell>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* --- Lightbox Selfie Dialog --- */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="sm:max-w-md bg-slate-950/95 border-none shadow-2xl overflow-hidden p-3 rounded-3xl pb-6" dir="rtl">
          <DialogHeader className="py-2">
            <DialogTitle className="text-white text-base font-extrabold flex items-center gap-2">
              <Camera size={16} className="text-indigo-400" />
              بصمة صورة السيلفي للموظف
            </DialogTitle>
          </DialogHeader>
          <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-900">
            {selectedPhoto && (
              <img 
                src={selectedPhoto} 
                alt="Expanded Selfie" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            )}
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-3 leading-relaxed">
            تم التقاط هذه الصورة تلقائياً عبر كاميرا الموظف للتحقق الحيوي ومطابقة السمات.
          </p>
        </DialogContent>
      </Dialog>

      {/* --- Excuse Delay Dialog --- */}
      <Dialog open={!!excuseEmployee} onOpenChange={() => setExcuseEmployee(null)}>
        <DialogContent className="sm:max-w-[480px] bg-white dark:bg-[#1a1a1c] border-none shadow-2xl rounded-[32px] p-6" dir="rtl">
          <DialogHeader className="mb-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center mb-2">
              <CheckCircle2 size={24} className="text-emerald-500" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-slate-100">قبول عذر وتبرير التأخير اليومي</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              بصفتك مسؤولاً، يمكنك ترقية قيد الموظف <strong className="text-teal-600">{excuseEmployee?.emp.name}</strong> إلى منضبط وحذف دقائق التأخير نهائياً في حال وجود مبرر رسمي سليم.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs text-slate-500 font-bold block">سبب العذر الإداري أو مبرر التراجع:</Label>
              <Input
                placeholder="مثال: عطل فني في نظام المواصلات، عمل ميداني خارجي بموافقة مسبقة..."
                value={excuseReason}
                onChange={e => setExcuseReason(e.target.value)}
                className="h-12 text-sm border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#222225] rounded-xl text-slate-900 dark:text-slate-100 focus:border-teal-500 focus-visible:ring-0"
              />
            </div>
          </div>

          <DialogFooter className="mt-6 flex gap-3 flex-row-reverse sm:justify-start">
            <Button
              onClick={handleApplyExcuse}
              disabled={isSavingExcuse || !excuseReason.trim()}
              className="rounded-xl h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm w-full sm:w-auto border-none transition-all active:scale-95 px-6"
            >
              {isSavingExcuse ? 'جاري الاعتماد...' : 'اعتماد العذر وإعفاء الموظف'}
            </Button>
            <Button
              onClick={() => setExcuseEmployee(null)}
              variant="outline"
              className="rounded-xl h-12 border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300 w-full sm:w-auto hover:bg-slate-100 cursor-pointer text-sm"
            >
              إلغاء الأمر
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Send Direct Alert Dialog --- */}
      <Dialog open={!!notifEmployee} onOpenChange={() => setNotifEmployee(null)}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-[#1a1a1c] border-none shadow-2xl rounded-[32px] p-6" dir="rtl">
          <DialogHeader className="mb-4">
            <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mb-2">
              <Send size={20} className="text-indigo-500 animate-pulse" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-slate-100">إرسال تنبيه إداري تتبعي</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              سيصل إشعار فوري وتنبيه للموظف <strong className="text-indigo-500">{notifEmployee?.name}</strong> على حسابه في نفس اللحظة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs text-slate-500 font-bold block">عنوان التبليغ الإداري:</Label>
              <Input
                value={notifTitle}
                onChange={e => setNotifTitle(e.target.value)}
                className="h-11 border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-[#222225] text-slate-900 dark:text-slate-100 text-xs font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-500 font-bold block">مضمون رسالة التنبيه:</Label>
              <textarea
                value={notifMessage}
                onChange={e => setNotifMessage(e.target.value)}
                rows={5}
                className="w-full text-xs font-medium p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#222225] text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus-visible:outline-none"
                placeholder="اكتب رسالة التنبيه التفصيلية هنا..."
              />
            </div>
          </div>

          <DialogFooter className="mt-6 flex gap-3 flex-row-reverse sm:justify-start">
            <Button
              onClick={handleSendNotification}
              disabled={isSendingNotif}
              className="rounded-xl h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm w-full sm:w-auto border-none transition-all active:scale-95 px-6"
            >
              {isSendingNotif ? 'جاري الإرسال...' : 'إرسل التنبيه الفوري الآن'}
            </Button>
            <Button
              onClick={() => setNotifEmployee(null)}
              variant="outline"
              className="rounded-xl h-12 border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300 w-full sm:w-auto hover:bg-slate-100 cursor-pointer text-sm"
            >
              تراجع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
