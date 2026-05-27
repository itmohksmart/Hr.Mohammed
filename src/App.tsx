import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { 
  Users, 
  Calendar, 
  Clock, 
  CreditCard, 
  BarChart3, 
  Settings as SettingsIcon, 
  LogOut, 
  LayoutDashboard,
  LayoutGrid,
  Menu,
  X,
  Plus,
  Search,
  ChevronRight,
  UserCircle,
  MapPin,
  Shield,
  Bell,
  CheckCircle2,
  XCircle as XCircleIcon,
  Info,
  Megaphone,
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from '@/components/ui/input';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Notification } from './types';

// Components (to be moved to separate files if needed)
import Dashboard from './components/Dashboard';
import Employees from './components/Employees';
import Attendance from './components/Attendance';
import Leaves from './components/Leaves';
import Payroll from './components/Payroll';
import Reports from './components/Reports';
import Locations from './components/Locations';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import Settings from './components/Settings';
import Shifts from './components/Shifts';
import OrgChart from './components/OrgChart';
import LocationTracker from './components/LocationTracker';

import { ThemeToggle } from './components/ThemeToggle';
import { processLeaveStatusUpdate } from './lib/leaveActions';

import SharedOrgChartViewer from './components/SharedOrgChartViewer';
import BroadcastModal from './components/BroadcastModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

