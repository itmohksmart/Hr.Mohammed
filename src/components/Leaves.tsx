import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Leave, Employee } from '../types';
import { toast } from 'sonner';
import { processLeaveStatusUpdate } from '../lib/leaveActions';
import { 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Plus,
  MoreVertical,
  Filter,
  Search,
  CheckCircle,
  AlertCircle,
  History,
  User,
  ArrowRight,
  FileText
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'motion/react';

export default function Leaves() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  const [newLeave, setNewLeave] = useState({
    employee_id: '',
    start_date: '',
    end_date: '',
    type: 'regular',
    reason: '',
    start_time: '',
    end_time: ''
  });

  useEffect(() => {
    fetchData();
    fetchUserRole();
  }, []);

  const fetchUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();
      if (data) setUserRole(data.role);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();
    
    const role = roleData?.role || 'employee';
    const isHRorAdmin = role === 'admin' || role === 'hr';
    const isSectorManager = role === 'sector_manager';

    let empQuery = supabase.from('employees').select('*, location:locations(*)').eq('status', 'active');
    let leaveQuery = supabase.from('leaves').select('*, employee:employees!inner(*)').order('created_at', { ascending: false }).neq('employee.status', 'probation');

    // If sector manager, we need to find their location first
    if (isSectorManager) {
      const { data: managerEmp } = await supabase
        .from('employees')
        .select('location_id')
        .eq('email', session.user.email)
        .single();
      
      if (managerEmp?.location_id) {
        empQuery = empQuery.eq('location_id', managerEmp.location_id);
        leaveQuery = leaveQuery.filter('employee.location_id', 'eq', managerEmp.location_id);
      }
    } else if (!isHRorAdmin) {
      const { data: currentUserEmp } = await supabase
        .from('employees')
        .select('id')
        .eq('email', session.user.email)
        .single();
      
      if (currentUserEmp) {
        empQuery = empQuery.eq('id', currentUserEmp.id);
        leaveQuery = leaveQuery.eq('employee_id', currentUserEmp.id);
      }
    }

    const { data: empData } = await empQuery;
    const { data: leaveData } = await leaveQuery;

    if (empData) {
      const mappedEmployees = empData.map(emp => ({
        ...emp,
        name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
      }));
      setEmployees(mappedEmployees);
      
      // Auto-select current employee for requests if they are not HR/Admin
      if (!isHRorAdmin && mappedEmployees.length === 1) {
        setNewLeave(prev => ({ ...prev, employee_id: mappedEmployees[0].id }));
      }
    }
    if (leaveData) {
      const mappedLeaves = leaveData.map(leave => ({
        ...leave,
        employee: leave.employee ? {
          ...leave.employee,
          name: leave.employee.name || `${leave.employee.first_name || ''} ${leave.employee.last_name || ''}`.trim()
        } : undefined
      }));
      setLeaves(mappedLeaves);
    }
    setLoading(false);
  };

  const filteredLeaves = useMemo(() => {
    return leaves.filter(l => {
      const matchesSearch = l.employee?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           l.reason?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
      const matchesMonth = selectedMonth === 'all' || (l.start_date && l.start_date.startsWith(selectedMonth));
      return matchesSearch && matchesStatus && matchesMonth;
    });
  }, [leaves, searchQuery, statusFilter, selectedMonth]);

  const stats = useMemo(() => {
    return {
      total: leaves.length,
      pending: leaves.filter(l => l.status === 'pending').length,
      approved: leaves.filter(l => l.status === 'approved').length,
      rejected: leaves.filter(l => l.status === 'rejected').length
    };
  }, [leaves]);

  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();

    const allowUnpaidLeave = localStorage.getItem('allowUnpaidLeave') === 'true';

    if (newLeave.type === 'hourly') {
      if (requestedHours > remainingHours) {
        toast.error(`رصيدك المتبقي من الإجازات الزمنية هذا الشهر هو ${remainingHours} ساعات فقط.`);
        return;
      }
    } else {
      // If it's a regular or sick leave, check the balance
      if (newLeave.type === 'regular' || newLeave.type === 'sick') {
        if (requestedDays > remainingDays) {
          toast.error(`رصيدك المتبقي من الإجازات بالأيام هذا الشهر هو ${remainingDays} أيام فقط. يمكنك طلب إجازة بدون راتب إذا كانت مفعلة في الإعدادات.`);
          return;
        }
      } else if (newLeave.type === 'unpaid') {
        if (!allowUnpaidLeave) {
          toast.error('طلب الإجازات بدون راتب غير مفعّل في السياسة العامة للنظام حالياً.');
          return;
        }
        // Unpaid leave doesn't consume regular balance, it's usually allowed as long as the setting is on
      }
    }

    let submitData = {
      employee_id: newLeave.employee_id,
      start_date: newLeave.start_date,
      end_date: newLeave.end_date,
      type: newLeave.type === 'hourly' ? 'other' : newLeave.type,
      reason: newLeave.reason,
    };

    if (newLeave.type === 'hourly') {
       submitData.end_date = newLeave.start_date;
       submitData.reason = `[إجازة زمنية] [من ${newLeave.start_time} إلى ${newLeave.end_time}] ${newLeave.reason}`.trim();
    }

    const { data: insertedData, error } = await supabase
      .from('leaves')
      .insert([submitData])
      .select('id, start_date, end_date');

    if (error) {
      if ((error.message === 'Failed to fetch' || error.message.includes('fetch')) && !navigator.onLine) {
        toast.success('تم الحفظ في وضع عدم الاتصال، سيتم إرسال طلب الإجازة عند عودة الإنترنت.');
        setIsAddOpen(false);
      } else {
        toast.error('خطأ في طلب الإجازة: ' + error.message);
      }
    } else {
      toast.success('تم إرسال طلب الإجازة بنجاح');
      
      const newLeaveId = insertedData?.[0]?.id;
      
      // Notify HR and Admins
      if (newLeaveId) {
        let notifMessage = `يوجد طلب إجازة جديد للمراجعة من تاريخ ${insertedData[0].start_date} إلى ${insertedData[0].end_date}.`;
        if (newLeave.type === 'hourly' || newLeave.reason?.includes('[إجازة زمنية]')) {
           notifMessage = `يوجد طلب إجازة زمنية للمراجعة يوم ${insertedData[0].start_date} من الساعة ${newLeave.start_time} إلى الساعة ${newLeave.end_time}.`;
        }
        
        await supabase.from('notifications').insert([
          {
            target_role: 'admin',
            title: 'طلب إجازة جديد',
            message: notifMessage,
            type: `leave_request:${newLeaveId}`
          },
          {
            target_role: 'hr',
            title: 'طلب إجازة جديد',
            message: notifMessage,
            type: `leave_request:${newLeaveId}`
          }
        ]).catch(console.error);
      }

      setIsAddOpen(false);
      setNewLeave({
        employee_id: '',
        start_date: '',
        end_date: '',
        type: 'regular',
        reason: '',
        start_time: '',
        end_time: ''
      });
      fetchData();
    }
  };

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;
    
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
    return diffDays > 0 ? diffDays : 0;
  };

  const calculateHours = (start: string, end: string) => {
    if (!start || !end) return 0;
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    if (isNaN(startHour) || isNaN(endHour)) return 0;
    
    let hours = endHour - startHour;
    let mins = endMin - startMin;
    
    if (mins < 0) {
      hours -= 1;
      mins += 60;
    }
    
    const totalHours = hours + parseFloat((mins / 60).toFixed(2));
    return totalHours > 0 ? totalHours : 0;
  };

  const getUsedBalances = (employeeId: string) => {
    if (!employeeId) return { usedDays: 0, usedHours: 0 };
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);

    const employeeLeaves = leaves.filter(l => 
      l.employee_id === employeeId && 
      l.status !== 'rejected'
    );

    let usedDays = 0;
    let usedHours = 0;

    employeeLeaves.forEach(l => {
      const leaveStart = new Date(l.start_date);
      const leaveEnd = new Date(l.end_date);
      
      // Hourly leaves
      if (l.type === 'hourly' || (l.type === 'other' && l.reason?.includes('[إجازة زمنية]'))) {
        // Only count if it's in the current month
        if (leaveStart.getMonth() === currentMonth && leaveStart.getFullYear() === currentYear) {
          const match = l.reason?.match(/\[من (.*?) إلى (.*?)\]/);
          if (match && match.length >= 3) {
            usedHours += calculateHours(match[1], match[2]);
          }
        }
      } else if (l.type !== 'unpaid') { // Only count regular/sick/other non-unpaid leaves
        // Normalize dates to midnight for overlap calculation
        leaveStart.setHours(0, 0, 0, 0);
        leaveEnd.setHours(0, 0, 0, 0);
        
        const overlapStart = leaveStart < monthStart ? monthStart : leaveStart;
        const overlapEnd = leaveEnd > monthEnd ? monthEnd : leaveEnd;

        if (overlapStart <= overlapEnd) {
          const diffTime = Math.abs(overlapEnd.getTime() - overlapStart.getTime());
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
          usedDays += diffDays;
        }
      }
    });

    return { usedDays, usedHours };
  };

  const requestedDays = newLeave.type === 'hourly' ? 0 : calculateDays(newLeave.start_date, newLeave.end_date);
  const requestedHours = newLeave.type === 'hourly' ? calculateHours(newLeave.start_time, newLeave.end_time) : 0;

  const MAX_DAYS_PER_MONTH = 2;
  const MAX_HOURS_PER_MONTH = 5;
  const { usedDays, usedHours } = getUsedBalances(newLeave.employee_id);
  const remainingDays = Math.max(0, MAX_DAYS_PER_MONTH - usedDays);
  const remainingHours = Math.max(0, Number((MAX_HOURS_PER_MONTH - usedHours).toFixed(2)));

  const handleStatusUpdate = async (leaveId: string, status: 'approved' | 'rejected') => {
    const success = await processLeaveStatusUpdate(leaveId, status);
    if (success) {
      fetchData();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-[#dcfce7] text-[#166534] hover:bg-[#dcfce7] rounded-[4px] text-[11px] font-medium">مقبول</Badge>;
      case 'rejected': return <Badge className="bg-[#fee2e2] text-[#991b1b] hover:bg-[#fee2e2] rounded-[4px] text-[11px] font-medium">مرفوض</Badge>;
      case 'pending': return <Badge className="bg-[#fef9c3] text-[#854d0e] hover:bg-[#fef9c3] rounded-[4px] text-[11px] font-medium">قيد المراجعة</Badge>;
      default: return null;
    }
  };

  const getLeaveTypeLabel = (type: string, reason: string = '') => {
    if (type === 'hourly' || (type === 'other' && reason?.includes('[إجازة زمنية]'))) return 'إجازة زمنية';
    switch (type) {
      case 'regular': return 'إجازة اعتيادية';
      case 'sick': return 'إجازة مرضية';
      case 'unpaid': return 'إجازة بدون راتب';
      case 'hourly': return 'إجازة زمنية';
      case 'other': return 'أخرى';
      default: return type;
    }
  };

  const getLeaveColor = (type: string, reason: string = '') => {
    const isHourly = type === 'hourly' || (type === 'other' && reason?.includes('[إجازة زمنية]'));
    if (isHourly) return { 
      bg: 'bg-emerald-50/60 dark:bg-emerald-950/20', 
      border: 'border-emerald-400 dark:border-emerald-500/50', 
      text: 'text-emerald-700 dark:text-emerald-400',
      accent: 'bg-emerald-600',
      iconBg: 'bg-emerald-200/80 dark:bg-emerald-900/60',
      shadow: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] dark:hover:shadow-[0_0_30px_rgba(16,185,129,0.1)]',
      badge: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
    };
    
    switch (type) {
      case 'regular': return { 
        bg: 'bg-blue-50/40 dark:bg-blue-900/10', 
        border: 'border-blue-200/50 dark:border-blue-800/40', 
        text: 'text-blue-700 dark:text-blue-400',
        accent: 'bg-blue-500',
        iconBg: 'bg-blue-100/80 dark:bg-blue-900/40',
        shadow: 'hover:shadow-blue-200/40 dark:hover:shadow-none',
        badge: 'bg-blue-100 text-blue-700'
      };
      case 'sick': return { 
        bg: 'bg-rose-50/40 dark:bg-rose-900/10', 
        border: 'border-rose-200/50 dark:border-rose-800/40', 
        text: 'text-rose-700 dark:text-rose-400',
        accent: 'bg-rose-500',
        iconBg: 'bg-rose-100/80 dark:bg-rose-900/40',
        shadow: 'hover:shadow-rose-200/40 dark:hover:shadow-none',
        badge: 'bg-rose-100 text-rose-700'
      };
      case 'unpaid': return { 
        bg: 'bg-amber-50/40 dark:bg-amber-900/10', 
        border: 'border-amber-200/50 dark:border-amber-800/40', 
        text: 'text-amber-700 dark:text-amber-400',
        accent: 'bg-amber-500',
        iconBg: 'bg-amber-100/80 dark:bg-amber-900/40',
        shadow: 'hover:shadow-amber-200/40 dark:hover:shadow-none',
        badge: 'bg-amber-100 text-amber-700'
      };
      default: return { 
        bg: 'bg-slate-50/40 dark:bg-slate-800/20', 
        border: 'border-slate-200/50 dark:border-slate-800/40', 
        text: 'text-slate-700 dark:text-slate-400',
        accent: 'bg-slate-500',
        iconBg: 'bg-slate-100/80 dark:bg-slate-800/40',
        shadow: 'hover:shadow-slate-200/40 dark:hover:shadow-none',
        badge: 'bg-slate-100 text-slate-700'
      };
    }
  };

  const isHRorAdmin = userRole === 'admin' || userRole === 'hr';
  const isSectorManager = userRole === 'sector_manager';
  const canManageLeaves = isHRorAdmin || isSectorManager;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الطلبات', value: stats.total, icon: FileText, color: 'blue', desc: 'كل الطلبات' },
          { label: 'بانتظار المراجعة', value: stats.pending, icon: Clock, color: 'amber', desc: 'تحتاج إجراء' },
          { label: 'الطلبات المقبولة', value: stats.approved, icon: CheckCircle, color: 'emerald', desc: 'تحديث الحضور' },
          { label: 'الطلبات المرفوضة', value: stats.rejected, icon: XCircle, color: 'rose', desc: 'أرشيف' }
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-slate-900/50 p-4 md:p-5 rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm"
          >
            <div className={`w-10 h-10 rounded-2xl bg-${stat.color}-500/10 flex items-center justify-center mb-3 text-${stat.color}-500`}>
              <stat.icon size={20} />
            </div>
            <div className="space-y-1">
              <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{stat.value}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input 
              placeholder="ابحث عن موظف أو سبب..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 h-11 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 rounded-2xl text-xs focus:ring-primary/20"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 w-full sm:w-40 text-xs">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400" />
                <SelectValue placeholder="تصفية حسب الحالة">
                  {statusFilter === 'all' ? 'الكل' :
                   statusFilter === 'pending' ? 'المعلقة' :
                   statusFilter === 'approved' ? 'المقبولة' :
                   statusFilter === 'rejected' ? 'المرفوضة' : undefined}
                </SelectValue>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="pending">المعلقة</SelectItem>
              <SelectItem value="approved">المقبولة</SelectItem>
              <SelectItem value="rejected">المرفوضة</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="relative w-full sm:w-44">
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Input 
              type="month"
              value={selectedMonth === 'all' ? '' : selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value || 'all')}
              className="pr-10 h-11 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-bold focus:ring-primary/20"
            />
            {selectedMonth !== 'all' && (
              <button 
                onClick={() => setSelectedMonth('all')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md font-bold text-slate-500 hover:bg-slate-200"
              >
                الكل
              </button>
            )}
          </div>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white dark:text-white rounded-2xl h-11 px-6 text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2 border-none">
              <Plus size={18} />
              تقديم طلب جديد
            </Button>
        </DialogTrigger>
          <DialogContent className="sm:max-w-md p-6 sm:p-8 bg-white dark:bg-[#1a1a1c] border-none shadow-2xl rounded-[32px] overflow-hidden" dir="rtl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-16 translate-x-16 blur-3xl opacity-50" />
            <DialogHeader className="relative z-10 mb-6">
              <DialogTitle className="text-2xl font-black text-slate-900 dark:text-slate-50 text-right flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Calendar size={22} />
                </div>
                تقديم طلب إجازة
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleAddLeave} className="relative z-10 space-y-6">
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-slate-500 mr-2">الموظف</Label>
                <Select 
                  value={newLeave.employee_id} 
                  onValueChange={val => setNewLeave({...newLeave, employee_id: val})}
                  disabled={!isHRorAdmin && userRole !== 'sector_manager'}
                >
                  <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-800/50 border-none transition-all">
                    <SelectValue placeholder="اختر الموظف">
                      {newLeave.employee_id ? employees.find(e => String(e.id) === String(newLeave.employee_id))?.name || "اختر الموظف" : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(e => (
                      <SelectItem key={e.id} value={String(e.id)} className="font-bold">{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newLeave.employee_id && (
                  <div className="flex gap-4 mt-3 px-4 py-3 bg-primary/5 border border-primary/10 rounded-2xl justify-between items-center">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-500 mb-1 font-bold">المتبقي للأيام</span>
                      <span className={`text-sm font-black ${remainingDays === 0 ? 'text-rose-500' : 'text-primary'}`}>{remainingDays} {remainingDays === 2 ? 'يومين' : (remainingDays === 1 ? 'يوم' : 'أيام')}</span>
                    </div>
                    <div className="w-px h-8 bg-primary/10" />
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-500 mb-1 font-bold">المتبقي للساعات</span>
                      <span className={`text-sm font-black ${remainingHours === 0 ? 'text-rose-500' : 'text-primary'}`}>{remainingHours} {remainingHours >= 3 || remainingHours === 0 ? 'ساعات' : 'ساعة'}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[13px] font-bold text-slate-500 mr-2">نوع الإجازة</Label>
                  <Select value={newLeave.type} onValueChange={val => setNewLeave({...newLeave, type: val as any})}>
                    <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 focus:ring-4 focus:ring-primary/5 rounded-2xl text-slate-900 dark:text-slate-100 font-bold transition-all">
                      <SelectValue placeholder="اختر النوع">
                        {newLeave.type === 'regular' ? 'إجازة اعتيادية' : 
                         newLeave.type === 'sick' ? 'إجازة مرضية' : 
                         newLeave.type === 'hourly' ? 'زمنية (ساعات)' : 
                         newLeave.type === 'unpaid' ? 'إجازة بدون راتب' : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl shadow-xl">
                      <SelectItem value="regular">إجازة اعتيادية</SelectItem>
                      <SelectItem value="sick">إجازة مرضية</SelectItem>
                      <SelectItem value="unpaid">إجازة بدون راتب</SelectItem>
                      <SelectItem value="hourly">إجازة زمنية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] font-bold text-slate-500 mr-2">التاريخ</Label>
                  <Input 
                    type="date" 
                    value={newLeave.start_date} 
                    onChange={e => setNewLeave({...newLeave, start_date: e.target.value, end_date: newLeave.type === 'hourly' ? e.target.value : newLeave.end_date})} 
                    className="h-12 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 focus:ring-4 focus:ring-primary/5 rounded-2xl font-bold" 
                    required 
                  />
                </div>
              </div>
              
              {newLeave.type === 'hourly' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold text-slate-500 mr-2">من الساعة</Label>
                    <Input className="h-12 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 rounded-2xl text-center font-bold" dir="ltr" type="time" value={newLeave.start_time} onChange={e => setNewLeave({...newLeave, start_time: e.target.value})} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[13px] font-bold text-slate-500 mr-2">إلى الساعة</Label>
                    <Input className="h-12 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 rounded-2xl text-center font-bold" dir="ltr" type="time" value={newLeave.end_time} onChange={e => setNewLeave({...newLeave, end_time: e.target.value})} required />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-[13px] font-bold text-slate-500 mr-2">تاريخ الانتهاء</Label>
                  <Input type="date" value={newLeave.end_date} onChange={e => setNewLeave({...newLeave, end_date: e.target.value})} className="h-12 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 rounded-2xl font-bold" required />
                </div>
              )}
              
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-slate-500 mr-2">السبب (اختياري)</Label>
                <Input className="h-12 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 rounded-2xl font-bold" value={newLeave.reason} onChange={e => setNewLeave({...newLeave, reason: e.target.value})} placeholder="مثلاً: ظرف عائلي" />
              </div>

              <div className="py-4 flex flex-col gap-3">
                <div className="flex items-center justify-between px-2">
                   <div className="flex items-center gap-2 text-slate-500 font-bold text-xs">
                     <History size={14} />
                     <span>المدة الإجمالية:</span>
                   </div>
                   <span className="text-sm font-black text-slate-900 dark:text-slate-50">
                     {newLeave.type === 'hourly' 
                       ? `${requestedHours} ${requestedHours > 2 && requestedHours < 11 ? 'ساعات' : 'ساعة'}`
                       : `${requestedDays} ${requestedDays <= 10 && requestedDays >= 3 ? 'أيام' : 'يوم'}`
                     }
                   </span>
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white rounded-2xl h-14 font-black text-lg shadow-xl shadow-primary/20 transition-all active:scale-[0.98]">
                  إرسال الطلب الآن
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="panel shadow-none border-none bg-transparent p-0">
        <AnimatePresence mode="popLayout">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 p-6 flex flex-col gap-6 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-24" />
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-16" />
                    </div>
                  </div>
                  <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-[24px]" />
                  <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                </div>
              ))}
            </div>
          ) : filteredLeaves.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              key="empty-state"
              className="py-32 text-center bg-white dark:bg-slate-900 rounded-[40px] border border-dashed border-slate-200 dark:border-slate-800"
            >
              <div className="flex flex-col items-center gap-6 text-slate-300 dark:text-slate-700">
                <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                  <AlertCircle size={40} strokeWidth={1.5} />
                </div>
                <div className="space-y-1">
                  <p className="font-black text-xl text-slate-800 dark:text-slate-200">لا توجد سجلات مطابقة</p>
                  <p className="text-sm font-bold text-slate-400">حاول تغيير خيارات البحث أو التصفية</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredLeaves.map((leave, idx) => {
                const colors = getLeaveColor(leave.type, leave.reason);
                return (
                  <motion.div 
                    key={leave.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
                    layout
                    className={`${colors.bg} ${colors.border} ${colors.shadow} rounded-[40px] border-2 p-7 flex flex-col gap-6 group hover:-translate-y-2 transition-all duration-500 relative overflow-hidden backdrop-blur-sm shadow-sm`}
                  >
                    {/* Background Pattern for Hourly */}
                    {(leave.type === 'hourly' || leave.reason?.includes('[إجازة زمنية]')) && (
                      <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.1] pointer-events-none" 
                           style={{ backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)', backgroundSize: '12px 12px' }} />
                    )}
                    <div className={`absolute top-0 left-0 w-40 h-40 ${colors.accent} opacity-10 rounded-full blur-[80px] -translate-x-1/2 -translate-y-1/2 pointer-events-none group-hover:opacity-20 transition-opacity duration-700`}></div>
                    
                    {/* Hourly Leave Watermark Icon */}
                    {(leave.type === 'hourly' || leave.reason?.includes('[إجازة زمنية]')) && (
                      <div className="absolute -top-4 -left-4 opacity-[0.03] dark:opacity-[0.07] pointer-events-none transform -rotate-12 group-hover:scale-110 transition-transform duration-700">
                        <Clock size={180} strokeWidth={4} />
                      </div>
                    )}

                    {/* Shimmer Effect for Hourly Leaves */}
                    {(leave.type === 'hourly' || leave.reason?.includes('[إجازة زمنية]')) && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-100/30 dark:via-emerald-400/10 to-transparent -skew-x-12 animate-shimmer scale-y-150" />
                      </div>
                    )}

                    {/* Card Header: Employee Info */}
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className={`w-14 h-14 ${colors.iconBg} ${colors.text} rounded-[22px] flex items-center justify-center font-black text-xl border-2 ${colors.border} shadow-inner transition-all group-hover:scale-110 group-hover:rotate-3 duration-500`}>
                            {leave.employee?.name ? leave.employee.name[0] : <User size={24} />}
                          </div>
                          {leave.status === 'pending' && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 border-2 border-white dark:border-slate-900 rounded-full animate-bounce shadow-lg shadow-amber-500/50" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 dark:text-slate-100 text-[16px] mb-0.5 tracking-tight">{leave.employee?.name}</span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest">{leave.employee?.job_title || 'موظف'}</span>
                        </div>
                      </div>
                      <div className="transform transition-all group-hover:scale-110 duration-500 drop-shadow-sm">
                        {getStatusBadge(leave.status)}
                      </div>
                    </div>

                    {/* Body: Details */}
                    <div className="space-y-5 flex-1 relative z-10">
                      <div className="bg-white/60 dark:bg-slate-900/40 rounded-[28px] p-5 flex flex-col gap-4 group-hover:bg-white/90 dark:group-hover:bg-slate-900/60 transition-all duration-500 border border-white/40 dark:border-slate-700/30 shadow-sm backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${colors.accent} shadow-lg shadow-${colors.accent.split('-')[1]}-500/50`} />
                            <span className={`text-[14px] font-black ${colors.text} uppercase tracking-tighter italic`}>
                              {getLeaveTypeLabel(leave.type, leave.reason)}
                            </span>
                            {(leave.type === 'hourly' || leave.reason?.includes('[إجازة زمنية]')) && (
                              <div className="relative group/sparkle">
                                <div className="absolute inset-0 bg-emerald-400 blur-sm opacity-50 group-hover/sparkle:opacity-80 transition-opacity rounded-full animate-pulse" />
                                <div className="relative bg-emerald-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse flex items-center gap-1.5 border border-emerald-400/50">
                                  <Clock size={10} className="stroke-[3]" />
                                  إجازة زمنية
                                  <motion.span 
                                    animate={{ 
                                      scale: [1, 1.2, 1],
                                      opacity: [0.5, 1, 0.5]
                                    }}
                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                    className="absolute -top-1 -right-1 text-[10px]"
                                  >
                                    ✨
                                  </motion.span>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className={`px-4 py-1.5 ${colors.iconBg} rounded-full border-2 ${colors.border} shadow-md transform group-hover:scale-105 transition-transform duration-500`}>
                            <span className={`text-[12px] font-black ${colors.text} tabular-nums tracking-tight flex items-center gap-1.5`}>
                              {(leave.type === 'hourly' || leave.reason?.includes('[إجازة زمنية]')) && <Clock size={12} className="animate-spin-slow" />}
                              {(() => {
                                if (leave.type === 'hourly' || (leave.type === 'other' && leave.reason?.includes('[إجازة زمنية]'))) {
                                  const match = leave.reason?.match(/\[من (.*?) إلى (.*?)\]/);
                                  if (match && match.length >= 3) {
                                    const hours = calculateHours(match[1], match[2]);
                                    return `${hours} ${hours > 2 && hours < 11 ? 'ساعات' : 'ساعة'}`;
                                  }
                                  return '---';
                                }
                                const days = calculateDays(leave.start_date, leave.end_date);
                                return `${days} ${days <= 10 && days >= 3 ? 'أيام' : 'يوم'}`;
                              })()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 justify-center py-3 relative">
                          <div className="absolute inset-x-0 h-px border-t-2 border-dashed border-slate-200/50 dark:border-slate-700/50 top-1/2 -translate-y-1/2" />
                          <div className="flex flex-col items-center px-3 py-1 bg-white/80 dark:bg-slate-800/80 rounded-xl relative z-10 shadow-sm border border-slate-100 dark:border-slate-700 transition-transform group-hover:scale-105 duration-500">
                            <span className="text-[13px] font-black text-slate-800 dark:text-slate-100 tabular-nums">{leave.start_date}</span>
                            <span className="text-[9.5px] text-slate-400 font-black uppercase tracking-wider">تاريخ البدء</span>
                          </div>
                          <div className={`p-1.5 ${colors.iconBg} rounded-full relative z-10 shadow-md border ${colors.border}`}>
                            <ArrowRight size={14} className={`${colors.text} rotate-180`} />
                          </div>
                          <div className="flex flex-col items-center px-3 py-1 bg-white/80 dark:bg-slate-800/80 rounded-xl relative z-10 shadow-sm border border-slate-100 dark:border-slate-700 transition-transform group-hover:scale-105 duration-500">
                            <span className="text-[13px] font-black text-slate-800 dark:text-slate-100 tabular-nums">
                              {leave.type === 'hourly' ? leave.start_date : leave.end_date}
                            </span>
                            <span className="text-[9.5px] text-slate-400 font-black uppercase tracking-wider">
                              {leave.type === 'hourly' ? 'يوم واحد' : 'تاريخ الانتهاء'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {leave.reason && (
                        <div className="px-3 py-1 bg-white/30 dark:bg-slate-900/20 rounded-2xl border border-white/20 dark:border-slate-800/10 backdrop-blur-sm">
                          <p className="font-medium text-slate-600 dark:text-slate-400 text-[12.5px] leading-relaxed line-clamp-2">
                            <span className="font-black text-slate-400 dark:text-slate-500 text-[10px] uppercase ml-1.5">السبب:</span>
                            {leave.reason}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Actions */}
                    <div className="mt-auto pt-6 border-t border-slate-200/50 dark:border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">الرقم المرجعي</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold tabular-nums bg-slate-100/50 dark:bg-slate-800/50 px-2 py-0.5 rounded-lg border border-slate-200/30 dark:border-slate-700/30">#{leave.id.slice(0, 8)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        {canManageLeaves && leave.status === 'pending' ? (
                          <div className="flex items-center gap-2.5 w-full">
                            <Button 
                              onClick={() => handleStatusUpdate(leave.id, 'rejected')}
                              variant="ghost" 
                              className="flex-1 sm:flex-none h-10 px-5 text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl font-black text-xs border border-rose-100 dark:border-rose-900/30 transition-all active:scale-95"
                            >
                              <XCircle size={16} className="ml-2" />
                              رفض
                            </Button>
                            <Button 
                              onClick={() => handleStatusUpdate(leave.id, 'approved')}
                              className={`flex-1 sm:flex-none h-10 px-5 ${colors.accent} hover:brightness-110 text-white rounded-2xl font-black text-xs shadow-lg shadow-${colors.accent.split('-')[1]}-500/20 transition-all active:scale-95 border-none`}
                            >
                              <CheckCircle2 size={16} className="ml-2" />
                              قبول
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                             <Button variant="ghost" size="icon" className="w-10 h-10 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm border border-transparent hover:border-slate-200/50">
                              <MoreVertical size={20} />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
