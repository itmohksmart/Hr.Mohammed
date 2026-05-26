import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Megaphone, AlertTriangle, Send } from 'lucide-react';

export default function BroadcastModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!title || !message) {
      toast.error('يرجى تعبئة العنوان والرسالة');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from('notifications').insert({
        target_role: 'all',
        title: title.trim(),
        message: message.trim(),
        type: isUrgent ? 'urgent_broadcast' : 'broadcast',
        is_read: false
      });

      if (error) throw error;

      toast.success('تم إرسال التعميم بنجاح');
      setOpen(false);
      setTitle('');
      setMessage('');
      setIsUrgent(false);
    } catch (err: any) {
      toast.error('حدث خطأ أثناء الإرسال: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children} />
      <DialogContent className="sm:max-w-md font-sans" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Megaphone className="w-5 h-5 text-primary" />
            إرسال إشعار جماعي
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold">عنوان الإشعار</label>
            <Input 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="مثال: ملاحظة بخصوص أوقات الدوام"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-semibold">نص الرسالة</label>
            <textarea 
              value={message} 
              onChange={e => setMessage(e.target.value)} 
              placeholder="اكتب رسالتك للموظفين هنا..."
              rows={4}
              className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300"
            />
          </div>

          <label className="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <input 
              type="checkbox" 
              checked={isUrgent} 
              onChange={e => setIsUrgent(e.target.checked)} 
              className="mt-1 w-4 h-4 text-primary rounded border-slate-300"
            />
            <div>
              <div className="font-semibold text-sm flex items-center gap-2">
                إشعار عاجل <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                سيظهر هذا الإشعار كنافذة منبثقة في منتصف الشاشة ولن يختفي حتى يؤكد الموظف قراءته.
              </p>
            </div>
          </label>
        </div>

        <div className="flex gap-2 justify-end mt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={handleSend} disabled={isLoading || !title || !message} className="gap-2">
            {isLoading ? 'جاري الإرسال...' : 'إرسال للجميع'}
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
