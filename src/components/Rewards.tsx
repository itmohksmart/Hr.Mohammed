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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Trophy, 
  Search, 
  Plus, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Award, 
  Printer, 
  Filter, 
  Download, 
  Trash2, 
  CheckCircle2, 
  Sparkles,
  ChevronLeft,
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Employee, Reward } from '../types';
import * as xlsx from 'xlsx';

export default function Rewards() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering states
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  
  // Awarding Modal states
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [rewardAmount, setRewardAmount] = useState<string>('');
  const [rewardReason, setRewardReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [rewardDate, setRewardDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);
  const [isTableMissing, setIsTableMissing] = useState(false);

  useEffect(() => {
    if (!isAwardModalOpen) {
      setEmpSearchQuery('');
      setIsEmpDropdownOpen(false);
    }
  }, [isAwardModalOpen]);

  // Certificate Modal State
  const [selectedRewardForCert, setSelectedRewardForCert] = useState<Reward | null>(null);

  // Pre-set reward reasons
  const presetReasons = [
    { value: 'excellence', label: 'التميز وتفاني العمل (عناية وجهد غير اعتيادي)' },
    { value: 'record_time', label: 'إنجاز المهام المطلوبة في وقت قياسي وبجودة عالية' },
    { value: 'overtime_effort', label: 'العمل الإضافي والجهد المميز في تغطية النقص' },
    { value: 'commitment', label: 'الالتزام التام بضوابط الحضور العالي والإنتاجية المميزة' },
    { value: 'creative_ideas', label: 'مبادرة واقتراح أفكار إبداعية ساهمت في تطوير العمل' },
    { value: 'early_attendance', label: 'الحضور المبكر والانتظام الدائم وعدم تسجيل تأخير مطلقا' },
    { value: 'unplanned_tasks', label: 'المرونة العالية في تنفيذ مهام طارئة لخدمة المرفق' },
    { value: 'custom', label: 'سبب مخصص (أدخل سبب المكافأة يدوياً)...' }
  ];

  useEffect(() => {
    fetchUserRoleAndData();
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      fetchRewards();
    }
  }, [employees]);

  const fetchUserRoleAndData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Fetch user role
      const { data: roleRes } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      const role = roleRes?.role || 'employee';
      setUserRole(role);

      // 2. Fetch all employees to map records & enable dropdown selection
      const { data: empData } = await supabase
        .from('employees')
        .select('*');
      
      let mappedEmps: Employee[] = [];
      if (empData) {
        mappedEmps = empData.map(emp => ({
          ...emp,
          name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
        }));
        setEmployees(mappedEmps);

        // Find matches for logged-in employee ID
        const matchedEmp = mappedEmps.find(e => e.email === session.user.email);
        if (matchedEmp) {
          setCurrentEmployeeId(matchedEmp.id);
        }
      }
    } catch (err) {
      console.error('Error fetching user metadata:', err);
      toast.error('حدث خطأ أثناء تحميل بيانات صلاحيات المستخدم');
    }
  };

  const fetchRewards = async () => {
    try {
      setLoading(true);
      
      // Load local storage first so user sees their local data instantly
      const localData = localStorage.getItem('hr_awards_system');
      let localRewards: Reward[] = [];
      if (localData) {
        localRewards = JSON.parse(localData);
      }

      // Try fetching from supabase rewards table
      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.warn('Supabase rewards table is missing or offline, loading from local storage:', error);
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('undefined')) {
          setIsTableMissing(true);
        }
        // Table doesn't exist or permissions error, fallback completely to local storage
        const mapped = localRewards.map(item => ({
          ...item,
          employee: employees.find(emp => emp.id === item.employee_id)
        }));
        setRewards(mapped);
        return;
      }

      setIsTableMissing(false);

      if (data) {
        setIsTableMissing(false);
        const mapped = data.map(item => ({
          ...item,
          employee: employees.find(emp => emp.id === item.employee_id)
        }));
        
        setRewards(mapped);
        
        // Authority: Mirror Supabase records to local storage. 
        // This ensures that if a record was deleted from Supabase (e.g. by an Admin), 
        // it will also be removed from this user's local storage upon next fetch.
        const storageList = data.map(({ employee, ...rest }) => rest);
        localStorage.setItem('hr_awards_system', JSON.stringify(storageList));
      } else {
        // Fallback to local storage only if we have NO data from Supabase (e.g. offline/error)
        loadFromLocalStorage();
      }
    } catch (error: any) {
      console.error('Supabase query failed, falling back to client-side storage:', error);
      loadFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  const seedInitialRewards = () => {
    if (employees.length > 0) {
      const mockArray: Reward[] = [
        {
          id: 'mock-1',
          employee_id: employees[0]?.id || 'emp-id',
          amount: 150000,
          reason: 'التميز وتفاني العمل (عناية وجهد غير اعتيادي)',
          date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString()
        }
      ];
      if (employees.length > 1) {
        mockArray.push({
          id: 'mock-2',
          employee_id: employees[1].id,
          amount: 250000,
          reason: 'الالتزام التام بضوابط الحضور العالي والإنتاجية المميزة',
          date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        });
      }
      localStorage.setItem('hr_awards_system', JSON.stringify(mockArray));
      const mapped = mockArray.map(item => ({
        ...item,
        employee: employees.find(emp => emp.id === item.employee_id)
      }));
      setRewards(mapped);
    } else {
      setRewards([]);
    }
  };

  const loadFromLocalStorage = () => {
    const localData = localStorage.getItem('hr_awards_system');
    if (localData) {
      const parsed: Reward[] = JSON.parse(localData);
      const mapped = parsed.map(item => ({
        ...item,
        employee: employees.find(emp => emp.id === item.employee_id)
      }));
      setRewards(mapped);
    } else {
      setRewards([]);
    }
  };

  const saveLocalRewardOnly = (newReward: Reward) => {
    const localData = localStorage.getItem('hr_awards_system');
    const parsed: Reward[] = localData ? JSON.parse(localData) : [];
    // Prevent duplicate entries
    if (!parsed.some(r => r.id === newReward.id)) {
      const updated = [newReward, ...parsed];
      localStorage.setItem('hr_awards_system', JSON.stringify(updated));
    }
  };

  const handleGrantReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployeeId) {
      toast.error('يرجى اختيار الموظف أولاً');
      return;
    }
    const amountNum = parseFloat(rewardAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('يرجى إدخال مبلغ مكافأة صالح وأكبر من صفر');
      return;
    }

    const selectedPreset = presetReasons.find(r => r.value === rewardReason);
    const finalReason = rewardReason === 'custom' ? customReason : (selectedPreset ? selectedPreset.label : '');
    if (!finalReason.trim()) {
      toast.error('يرجى تحديد أو كتابة سبب المكافأة');
      return;
    }

    setIsSubmitting(true);
    const targetEmpObj = employees.find(emp => emp.id === targetEmployeeId);
    
    const newReward: Reward = {
      id: crypto.randomUUID(),
      employee_id: targetEmployeeId,
      amount: amountNum,
      reason: finalReason,
      date: rewardDate,
      created_at: new Date().toISOString()
    };

    // Save locally first to guarantee it is NEVER lost on page reload!
    saveLocalReward(newReward, targetEmpObj);

    try {
      // Try to save to Supabase
      const { data, error } = await supabase
        .from('rewards')
        .insert({
          id: newReward.id,
          employee_id: newReward.employee_id,
          amount: newReward.amount,
          reason: newReward.reason,
          date: newReward.date,
          created_at: newReward.created_at
        })
        .select();

      // If Supabase works, trigger notification and update remote list if needed
      if (!error) {
        setIsTableMissing(false);
        // Trigger notification inside application
        await supabase.from('notifications').insert({
          employee_id: targetEmployeeId,
          title: '🎉 تهانينا! مكافأة جديدة',
          message: `لقد تم منحك مكافأة مالية بقيمة ${amountNum.toLocaleString()} د.ع لسبب: ${finalReason}. تفاصيل متوفرة بقسم المكافآت.`,
          is_read: false,
          type: 'reward',
          created_at: new Date().toISOString()
        });
        
        fetchRewards(); // Re-sync
      } else {
        console.warn('Supabase insertion error:', error);
        if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('undefined')) {
          setIsTableMissing(true);
        }
      }
    } catch (err) {
      console.warn('Backend database tables error on grant, already saved to local storage:', err);
    } finally {
      setIsSubmitting(false);
      setIsAwardModalOpen(false);
      // Clean states
      setTargetEmployeeId('');
      setRewardAmount('');
      setRewardReason('');
      setCustomReason('');
      setEmpSearchQuery('');
    }
  };

  const saveLocalReward = (newReward: Reward, empObj?: Employee) => {
    saveLocalRewardOnly(newReward);
    
    // Attempt local notifications simulation in layout
    try {
      const existingNotifs = localStorage.getItem('sys_local_notifications');
      const parsedNotifs = existingNotifs ? JSON.parse(existingNotifs) : [];
      parsedNotifs.unshift({
        id: crypto.randomUUID(),
        employee_id: newReward.employee_id,
        title: '🎉 تهانينا! مكافأة جديدة',
        message: `لقد تم منحك مكافأة مالية بقيمة ${newReward.amount.toLocaleString()} د.ع لسبب: ${newReward.reason}.`,
        is_read: false,
        type: 'reward_local',
        created_at: new Date().toISOString()
      });
      localStorage.setItem('sys_local_notifications', JSON.stringify(parsedNotifs));
    } catch (_) {}

    const localData = localStorage.getItem('hr_awards_system');
    const parsed = localData ? JSON.parse(localData) as Reward[] : [];
    const mapped = parsed.map(item => ({
      ...item,
      employee: employees.find(emp => emp.id === item.employee_id)
    }));
    setRewards(mapped);
    toast.success(`تم تسجيل مكافأة الموظف ${empObj?.name || ''} بنجاح`);
  };

  const handleDeleteReward = async (id: string, employeeName: string) => {
    const displayName = employeeName || `السجل (${id.substring(0, 8)})`;
    if (!confirm(`هل أنت متأكد من رغبتك في إلغاء وتصفير هذه المكافأة: ${displayName}؟`)) return;

    // 1. Delete from local storage immediately first to ensure persistence
    const localData = localStorage.getItem('hr_awards_system');
    if (localData) {
      const parsed: Reward[] = JSON.parse(localData);
      const filtered = parsed.filter(item => item.id !== id);
      localStorage.setItem('hr_awards_system', JSON.stringify(filtered));
      setRewards(filtered.map(item => ({
        ...item,
        employee: employees.find(emp => emp.id === item.employee_id)
      })));
    }

    try {
      // 2. Try remote delete
      const { error } = await supabase
        .from('rewards')
        .delete()
        .eq('id', id);

      if (error) {
        toast.error('حدث خطأ أثناء الحذف من السحابة: ' + error.message);
        return;
      }
      
      toast.success('تم حذف المكافأة بنجاح من نظام السحابة والذاكرة');
    } catch (err: any) {
      console.warn('Backend database rewards table missing on delete, fallback to local storage:', err);
      toast.info('تم الحذف محلياً فقط (قاعدة البيانات غير متوفرة)');
    }
  };

  const exportToExcel = () => {
    const filteredRewardsList = getFilteredRewards();
    const dataToExport = filteredRewardsList.map((r, i) => ({
      '#': i + 1,
      'اسم الموظف': r.employee?.name || r.employee_id,
      'القسم': r.employee?.department || 'بلا قسم',
      'مبلغ المكافأة (د.ع)': r.amount,
      'التاريخ': r.date,
      'السبب والبيان التقديري': r.reason
    }));

    const worksheet = xlsx.utils.json_to_sheet(dataToExport);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'تقرير المكافآت والجوائز');
    
    // Style column widths
    const columnWidths = [
      { wch: 5 },
      { wch: 25 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 45 }
    ];
    worksheet['!cols'] = columnWidths;

    xlsx.writeFile(workbook, `System_Rewards_Report_${selectedYear}_${selectedMonth}.xlsx`);
    toast.success('تم تصدير تقرير المكافآت إلى Excel بنجاح');
  };

  const handleCopySQL = () => {
    const sqlSchema = `CREATE TABLE IF NOT EXISTS public.rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/HR can manage rewards" ON public.rewards;
DROP POLICY IF EXISTS "Employees can view their own rewards" ON public.rewards;

CREATE POLICY "Admin/HR can manage rewards" ON public.rewards 
FOR ALL TO authenticated USING (
    (auth.jwt() ->> 'email' IN ('dorgamaltabi@gmail.com', 'mohammedaltai7227@gmail.com')) OR
    public.check_is_admin() OR 
    public.check_is_hr()
) WITH CHECK (true);

CREATE POLICY "Employees can view their own rewards" ON public.rewards 
FOR SELECT TO authenticated USING (
    employee_id IN (SELECT id FROM public.employees WHERE email = auth.jwt() ->> 'email')
);

GRANT ALL ON TABLE public.rewards TO authenticated;
GRANT ALL ON TABLE public.rewards TO service_role;`;

    navigator.clipboard.writeText(sqlSchema);
    toast.success('تم نسخ كود SQL بنجاح! الصقه في نافذة SQL Editor بـ Supabase واضغط Run.');
  };

  const handlePrintCertificate = (reward: Reward) => {
    setSelectedRewardForCert(reward);
  };

  const printCertTrigger = () => {
    const printContent = document.getElementById('cert-print-area')?.innerHTML;
    if (!printContent) return;
    
    // Open print dialog specifically optimized
    const originalContent = document.body.innerHTML;
    const printWindow = window.open('', '', 'width=900,height=650');
    if (printWindow) {
      printWindow.document.write(`
        <html dir="rtl">
          <head>
            <title>شهادة تقدير ومكافأة</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
              body {
                font-family: 'Cairo', sans-serif;
                margin: 0;
                padding: 40px;
                background: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                min-h: 100vh;
              }
              .cert-container {
                border: 15px double #b45309;
                padding: 40px;
                width: 800px;
                background-color: #fffbeb;
                text-align: center;
                position: relative;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              }
              .cert-header {
                font-size: 28px;
                font-weight: 800;
                color: #78350f;
                margin-bottom: 5px;
              }
              .cert-subheader {
                font-size: 14px;
                letter-spacing: 1px;
                color: #d97706;
                text-transform: uppercase;
                margin-bottom: 25px;
              }
              .cert-title {
                font-size: 24px;
                font-weight: 700;
                color: #1e293b;
                margin: 20px 0;
                border-bottom: 2px solid #f59e0b;
                display: inline-block;
                padding-bottom: 5px;
              }
              .cert-body {
                font-size: 18px;
                line-height: 1.8;
                color: #334155;
                margin: 25px 0;
              }
              .cert-recipient {
                font-size: 24px;
                font-weight: 700;
                color: #0c4a6e;
                margin: 10px 0;
              }
              .cert-amount {
                font-size: 20px;
                font-weight: 800;
                color: #047857;
              }
              .cert-footer {
                margin-top: 55px;
                display: flex;
                justify-content: space-between;
                padding: 0 40px;
              }
              .signature {
                border-top: 1px dashed #94a3b8;
                padding-top: 10px;
                width: 150px;
                font-size: 13px;
                font-weight: 600;
                color: #475569;
              }
              @media print {
                body { padding: 0; }
                .cert-container { box-shadow: none; border: 15px double #b45309; }
              }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <div class="cert-container">
              ${printContent}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  // Filtered employees listing for searchable assignment in granting modal
  const filteredEmployeesForGrant = employees.filter(emp => {
    const query = empSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (emp.name && emp.name.toLowerCase().includes(query)) ||
      (emp.job_title && emp.job_title.toLowerCase().includes(query)) ||
      (emp.department && emp.department.toLowerCase().includes(query)) ||
      (emp.email && emp.email.toLowerCase().includes(query))
    );
  });

  const selectedEmployeeObj = employees.find(e => e.id === targetEmployeeId);

  // Logic to view only authorized items
  const getFilteredRewards = () => {
    let list = rewards;
    
    // If not management role, restrict to historical rewards assigned to current logged-in user
    const isManagement = userRole === 'admin' || userRole === 'hr' || userRole === 'sector_manager';
    if (!isManagement && currentEmployeeId) {
      list = rewards.filter(r => r.employee_id === currentEmployeeId);
    }

    // Filter by Date Month & Year
    if (selectedMonth && selectedMonth !== 0) {
      list = list.filter(r => {
        const d = new Date(r.date);
        return (d.getMonth() + 1) === selectedMonth;
      });
    }
    if (selectedYear) {
      list = list.filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === selectedYear;
      });
    }

    // Filter by Search Query (Name)
    if (searchQuery.trim()) {
      list = list.filter(r => 
        r.employee?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        r.reason.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by Department
    if (departmentFilter !== 'all') {
      list = list.filter(r => r.employee?.department === departmentFilter);
    }

    return list;
  };

  const filteredRewards = getFilteredRewards();

  // Monthly stats calculations for dynamic statement
  const currentMonthRewards = filteredRewards;
  const totalAmountGiven = currentMonthRewards.reduce((sum, r) => sum + r.amount, 0);
  const totalCountGiven = currentMonthRewards.length;
  
  // Highest rewarded employee computation
  const employeeTotals: Record<string, { name: string; total: number; count: number }> = {};
  currentMonthRewards.forEach(r => {
    const empId = r.employee_id;
    // Only count if employee is known, or skip if orphaned
    if (r.employee) {
      const name = r.employee.name;
      if (!employeeTotals[empId]) {
        employeeTotals[empId] = { name, total: 0, count: 0 };
      }
      employeeTotals[empId].total += r.amount;
      employeeTotals[empId].count += 1;
    }
  });

  const topHonored = Object.values(employeeTotals).reduce((max: any, curr) => {
    if (!max || curr.total > max.total) return curr;
    return max;
  }, null);

  const averageAmount = totalCountGiven > 0 ? Math.round(totalAmountGiven / totalCountGiven) : 0;

  // Extract unique departments for filtering
  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));

  const isManagement = userRole === 'admin' || userRole === 'hr' || userRole === 'sector_manager';

  return (
    <div className="space-y-6 pb-12 font-sans" dir="rtl">
      {/* Header card with Trophy illustration */}
      <Card className="border-none bg-radial from-slate-900 via-slate-950 to-black text-white overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-amber-500/20 to-amber-700/0 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-gradient-to-tr from-emerald-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
        
        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="text-center md:text-right space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 text-amber-400 px-3 py-1 rounded-full text-xs font-bold leading-none select-none">
              <Sparkles size={14} className="animate-pulse" />
              <span>نظام تقدير وتثمين أداء العاملين</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">مستندات ومكافآت التميز الوظيفي</h1>
            <p className="text-slate-400 text-sm md:text-base font-light leading-relaxed">
              تسجيل وضبط المكافآت والجوائز الرمزية والمالية خارج الراتب الأساسي، مع رصد إحصائيات شهرية مفصلة للموظفين المتميزين.
            </p>
          </div>
          
          <div className="flex gap-4">
            {isManagement && (
              <Button 
                onClick={() => setIsAwardModalOpen(true)}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-6 py-6 h-auto rounded-xl shadow-lg shadow-amber-500/15 transition-all hover:scale-[1.02] active:scale-[0.98] border-0 shrink-0 gap-2"
              >
                <Plus size={20} className="stroke-[3px]" />
                منح مكافأة جديدة
              </Button>
            )}
            
            <Button 
              onClick={exportToExcel}
              variant="outline"
              disabled={filteredRewards.length === 0}
              className="border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:text-white text-slate-300 font-bold px-5 py-6 h-auto rounded-xl shrink-0 gap-2"
            >
              <Download size={18} />
              تصدير Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {isTableMissing && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-400 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm animate-fade-in">
          <div className="flex items-start gap-3 text-right">
            <AlertCircle className="text-amber-500 mt-0.5 shrink-0" size={18} />
            <div className="space-y-1">
              <h4 className="font-bold text-xs md:text-sm">تنبيه المزامنة: جدول المكافآت (rewards) مفقود في قاعدة بيانات Supabase</h4>
              <p className="text-[11px] md:text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                لتسجيل المكافآت سحابياً بشكل دائم ومنع فقضانها عند تحديث المتصفح، يجب تفعيل الجدول في قاعدة بياناتك. اضغط على الزر لنسخ التعليمة البرمجية الجاهزة ولصقها في SQL Editor بلوحة تحكم Supabase.
              </p>
            </div>
          </div>
          <Button 
            onClick={handleCopySQL}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-4 py-2.5 h-auto rounded-xl gap-1.5 shrink-0 shadow-sm"
          >
            <Download size={14} />
            نسخ كود الـ SQL للإنشاء
          </Button>
        </div>
      )}

      {/* Monthly Statistics Statement */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 transition-all hover:shadow-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">إحصاء شهر {selectedMonth}</p>
              <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {totalAmountGiven.toLocaleString()} <span className="text-xs font-medium text-slate-400">د.ع</span>
              </p>
              <p className="text-[10px] text-slate-400 font-medium">مجموع مبالغ المكافآت</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-600 flex items-center justify-center">
              <DollarSign size={24} className="stroke-[2.5px]" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 transition-all hover:shadow-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">العدد الإجمالي</p>
              <p className="text-2xl font-black text-slate-950 dark:text-slate-100">
                {totalCountGiven} <span className="text-xs font-medium text-slate-400">مكافآت</span>
              </p>
              <p className="text-[10px] text-slate-400 font-medium">عدد المرات الممنوحة هذا الشهر</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-600 flex items-center justify-center">
              <Trophy size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 transition-all hover:shadow-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">المتوسط الممنوح</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {averageAmount.toLocaleString()} <span className="text-xs font-medium text-slate-400">د.ع</span>
              </p>
              <p className="text-[10px] text-slate-400 font-medium">متوسط قيمة المكافأة الفردية</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 transition-all hover:shadow-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">الموظف الأكثر تكريماً</p>
              <p className="text-lg font-black text-slate-900 dark:text-slate-100 truncate max-w-[150px]">
                {topHonored ? topHonored.name : 'لا يوجد حالياً'}
              </p>
              <p className="text-[10px] text-slate-400 font-medium">
                {topHonored ? `تلقى ${topHonored.count} مكافآت بقيمة ${topHonored.total.toLocaleString()} د.ع` : 'لم تمنح مكافآت هذا الشهر'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/20 text-purple-600 flex items-center justify-center">
              <Award size={24} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Query Section */}
      <Card className="border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Year Selector */}
            <div className="min-w-[100px]">
              <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}>
                <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-700 h-10 text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-slate-400" />
                    <SelectValue placeholder="السنة" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Month Selector */}
            <div className="min-w-[110px]">
              <Select value={String(selectedMonth)} onValueChange={(val) => setSelectedMonth(Number(val))}>
                <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-700 h-10 text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-slate-400" />
                    <SelectValue placeholder="الشهر" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">كانون الثاني (1)</SelectItem>
                  <SelectItem value="2">شباط (2)</SelectItem>
                  <SelectItem value="3">آذار (3)</SelectItem>
                  <SelectItem value="4">نيسان (4)</SelectItem>
                  <SelectItem value="5">أيار (5)</SelectItem>
                  <SelectItem value="6">حزيران (6)</SelectItem>
                  <SelectItem value="7">تموز (7)</SelectItem>
                  <SelectItem value="8">آب (8)</SelectItem>
                  <SelectItem value="9">أيلول (9)</SelectItem>
                  <SelectItem value="10">تشرين الأول (10)</SelectItem>
                  <SelectItem value="11">تشرين الثاني (11)</SelectItem>
                  <SelectItem value="12">كانون الأول (12)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department Selector */}
            {isManagement && (
              <div className="min-w-[130px]">
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-700 h-10 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <Briefcase size={14} className="text-slate-400" />
                      <SelectValue placeholder="القسم" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأقسام</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept || ''}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Text search */}
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute right-3.5 top-3 text-slate-400" size={16} />
            <Input 
              placeholder={isManagement ? "ابحث باسم الموظف أو البيان والسبب المساعد..." : "البحث في بيانات مكافآتك وبيان الأداء..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-4 pr-10 text-xs rounded-xl h-10 border-slate-200 dark:border-slate-700 w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Rewards Statements List */}
      <Card className="border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-5 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Award className="text-amber-500" size={18} />
              سجل الحوافز والمكافآت
            </CardTitle>
            <CardDescription className="text-xs pt-1">
              عرض سجل الكافآت بحسب الفلاتر المحددة (تم تحميل عدد {filteredRewards.length} سجل)
            </CardDescription>
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-xs text-slate-500">جاري جلب سجل المكافآت من الخادم والذاكرة...</p>
          </div>
        ) : filteredRewards.length === 0 ? (
          <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <AlertCircle size={36} className="text-slate-300 dark:text-slate-700" />
            <div>
              <p className="text-sm font-bold">لا توجد سجلات مكافآت مطابقة</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                {isManagement 
                  ? "لا توجد مكافآت مسجلة في هذا الشهر ببيانات النظام. يمكنك إضافة مكافأة جديدة لأي موظف عبر الضغط على الزر بالأعلى."
                  : "ليس لديك مكافآت مسجلة في هذا الشهر. تابع الأداء والتميز لشهر ناجح!"}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow>
                  <TableHead className="text-right font-bold text-xs text-slate-700 dark:text-slate-300 w-12">#</TableHead>
                  <TableHead className="text-right font-bold text-xs text-slate-700 dark:text-slate-300">الموظف</TableHead>
                  <TableHead className="text-right font-bold text-xs text-slate-700 dark:text-slate-300">القسم الوظيفي</TableHead>
                  <TableHead className="text-right font-bold text-xs text-slate-700 dark:text-slate-300">قيمة المكافأة</TableHead>
                  <TableHead className="text-right font-bold text-xs text-slate-700 dark:text-slate-300">تاريخ المنح</TableHead>
                  <TableHead className="text-right font-bold text-xs text-slate-700 dark:text-slate-300">مبـرر ومنظور المكافأة</TableHead>
                  <TableHead className="text-left font-bold text-xs text-slate-705 dark:text-slate-300 w-32">خيارات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRewards.map((reward, i) => (
                  <TableRow key={reward.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <TableCell className="text-slate-500 font-mono text-xs">{i + 1}</TableCell>
                    <TableCell className="font-bold text-slate-900 dark:text-slate-100">
                      <div className="flex flex-col">
                        <span>{reward.employee?.name || `سجل غير مرتبط بموظف (${reward.employee_id.substring(0, 8)}...)`}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{reward.employee?.email || 'معرف الموظف: ' + reward.employee_id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                      <Badge variant="outline" className="rounded-full px-2 py-0.5 font-normal border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                        {reward.employee?.department || 'بلا قسم'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      {reward.amount.toLocaleString()} <span className="text-[10px] font-normal">د.ع</span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                      {reward.date}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-600 dark:text-slate-300 max-w-xs truncate" title={reward.reason}>
                      {reward.reason}
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex items-center gap-2 justify-end">
                        <Button 
                          onClick={() => handlePrintCertificate(reward)}
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                          title="طباعة شهادة تقدير"
                        >
                          <Printer size={15} />
                        </Button>
                        
                        {isManagement && (
                          <Button 
                            onClick={() => handleDeleteReward(reward.id, reward.employee?.name || '')}
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                            title="إلغاء المكافأة"
                          >
                            <Trash2 size={15} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Granting Award Modal Dialog */}
      <Dialog open={isAwardModalOpen} onOpenChange={setIsAwardModalOpen}>
        <DialogContent className="sm:max-w-xl font-sans" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100">
              <Sparkles className="text-amber-500 animate-spin" size={20} />
              منح مكافأة تميز جديدة لموظف
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGrantReward} className="space-y-4 py-4">
            <div className="space-y-2 relative">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">اختر الموظف المستحق</Label>
              <div className="relative">
                <Input 
                  placeholder="ابحث باسم الموظف، البريد الإلكتروني أو القسم..."
                  value={empSearchQuery}
                  onChange={(e) => {
                    setEmpSearchQuery(e.target.value);
                    setIsEmpDropdownOpen(true);
                  }}
                  onFocus={() => setIsEmpDropdownOpen(true)}
                  className="h-11 rounded-xl text-right pl-10 pr-4 text-xs"
                />
                <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
                
                {isEmpDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={() => setIsEmpDropdownOpen(false)} 
                    />
                    <div className="absolute right-0 left-0 mt-1 max-h-[220px] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-40 py-1">
                      {filteredEmployeesForGrant.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-500">
                          لا يوجد موظف مطابق للبحث
                        </div>
                      ) : (
                        filteredEmployeesForGrant.map(emp => (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => {
                              setTargetEmployeeId(emp.id);
                              setEmpSearchQuery(emp.name || '');
                              setIsEmpDropdownOpen(false);
                            }}
                            className={`w-full text-right px-4 py-2.5 text-xs flex flex-col gap-0.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-50 dark:border-slate-800/30 last:border-0 ${
                              targetEmployeeId === emp.id ? 'bg-amber-500/5 dark:bg-amber-500/10 text-amber-600 font-bold' : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="font-bold text-xs">{emp.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {emp.job_title || 'موظف'} • القسم: {emp.department || 'عام'}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
              
              {selectedEmployeeObj && (
                <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] px-3 py-1.5 rounded-lg mt-1 font-semibold animate-pulse">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>تم تحديد الموظف: <strong className="font-extrabold">{selectedEmployeeObj.name}</strong> • القسم: {selectedEmployeeObj.department}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">مبلغ المكافأة (بالدينار العراقي د.ع)</Label>
                <Input 
                  type="number"
                  placeholder="مثال: 150000"
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(e.target.value)}
                  className="h-11 rounded-xl text-sm font-mono text-left"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">تاريخ المكافأة</Label>
                <Input 
                  type="date"
                  value={rewardDate}
                  onChange={(e) => setRewardDate(e.target.value)}
                  className="h-11 rounded-xl text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">سبب المكافأة (حسب سياسة الأداء والتكريم)</Label>
              <Select value={rewardReason} onValueChange={setRewardReason}>
                <SelectTrigger className="w-full text-right h-11 rounded-xl text-xs">
                  <SelectValue placeholder="اختر مبرر المكافأة..." />
                </SelectTrigger>
                <SelectContent>
                  {presetReasons.map(reason => (
                    <SelectItem key={reason.value} value={reason.value} className="text-right text-xs">
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {rewardReason === 'custom' && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-705">اكتـب السبب المخصص بالتفصيل</Label>
                <textarea 
                  placeholder="يرجى كتابة سبب المكافأة بالتفصيل لتسجيلها بملف الموظف التقديري..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="flex min-h-[60px] w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                  rows={2}
                  required
                />
              </div>
            )}

            <DialogFooter className="pt-4 flex flex-col-reverse sm:flex-row gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAwardModalOpen(false)}
                className="rounded-xl h-11 text-xs"
              >
                إلغاء الأمر
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-6 h-11 rounded-xl flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'جاري المنح والتأمين...' : 'منح المكافأة وإخطار الموظف ⚡'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Recognition Certificate Preview & Print Dialog */}
      <Dialog open={!!selectedRewardForCert} onOpenChange={(open) => !open && setSelectedRewardForCert(null)}>
        <DialogContent className="sm:max-w-2xl font-sans text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Award className="text-amber-500" size={18} />
              معاينة شهادة الشكر والتثمين
            </DialogTitle>
          </DialogHeader>

          {/* Certificate Design Container */}
          <div className="border border-slate-100 rounded-xl p-3 bg-slate-50 dark:bg-slate-950/20 overflow-hidden flex items-center justify-center">
            <div 
              id="cert-print-area" 
              className="border-8 border-double border-amber-700/60 p-6 max-w-lg w-full bg-amber-500/[0.03] text-center space-y-4"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              <h2 className="text-amber-800 text-lg font-black tracking-widest">شهادة تميز وتقدير</h2>
              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">شركة قلعة الطارق - مشروع التحول الذكي للشبكة الكهربائية في الكوت</p>
              
              <div className="h-0.5 w-16 bg-amber-500/40 mx-auto" />
              
              <p className="text-slate-700 text-xs">تقديراً لجهوده الاستثنائية وتفانيه المطلق ببيان عمله، يُمنح الموظف القدير:</p>
              <h3 className="text-sky-950 font-extrabold text-base">{selectedRewardForCert?.employee?.name || selectedRewardForCert?.employee_id}</h3>
              <p className="text-[10px] text-slate-500">من قسم: {selectedRewardForCert?.employee?.department || 'شؤون الموظفين'}</p>
              
              <p className="text-slate-700 text-xs leading-relaxed max-w-sm mx-auto px-4">
                هذه الشهادة ومكافأةً مالية رمزية قدرها <br />
                <span className="text-emerald-700 font-bold text-sm">({selectedRewardForCert?.amount.toLocaleString()} د.ع)</span> بمبرر تمثيلي: <br />
                <span className="font-semibold text-slate-800 text-xs">"{selectedRewardForCert?.reason}"</span>
              </p>

              <div className="pt-2 flex justify-between px-6 text-[9px] text-slate-400">
                <div>تاريخ المنح: {selectedRewardForCert?.date}</div>
                <div>توقيع: قسم الموارد البشرية</div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => setSelectedRewardForCert(null)}
              className="rounded-xl h-10 text-xs"
            >
              إغلاق
            </Button>
            <Button 
              onClick={printCertTrigger}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-10 rounded-xl flex items-center gap-1 text-xs"
            >
              <Printer size={16} />
              اطبع الشهادة الورقية الآن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