type View = 'dashboard' | 'employees' | 'attendance' | 'leaves' | 'payroll' | 'reports' | 'locations' | 'settings' | 'users' | 'shifts' | 'org_chart';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [activeUrgentAlert, setActiveUrgentAlert] = useState<Notification | null>(null);

  useEffect(() => {
    // If there's no active alert but there is an unread urgent broadcast, show it.
    if (!activeUrgentAlert) {
      const urgent = notifications.find(n => n.type === 'urgent_broadcast' && !n.is_read);
      if (urgent) setActiveUrgentAlert(urgent);
    }
  }, [notifications, activeUrgentAlert]);

  const handleDismissUrgentAlert = async () => {
    if (!activeUrgentAlert) return;
    const alertId = activeUrgentAlert.id;
    
    // Always dismiss locally first to unblock the UI immediately
    setActiveUrgentAlert(null);
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', alertId);
        
      if (!error) {
        setNotifications(prev => prev.map(n => n.id === alertId ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (e) {
      console.error('Failed to mark urgent alert as read:', e);
    }
  };

  const urlParams = new URLSearchParams(window.location.search);
  const sharedChartId = urlParams.get('shared_chart');

  if (sharedChartId) {
    return (
      <>
        <SharedOrgChartViewer shareId={sharedChartId} />
        <Toaster position="top-center" />
      </>
    );
  }

  // Network connection status listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('تمت استعادة الاتصال بالإنترنت', { duration: 3000 });
    };
    
    const handleOffline = () => {
      setIsOffline(true);
      toast.error('أنت الآن غير متصل بالإنترنت. بعض الميزات قد لا تعمل بشكل صحيح.', { 
        duration: 5000,
        icon: <Shield className="text-red-500" />
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleAuthError = (event: PromiseRejectionEvent) => {
      if (event.reason && event.reason.message && event.reason.message.includes('Refresh Token')) {
        event.preventDefault();
        supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        localStorage.clear();
      }
    };
    window.addEventListener('unhandledrejection', handleAuthError);
    return () => window.removeEventListener('unhandledrejection', handleAuthError);
  }, []);

  const hasConfig = (() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key || url.includes('your-project')) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    if (!hasConfig) return;

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error && (error.message.includes('Refresh') || error.message.includes('Token'))) {
        supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        localStorage.clear(); // fallback
      }
      setSession(session);
      if (session) fetchUserRole(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserRole(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, [hasConfig]);

  const [lastNotificationCheck, setLastNotificationCheck] = useState<Date>(new Date());

  useEffect(() => {
    if (session) {
      fetchNotifications();
      
      const orQuery = `user_id.eq.${session.user.id},target_role.eq.${userRole || 'none'},target_role.eq.all,employee_id.eq.${currentEmployeeId || '00000000-0000-0000-0000-000000000000'}`;

      // Set up simple polling as a fallback since Realtime might not be enabled on the table
      const interval = setInterval(async () => {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('is_read', false)
          .or(orQuery)
          .order('created_at', { ascending: false });
          
        if (data && data.length > 0) {
          setNotifications(prev => {
            const newNotifs = data.filter(n => !prev.find(p => p.id === n.id));
            if (newNotifs.length > 0) {
              // Toast new notifications
              newNotifs.forEach(n => toast.info(n.title));
              return [...newNotifs, ...prev];
            }
            return prev;
          });
          setUnreadCount(data.length);
        }
      }, 5000);

      // Set up realtime subscription for notifications
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications'
          },
          (payload) => {
            const n = payload.new as Notification;
            const isForMe = n.user_id === session.user.id || 
                            n.target_role === userRole || 
                            n.target_role === 'all' || 
                            n.employee_id === currentEmployeeId;
                            
            if (!isForMe) return;

            setNotifications(prev => {
              // Prevent duplicates if polling already caught it
              if (prev.find(p => p.id === n.id)) return prev;
              
              setUnreadCount(count => count + 1);
              toast.info(n.title);
              return [n, ...prev];
            });
          }
        )
        .subscribe();

      return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
      };
    }
  }, [session, currentEmployeeId, userRole]);

  const fetchNotifications = async () => {
    if (!session) return;
    const orQuery = `user_id.eq.${session.user.id},target_role.eq.${userRole || 'none'},target_role.eq.all,employee_id.eq.${currentEmployeeId || '00000000-0000-0000-0000-000000000000'}`;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .or(orQuery)
      .order('created_at', { ascending: false })
      .limit(30);
    
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    
    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!session || notifications.length === 0) return;
    const ids = notifications.filter(n => !n.is_read).map(n => n.id);
    if (ids.length === 0) return;
    
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', ids);
    
    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const clearAllNotifications = async () => {
    if (!session || notifications.length === 0) return;
    
    const confirmClear = window.confirm('هل أنت متأكد من رغبتك في مسح كافة الإشعارات؟');
    if (!confirmClear) return;
    
    const ids = notifications.map(n => n.id);
    const { error } = await supabase
      .from('notifications')
      .delete()
      .in('id', ids);
    
    if (!error) {
      setNotifications([]);
      setUnreadCount(0);
      toast.success('تم مسح جميع الإشعارات بنجاح');
    } else {
      toast.error('حدث خطأ أثناء مسح الإشعارات');
    }
  };

  const handleLeaveAction = async (e: React.MouseEvent, leaveId: string, status: 'approved' | 'rejected', notificationId: string) => {
    e.stopPropagation();
    const success = await processLeaveStatusUpdate(leaveId, status);
    if (success) {
      const newTitle = status === 'approved' ? 'تمت الموافقة على الطلب' : 'تم رفض الطلب';
      const newType = 'leave_' + status;
      
      setNotifications(prev => prev.map(n => 
        n.id === notificationId 
          ? { ...n, type: newType, title: newTitle, is_read: true } 
          : n
      ));
      
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      await supabase.from('notifications').update({ 
        type: newType, 
        title: newTitle, 
        is_read: true 
      }).eq('id', notificationId);
    }
  };

  const fetchUserRole = async (userId: string) => {
    if (!hasConfig) return;
    
    // Fetch role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();
    
    if (roleData) setUserRole(roleData.role);

    // Fetch name from employees table
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError && (userError.message.includes('Refresh') || userError.message.includes('Token'))) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      localStorage.clear();
      return;
    }
    if (user?.email) {
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();
      
      if (empError) {
        console.error('Error fetching employee for role:', empError);
      }
      
      if (empData) {
        const fullName = empData.name || `${empData.first_name || ''} ${empData.last_name || ''}`.trim();
        setUserName(fullName || user.email);
        setUserLocation(empData.location_id);
        setCurrentEmployeeId(empData.id);
      }
    }
  };

  const handleLogout = async () => {
    if (!hasConfig) return;
    await supabase.auth.signOut();
    setCurrentEmployeeId(null);
    toast.success('تم تسجيل الخروج بنجاح');
  };

  if (!hasConfig) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4 font-sans" dir="rtl">
        <Card className="w-full max-w-md border-none shadow-2xl bg-card-bg rounded-xl overflow-hidden p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-warning mb-6">
            <SettingsIcon size={32} />
          </div>
          <h2 className="text-2xl font-bold text-text-main mb-4">إعدادات Supabase مطلوبة</h2>
          <p className="text-text-muted mb-6">
            يرجى إضافة <code>VITE_SUPABASE_URL</code> و <code>VITE_SUPABASE_ANON_KEY</code> في قائمة الإعدادات (Settings) لتشغيل التطبيق.
          </p>
          <div className="p-4 bg-slate-50 rounded-lg text-right text-xs font-mono text-slate-600 space-y-2">
            <p>VITE_SUPABASE_URL=https://your-project.supabase.co</p>
            <p>VITE_SUPABASE_ANON_KEY=your-anon-key</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans" dir="rtl">
        <Login />
        <Toaster position="top-center" />
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, roles: ['admin', 'hr', 'employee', 'sector_manager'] },
    { id: 'employees', label: 'الموظفين', icon: Users, roles: ['admin', 'hr', 'sector_manager'] },
    { id: 'org_chart', label: 'الهيكل التنظيمي', icon: LayoutGrid, roles: ['admin', 'hr', 'sector_manager'] },
    { id: 'attendance', label: 'الحضور والغياب', icon: Clock, roles: ['admin', 'hr', 'employee', 'sector_manager'] },
    { id: 'shifts', label: 'الورديات', icon: Clock, roles: ['admin', 'hr'] },
    { id: 'leaves', label: 'الإجازات', icon: Calendar, roles: ['admin', 'hr', 'employee', 'sector_manager'] },
    { id: 'payroll', label: 'الرواتب', icon: CreditCard, roles: ['admin', 'hr', 'employee'] },
    { id: 'reports', label: 'التقارير', icon: BarChart3, roles: ['admin', 'hr', 'sector_manager'] },
    { id: 'locations', label: 'مواقع العمل', icon: MapPin, roles: ['admin', 'hr'] },
    { id: 'users', label: 'إدارة الصلاحيات', icon: Shield, roles: ['admin'] },
    { id: 'settings', label: 'الإعدادات', icon: SettingsIcon, roles: ['admin', 'hr'] },
  ];

  const filteredNavItems = navItems.filter(item => {
    const role = userRole || 'employee';
    return item.roles.includes(role as any);
  });

  const roleLabels: Record<string, string> = {
    admin: 'مسؤول النظام',
    hr: 'مسؤول HR',
    employee: 'موظف',
    sector_manager: 'إدارة القطاع'
  };

  return (
    <div className="min-h-screen bg-bg flex font-sans" dir="rtl">
      {/* Sidebar Overlay for Mobile */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[45] animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen 
            ? 'w-[240px] translate-x-0' 
            : isMobile 
              ? 'w-[240px] translate-x-full' 
              : 'w-20 translate-x-0'
        } bg-sidebar text-white transition-all duration-300 flex flex-col fixed h-full z-50 right-0 top-0 shadow-xl`}
      >
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 bg-gradient-to-br from-[#38bdf8] to-[#0284c7] rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-sky-500/20 transform transition-transform hover:scale-105 shrink-0 cursor-pointer" onClick={() => !isSidebarOpen && setIsSidebarOpen(true)}>
              HR
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col animate-in fade-in slide-in-from-right-2 duration-300">
                <span className="font-black text-lg leading-tight tracking-tight text-white">HR-Mohammed</span>
                <span className="text-[10px] uppercase tracking-widest text-[#38bdf8] font-semibold opacity-80">Management System</span>
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-2 hover:bg-white/10 rounded-lg text-slate-400 ${!isSidebarOpen && 'hidden'}`}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-0 space-y-0 mt-4">
          {filteredNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as View)}
              className={`w-full flex items-center gap-3 px-6 py-3 transition-all text-sm ${
                currentView === item.id 
                  ? 'bg-white/10 text-white border-r-4 border-primary' 
                  : 'text-[#cbd5e1] hover:bg-white/5'
              }`}
            >
              <item.icon size={18} />
              {isSidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className={`flex items-center gap-3 px-4 py-3 ${!isSidebarOpen && 'justify-center'}`}>
            <div className="w-9 h-9 bg-slate-400 rounded-full flex items-center justify-center text-sidebar font-bold text-sm">
              {userName ? userName[0].toUpperCase() : session.user.email?.[0].toUpperCase()}
            </div>
            {isSidebarOpen && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-white truncate">{userName || session.user.email}</p>
                <p className="text-xs text-slate-400 capitalize">{userRole ? roleLabels[userRole] : 'موظف'}</p>
              </div>
            )}
          </div>
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all mt-2 ${!isSidebarOpen && 'justify-center'}`}
          >
            <LogOut size={18} />
            {isSidebarOpen && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen && !isMobile ? 'mr-[240px]' : isMobile ? 'mr-0' : 'mr-20'} print:mr-0 p-4 md:p-6 flex flex-col gap-6 w-full overflow-x-hidden pb-24 md:pb-8`}>
        {/* Background Location Tracker */}
        <LocationTracker employeeId={currentEmployeeId} enabled={!!session && !!currentEmployeeId} />
        
        {/* Header - Only visible on desktop or non-dashboard views on mobile */}
        {(!isMobile || currentView !== 'dashboard') && (
          <header className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 md:p-3 px-4 md:px-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm mb-0">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              {isMobile && (
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 shrink-0"
                >
                  <Menu size={20} />
                </button>
              )}
              {/* Only show title on mobile or smaller screens where it might be needed for orientation */}
              {isMobile && (
                <h1 className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                  {navItems.find(i => i.id === currentView)?.label}
                </h1>
              )}
              {isOffline && (
                <div className="flex items-center gap-1 text-[10px] bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">
                  <XCircleIcon size={12} />
                  <span>وضع عدم الاتصال</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              <div className="flex items-center gap-1 md:gap-2">
                {(userRole === 'admin' || userRole === 'hr') && (
                  <BroadcastModal>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary transition-colors" title="إرسال تعميم">
                      <Megaphone size={20} />
                    </Button>
                  </BroadcastModal>
                )}
                
                <ThemeToggle />
                
                {/* Notifications Bell */}
                <Popover>
                  <PopoverTrigger className="relative p-2 text-slate-400 hover:text-primary transition-colors">
                    <Bell size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                        {unreadCount}
                      </span>
                    )}
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0 rounded-xl border-none shadow-2xl mr-4" align="end" dir="rtl">
                    <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between gap-2">
                      <h3 className="font-bold text-sm">الإشعارات</h3>
                      <div className="flex items-center gap-3">
                        {unreadCount > 0 && (
                          <button 
                            onClick={markAllAsRead}
                            className="text-[10px] text-blue-600 hover:underline font-bold"
                          >
                            تعيين الكل كمقروء
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button 
                            onClick={clearAllNotifications}
                            className="text-[10px] text-red-600 hover:underline font-bold flex items-center gap-1"
                          >
                            <Trash2 size={10} />
                            تصفير السجل
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs">
                          لا توجد إشعارات حالياً
                        </div>
                      ) : (
                        notifications.map(notification => (
                          <div 
                            key={notification.id}
                            onClick={() => !notification.is_read && markAsRead(notification.id)}
                            className={`p-4 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer flex gap-3 ${!notification.is_read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              notification.type === 'leave_approved' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                              notification.type === 'leave_rejected' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 
                              notification.type?.startsWith('leave_request') ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 
                              notification.type === 'urgent_broadcast' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                              notification.type === 'broadcast' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {notification.type === 'leave_approved' ? <CheckCircle2 size={16} /> :
                               notification.type === 'leave_rejected' ? <XCircleIcon size={16} /> : 
                               notification.type === 'urgent_broadcast' ? <AlertTriangle size={16} /> :
                               notification.type === 'broadcast' ? <Megaphone size={16} /> :
                               <Info size={16} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{notification.title}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{notification.message}</p>
                              
                              {notification.type?.startsWith('leave_request') && !notification.is_read && (
                                <div className="flex items-center gap-2 mt-2">
                                  <Button 
                                    onClick={(e) => handleLeaveAction(e, notification.type.split(':')[1], 'approved', notification.id)}
                                    className="h-7 text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg px-3"
                                  >
                                    موافقة
                                  </Button>
                                  <Button 
                                    onClick={(e) => handleLeaveAction(e, notification.type.split(':')[1], 'rejected', notification.id)}
                                    variant="outline"
                                    className="h-7 text-[10px] text-rose-600 border-rose-200 hover:bg-rose-50 rounded-lg px-3"
                                  >
                                    رفض
                                  </Button>
                                </div>
                              )}
                              
                              <p className="text-[9px] text-slate-400 mt-1">
                                {new Date(notification.created_at).toLocaleDateString('ar-SA')}
                              </p>
                            </div>
                            {!notification.is_read && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1" />}
                          </div>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {!isMobile && (
                  <button className="p-2 text-slate-400 hover:text-primary transition-colors">
                    <Search size={20} />
                  </button>
                )}
              </div>
              <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700">
                {userName ? userName[0].toUpperCase() : session.user.email?.[0].toUpperCase()}
              </div>
            </div>
          </header>
        )}

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {currentView === 'dashboard' && <Dashboard />}
          {(currentView === 'employees' && (userRole === 'admin' || userRole === 'hr' || userRole === 'sector_manager')) && <Employees />}
          {currentView === 'attendance' && <Attendance />}
          {currentView === 'shifts' && (userRole === 'admin' || userRole === 'hr') && <Shifts />}
          {currentView === 'leaves' && <Leaves />}
          {currentView === 'payroll' && <Payroll />}
          {(currentView === 'reports' && (userRole === 'admin' || userRole === 'hr' || userRole === 'sector_manager')) && <Reports />}
          {(currentView === 'org_chart' && (userRole === 'admin' || userRole === 'hr' || userRole === 'sector_manager')) && <OrgChart />}
          {(currentView === 'locations' && (userRole === 'admin' || userRole === 'hr')) && <Locations />}
          {(currentView === 'users' && userRole === 'admin') && <UserManagement />}
          {(currentView === 'settings' && (userRole === 'admin' || userRole === 'hr')) && <Settings />}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 px-1 py-2 flex items-center justify-around z-40 shadow-[0_-8px_20px_rgba(0,0,0,0.05)]">
          {filteredNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id as View)}
              className={`flex flex-col items-center gap-1 flex-1 min-w-0 transition-all duration-300 ${
                currentView === item.id 
                  ? 'text-primary scale-105' 
                  : 'text-slate-400'
              }`}
            >
              <div className={`relative p-1 ${currentView === item.id ? 'after:content-[""] after:absolute after:-bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-primary after:rounded-full' : ''}`}>
                <item.icon size={18} className={currentView === item.id ? 'stroke-[2.5px]' : 'stroke-[2px]'} />
              </div>
              <span className={`text-[8px] font-bold truncate w-full text-center transition-opacity duration-300 ${currentView === item.id ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                {item.id === 'dashboard' ? 'الرئيسية' : 
                 item.id === 'employees' ? 'الموظفين' :
                 item.id === 'attendance' ? 'الحضور' :
                 item.id === 'leaves' ? 'الإجازات' : 
                 item.id === 'payroll' ? 'الرواتب' :
                 item.id === 'reports' ? 'التقارير' :
                 item.id === 'locations' ? 'المواقع' :
                 item.id === 'org_chart' ? 'الهيكل' :
                 item.id === 'shifts' ? 'الورديات' :
                 item.id === 'users' ? 'الصلاحيات' : 'الإعدادات'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Urgent Broadcast Dialog */}
      <Dialog open={!!activeUrgentAlert} onOpenChange={() => {}}>
        <DialogContent 
          className="sm:max-w-md font-sans border-t-4 border-amber-500" 
          dir="rtl" 
          onInteractOutside={(e) => e.preventDefault()} 
          onEscapeKeyDown={(e) => e.preventDefault()}
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-amber-600">
              <AlertTriangle className="w-6 h-6" />
              تعميم عاجل
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <h3 className="font-bold text-lg mb-2">{activeUrgentAlert?.title}</h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {activeUrgentAlert?.message}
            </p>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button onClick={handleDismissUrgentAlert} className="w-full sm:w-auto mt-4 sm:mt-0 gap-2">
              <CheckCircle2 className="w-5 h-5" />
              أقر بأني قرأت التعميم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster position="top-center" />
    </div>
  );
}
