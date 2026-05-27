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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Shield, ShieldCheck, User, Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface UserWithRole {
  id: string;
  email: string;
  role: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      console.log('Fetching users from /api/admin/list-users...');
      const response = await fetch('/api/admin/list-users');
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server responded with error:', response.status, errorText);
        throw new Error(`Server error (${response.status}): ${errorText || 'Unknown error'}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error('static_html_served');
      }

      const data = await response.json();
      setUsers(data);
    } catch (error: any) {
      console.error('Fetch error details:', {
        message: error.message,
        stack: error.stack,
        type: error.constructor.name
      });
      if (error.message === 'static_html_served' || error.message.includes('Unexpected token') || error.message.includes('JSON')) {
         toast.error(
           'رابط Cloudflare يستضيف الملفات الثابتة فقط (Vite static SPA) ولا يقوم بتشغيل خادم Node.js (الباك إند). لإدارة المستخدمين وصلاحياتهم بشكل كامل، يرجى استخدام رابط المعاينة المباشر للتطبيق، أو إعداد الحسابات مباشرة من لوحة تحكم Supabase.',
           { duration: 10000 }
         );
      } else if (error.message === 'Failed to fetch') {
         toast.error('لم نتمكن من الاتصال بالخادم. تأكد من تشغيل الخادم بشكل صحيح (server.ts).');
      } else {
         toast.error('خطأ في جلب بيانات المستخدمين: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({ 
          user_id: userId, 
          role: newRole 
        }, { onConflict: 'user_id' });

      if (error) throw error;
      
      toast.success('تم تحديث الصلاحية بنجاح');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (error: any) {
      toast.error('خطأ في التحديث: ' + error.message);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold">إدارة صلاحيات المستخدمين</CardTitle>
              <CardDescription>تحديد مستوى الوصول لكل مستخدم في النظام</CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={fetchUsers} disabled={loading}>
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-6">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input 
              placeholder="البحث عن طريق البريد الإلكتروني..." 
              className="pr-10 rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow>
                  <TableHead className="text-right">المستخدم</TableHead>
                  <TableHead className="text-right">الصلاحية الحالية</TableHead>
                  <TableHead className="text-right">تعديل الصلاحية</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-slate-400">جاري التحميل...</TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-slate-400">لا يوجد مستخدمين</TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                            <User size={20} className="text-slate-500" />
                          </div>
                          <span className="font-medium">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.role === 'admin' ? (
                            <ShieldCheck size={16} className="text-red-500" />
                          ) : user.role === 'hr' ? (
                            <Shield size={16} className="text-blue-500" />
                          ) : user.role === 'sector_manager' ? (
                            <Shield size={16} className="text-purple-500" />
                          ) : (
                            <User size={16} className="text-slate-400" />
                          )}
                          <span className={`text-xs font-bold ${
                            user.role === 'admin' ? 'text-red-500' : 
                            user.role === 'hr' ? 'text-blue-500' : 
                            user.role === 'sector_manager' ? 'text-purple-500' : 'text-slate-500'
                          }`}>
                            {user.role === 'admin' ? 'مسؤول نظام' : 
                             user.role === 'hr' ? 'مسؤول HR' : 
                             user.role === 'sector_manager' ? 'إدارة القطاع' : 'موظف'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={user.role} 
                          onValueChange={(val) => handleUpdateRole(user.id, val)}
                        >
                          <SelectTrigger className="w-40 h-9 rounded-lg text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">مسؤول نظام</SelectItem>
                            <SelectItem value="hr">مسؤول HR</SelectItem>
                            <SelectItem value="sector_manager">إدارة القطاع</SelectItem>
                            <SelectItem value="employee">موظف</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
