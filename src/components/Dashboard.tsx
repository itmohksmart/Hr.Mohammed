import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Clock, Calendar, CreditCard, Bell, ChevronLeft, ArrowUpRight, ArrowDownRight, FileText, CheckCircle2, XCircle, AlertCircle, Download, Activity, Briefcase, TrendingUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ThemeToggle } from './ThemeToggle';
import { Leave, Payroll, Attendance as AttendanceType } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { format } from 'date-fns';
import SmartAttendanceWidget from './SmartAttendanceWidget';
import { getSystemSettings } from '../services/settingsService';
import { applyAttendancePolicy } from '../services/attendancePolicyService';

const COLORS = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6'];
const ATTENDANCE_COLORS = ['#22c55e', '#ef4444', '#f59e0b'];



export default function Dashboard() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [leaveBalance, setLeaveBalance] = useState<number>(0);
  const [hourlyLeaveBalance, setHourlyLeaveBalance] = useState<number>(0);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceType | null>(null);
  const [recentLeaves, setRecentLeaves] = useState<Leave[]>([]);
  const [latestPayroll, setLatestPayroll] = useState<Payroll | null>(null);
  const [currentLateMinutes, setCurrentLateMinutes] = useState<number>(0);
  const [employeeData, setEmployeeData] = useState<any | null>(null);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    pendingLeaves: 0,
    totalPayroll: 0
  });

  useEffect(() => {
    fetchStats();
    fetchUserRole();
  }, []);

  const fetchUserRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const email = session.user.email;
      setUserEmail(email || null);
      
      // Fetch role and employee data in parallel
      try {
        const [roleRes, empRes] = await Promise.all([
          supabase.from('user_roles').select('role').eq('user_id', session.user.id).maybeSingle(),
          email ? supabase.from('employees').select('*, location:locations(*), shift:shifts(*)').eq('email', email).maybeSingle() : Promise.resolve({ data: null, error: null })
        ]);

        if (roleRes.error) {
          console.error("Error fetching user role:", roleRes.error);
        }
        if (roleRes.data) setUserRole(roleRes.data.role);

        if (empRes.error) {
          console.error("Error fetching employee data:", empRes.error);
          toast.error("حدث خطأ أثناء جلب بياناتك: " + empRes.error.message);
        }

        const empData = (empRes as any).data;
        if (empData) {
          const fullName = empData.name || `${empData.first_name || ''} ${empData.last_name || ''}`.trim();
          const mappedEmp = {
            ...empData,
            name: fullName
          };
          setUserName(fullName || email);
          setEmployeeId(empData.id);
          setEmployeeData(mappedEmp);
          
          // Parallel fetch remaining data
          try {
            await Promise.all([
              fetchLeaveBalance(empData.id),
              fetchTodayAttendance(empData.id, empData.shift),
              fetchRecentLeavesAndPayroll(empData.id)
            ]);
          } catch (subErr) {
            console.error("Error fetching dashboard sub-data:", subErr);
          }
        } else {
          console.log("No employee record found for email:", email);
        }
      } catch (err: any) {
        console.error("Critical error in fetchUserRole:", err);
        toast.error("خطأ تقني في النظام: " + err.message);
      }
    }
  };

  const fetchRecentLeavesAndPayroll = async (empId: string) => {
    const { data: leaves } = await supabase
      .from('leaves')
      .select('*')
      .eq('employee_id', empId)
      .order('created_at', { ascending: false })
      .limit(3);
    if (leaves) setRecentLeaves(leaves);

    const { data: payroll } = await supabase
      .from('payroll')
      .select('*')
      .eq('employee_id', empId)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (payroll) setLatestPayroll(payroll);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const { data: attData } = await supabase
      .from('attendance')
      .select('late_minutes')
      .eq('employee_id', empId)
      .gte('date', startOfMonth);
    
    if (attData) {
      const minutes = attData.reduce((sum, record) => sum + (record.late_minutes || 0), 0);
      setCurrentLateMinutes(minutes);
    }
  };

  const fetchTodayAttendance = async (empId: string, shift?: any) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', empId)
      .eq('date', today)
      .maybeSingle();
    
    if (data) {
      const settings = await getSystemSettings();
      const applied = applyAttendancePolicy(data as any, shift, settings);
      setTodayAttendance(applied as any);
    } else {
      setTodayAttendance(null);
    }
  };

  const fetchLeaveBalance = async (empId: string) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);

    const startDateStr = monthStart.toISOString().split('T')[0];
    const endDateStr = monthEnd.toISOString().split('T')[0];

    const { data: activeLeaves } = await supabase
      .from('leaves')
      .select('start_date, end_date, type, status, reason')
      .eq('employee_id', empId)
      .neq('status', 'rejected')
      .neq('type', 'unpaid')
      .or(`and(start_date.lte.${endDateStr},end_date.gte.${startDateStr})`);

    let usedDaysMonthly = 0;
    let usedHoursMonthly = 0;

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

    if (activeLeaves) {
      activeLeaves.forEach(leave => {
        const leaveStart = new Date(leave.start_date);
        const leaveEnd = new Date(leave.end_date);
        const isHourly = leave.type === 'hourly' || (leave.type === 'other' && leave.reason?.includes('[إجازة زمنية]'));

        if (isHourly) {
          if (leaveStart.getMonth() === currentMonth && leaveStart.getFullYear() === currentYear) {
            const match = leave.reason?.match(/\[من (.*?) إلى (.*?)\]/);
            if (match && match.length >= 3) {
              usedHoursMonthly += calculateHours(match[1], match[2]);
            }
          }
          return;
        }

        leaveStart.setHours(0, 0, 0, 0);
        leaveEnd.setHours(0, 0, 0, 0);
        const overlapStart = leaveStart < monthStart ? monthStart : leaveStart;
        const overlapEnd = leaveEnd > monthEnd ? monthEnd : leaveEnd;

        if (overlapStart <= overlapEnd) {
          const diffTime = Math.abs(overlapEnd.getTime() - overlapStart.getTime());
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
          usedDaysMonthly += diffDays;
        }
      });
    }

    const MONTHLY_ALLOWANCE = 2;
    const MONTHLY_HOURS_ALLOWANCE = 5;
    
    setLeaveBalance(Math.max(0, MONTHLY_ALLOWANCE - usedDaysMonthly));
    setHourlyLeaveBalance(Math.max(0, Number((MONTHLY_HOURS_ALLOWANCE - usedHoursMonthly).toFixed(2))));
  };

  const fetchStats = async () => {
    const { count: empCount } = await supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'active');
    
    const { count: leaveCount } = await supabase
      .from('leaves')
      .select('*, employee:employees!inner(*)', { count: 'exact', head: true })
      .eq('status', 'pending')
      .neq('employee.status', 'probation');
    
    const { data: salariesData } = await supabase.from('employees').select('salary').eq('status', 'active');
    const totalPayroll = salariesData ? salariesData.reduce((sum, emp) => sum + (Number(emp.salary) || 0), 0) : 0;

    const today = new Date().toISOString().split('T')[0];
    const { data: todayAttendanceRows } = await supabase
      .from('attendance')
      .select('check_in, status, late_minutes, employee:employees!inner(*)')
      .eq('date', today)
      .neq('employee.status', 'probation');

    const presentCount = todayAttendanceRows ? todayAttendanceRows.filter(r => r.check_in).length : 0;
    const lateCount = todayAttendanceRows ? todayAttendanceRows.filter(r => (r.late_minutes || 0) > 0).length : 0;
    const activeEmps = empCount || 0;

    setStats({
      totalEmployees: activeEmps,
      presentToday: presentCount,
      absentToday: Math.max(0, activeEmps - presentCount),
      lateToday: lateCount,
      pendingLeaves: leaveCount || 0,
      totalPayroll: totalPayroll
    });
  };

  const statCards = [
    { title: 'إجمالي الموظفين', value: stats.totalEmployees, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { title: 'إجمالي الرواتب (شهرياً)', value: `${stats.totalPayroll.toLocaleString()} د.ع`, icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { title: 'الحضور اليوم', value: stats.presentToday, icon: Clock, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
    { title: 'موظفين في إجازة', value: stats.pendingLeaves, icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  ];

  const roleLabels: Record<string, string> = {
    admin: 'مسؤول النظام',
    hr: 'مسؤول الموارد البشرية',
    employee: 'موظف',
    sector_manager: 'إدارة القطاع'
  };

  const isHRorAdmin = userRole === 'admin' || userRole === 'hr' || userRole === 'sector_manager';

  const attendanceChartData = [
    { name: 'حاضر', value: stats.presentToday },
    { name: 'غائب', value: stats.absentToday },
    { name: 'متأخر', value: stats.lateToday },
  ];

  return (
    <div className="space-y-6 pb-20 md:pb-0 font-sans">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl overflow-hidden shadow-lg shrink-0">
            <img 
              src={`https://api.dicebear.com/7.x/notionists/svg?seed=${userEmail || 'hr'}&backgroundColor=e2e8f0`} 
              alt="Profile" 
              className="w-full h-full object-cover bg-slate-100"
            />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              مرحباً بك، <span className="text-primary">{userName?.split(' ')[0] || 'User'}</span>
            </h1>
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 font-medium">
              {userRole ? roleLabels[userRole] : 'موظف'} • إليك ملخص لأهم النشاطات اليوم
            </p>
          </div>
        </div>
      </div>

      {employeeData ? (
        <SmartAttendanceWidget 
          currentEmployee={employeeData} 
          todayAttendance={todayAttendance}
          onAttendanceUpdate={() => {
            fetchStats();
            fetchUserRole();
            if (employeeId) {
              fetchTodayAttendance(employeeId, employeeData?.shift);
              fetchRecentLeavesAndPayroll(employeeId);
            }
          }} 
        />
      ) : !isHRorAdmin && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-6 rounded-[24px] flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-800 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
            <AlertCircle size={24} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">بريدك الإلكتروني غير مرتبط بموظف</h3>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              يرجى مراجعة إدارة الموارد البشرية لربط حسابك ({userEmail}) ببيانات الموظف الخاصة بك.
            </p>
          </div>
        </div>
      )}

      {/* ADMIN & HR DASHBOARD */}
      {isHRorAdmin && (
        <div className="space-y-6">
          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {statCards.map((stat, i) => (
              <Card key={i} className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                      <stat.icon size={24} strokeWidth={2.5} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-1">{stat.value}</h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.title}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6">
            <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Activity className="text-green-500" size={20} />
                  حالة الحضور اليوم
                </CardTitle>
                <CardDescription>توزيع الموظفين المباشرين</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={attendanceChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {attendanceChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={ATTENDANCE_COLORS[index % ATTENDANCE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      formatter={(value) => <span className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-2">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* EMPLOYEE DASHBOARD */}
      {!isHRorAdmin && userRole && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Balances Card with Squares */}
            <Card className="col-span-1 md:col-span-3 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <CardHeader className="pb-0">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Calendar size={20} className="text-blue-500" />
                  رصيد الإجازات الشهري
                </CardTitle>
                <CardDescription>الرصيد المتاح والمستخدم للشهر الحالي</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 pb-6">
                 <div className="grid grid-cols-2 gap-4">
                    {/* Days Balance */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                       <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-2">رصيد الأيام</p>
                       <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-black text-blue-700 dark:text-blue-300">{leaveBalance}</span>
                          <span className="text-sm text-blue-500 font-medium">/ 2 يوم</span>
                       </div>
                       
                       <div className="flex gap-1.5 mt-5">
                         {Array.from({length: 2}).map((_, i) => (
                           <div key={i} className={`w-6 h-6 rounded-md ${i < leaveBalance ? 'bg-blue-500 shadow-sm' : 'bg-blue-200/50 dark:bg-blue-800/50'} transition-all`} title={i < leaveBalance ? "متبقي" : "مستخدم"} />
                         ))}
                       </div>
                    </div>
                    
                    {/* Hours Balance */}
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                       <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-2">رصيد الساعات (الزمنيات)</p>
                       <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-black text-indigo-700 dark:text-indigo-300">{hourlyLeaveBalance}</span>
                          <span className="text-sm text-indigo-500 font-medium">/ 5 ساعات</span>
                       </div>

                       <div className="flex gap-1.5 mt-5">
                         {Array.from({length: 5}).map((_, i) => (
                           <div key={i} className={`w-6 h-6 rounded-md ${i < hourlyLeaveBalance ? 'bg-indigo-500 shadow-sm' : 'bg-indigo-200/50 dark:bg-indigo-800/50'} transition-all`} title={i < hourlyLeaveBalance ? "متبقية" : "مستخدمة"} />
                         ))}
                       </div>
                    </div>
                 </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Leaves List */}
            <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm">
              <CardHeader className="border-b border-slate-50 dark:border-slate-800/50 pb-4">
                <CardTitle className="text-lg font-bold">طلبات الإجازة الأخيرة</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {recentLeaves.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">لا توجد طلبات إجازة حديثة</div>
                ) : (
                  <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {recentLeaves.map(leave => (
                      <div key={leave.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            leave.type === 'hourly' ? 'bg-indigo-50 text-indigo-500' :
                            leave.type === 'sick' ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'
                          }`}>
                            <Briefcase size={18} />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                              {leave.type === 'hourly' ? 'إجازة زمنية' :
                               leave.type === 'sick' ? 'إجازة مرضية' : 'إجازة اعتيادية'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {leave.start_date} {leave.type === 'hourly' ? `(${leave.start_time})` : ''}
                            </p>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold border ${
                          leave.status === 'approved' ? 'bg-green-50 text-green-600 border-green-200' :
                          leave.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-200' : 
                          'bg-orange-50 text-orange-600 border-orange-200'
                        }`}>
                          {leave.status === 'approved' ? 'مقبول' : leave.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payroll summary */}
            <Card className="bg-slate-950 border-slate-800 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
              <CardHeader className="pb-2 relative z-10">
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="text-blue-400" size={20} />
                  قسيمة الراتب الأخيرة
                </CardTitle>
                <CardDescription className="text-slate-400">ملخص وتفاصيل الراتب لآخر شهر</CardDescription>
              </CardHeader>
              <CardContent className="relative z-10 flex flex-col justify-between h-[calc(100%-80px)]">
                {latestPayroll ? (
                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-medium text-slate-400 mb-2">صافي الراتب المستحق (شهر {latestPayroll.month}/{latestPayroll.year})</p>
                      <h2 className="text-4xl font-black text-white">{latestPayroll.net_salary.toLocaleString()} <span className="text-lg font-normal text-slate-500">د.ع</span></h2>
                    </div>
                    
                    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center">
                          <AlertCircle size={18} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-medium">دقائق التأخير المتراكمة</p>
                          <p className="text-lg font-bold text-white">{currentLateMinutes} <span className="text-xs text-slate-500">دقيقة</span></p>
                        </div>
                      </div>
                    </div>

                    <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-6 shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all gap-2 font-bold text-sm border border-blue-500/50">
                      <Download size={18} />
                      تحميل قسيمة الراتب بالتفصيل
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                    <FileText size={48} className="opacity-20" />
                    <p className="text-sm font-medium">لا توجد قسائم رواتب متوفرة في النظام</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
