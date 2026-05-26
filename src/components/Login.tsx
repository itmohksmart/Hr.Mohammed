import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { LogIn, Mail, Lock } from 'lucide-react';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        toast.error('خطأ في إنشاء الحساب: ' + error.message);
      } else {
        toast.success('تم إنشاء الحساب بنجاح! يمكنك الدخول الآن.');
        setIsSignUp(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        toast.error('خطأ في تسجيل الدخول: ' + error.message);
      } else {
        toast.success('تم تسجيل الدخول بنجاح');
      }
    }
    setLoading(false);
  };

  return (
    <Card className="w-full max-w-md border-none shadow-2xl bg-card-bg rounded-xl overflow-hidden">
      <div className="h-1.5 bg-primary w-full" />
      <CardHeader className="space-y-1 pt-10 text-center">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-[#38bdf8] to-[#0284c7] rounded-2xl flex items-center justify-center text-white font-black shadow-xl shadow-sky-500/20 mb-6 transform -rotate-3">
          HR
        </div>
        <CardTitle className="text-3xl font-black text-text-main tracking-tight">
          {isSignUp ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
        </CardTitle>
        <CardDescription className="text-text-muted text-sm mt-3">
          {isSignUp ? (
            <span>أدخل بياناتك للانضمام إلى <span className="text-[#38bdf8] font-bold">HR-Mohammed</span></span>
          ) : (
            <span>أدخل بياناتك للوصول إلى <span className="text-[#38bdf8] font-bold">HR-Mohammed</span></span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8">
        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs text-text-muted">البريد الإلكتروني</Label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <Input 
                id="email" 
                type="email" 
                placeholder="name@company.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pr-10 h-11 rounded-lg border-border focus:ring-primary text-sm"
                required 
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" text-xs text-text-muted>كلمة المرور</Label>
              {!isSignUp && <button type="button" className="text-[11px] text-primary hover:underline">نسيت كلمة المرور؟</button>}
            </div>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10 h-11 rounded-lg border-border focus:ring-primary text-sm"
                required 
              />
            </div>
          </div>
          <Button 
            type="submit" 
            className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-lg text-base font-semibold transition-all mt-2"
            disabled={loading}
          >
            {loading ? 'جاري التحميل...' : (isSignUp ? 'إنشاء حساب' : 'دخول')}
          </Button>
        </form>
        
        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-primary font-medium hover:underline"
          >
            {isSignUp ? 'لديك حساب بالفعل؟ سجل دخولك' : 'ليس لديك حساب؟ أنشئ حساباً جديداً'}
          </button>
        </div>
        
        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-text-muted text-xs">
            هل تواجه مشكلة؟ <button className="text-primary font-medium">اتصل بالدعم الفني</button>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
