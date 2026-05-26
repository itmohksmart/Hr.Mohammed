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
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Shift } from '../types';
import { toast } from 'sonner';
import { 
  Clock, 
  Plus, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  Calendar,
  Timer
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const DAYS = [
  { id: 0, label: 'الأحد' },
  { id: 1, label: 'الاثنين' },
  { id: 2, label: 'الثلاثاء' },
  { id: 3, label: 'الأربعاء' },
  { id: 4, label: 'الخميس' },
  { id: 5, label: 'الجمعة' },
  { id: 6, label: 'السبت' },
];

export default function Shifts() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  
  const [newShift, setNewShift] = useState<Partial<Shift>>({
    name: '',
    start_time: '08:00',
    end_time: '16:00',
    check_in_grace: 15,
    check_out_grace: 15,
    work_days: [0, 1, 2, 3, 4, 6] // Default Sat-Thu (Friday off)
  });

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<Shift | null>(null);

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setShifts(data);
    setLoading(false);
  };

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from('shifts')
      .insert([newShift]);

    if (error) {
      toast.error('خطأ في إضافة الوردية: ' + error.message);
    } else {
      toast.success('تم إضافة الوردية بنجاح');
      setIsAddOpen(false);
      fetchShifts();
      setNewShift({
        name: '',
        start_time: '08:00',
        end_time: '16:00',
        check_in_grace: 15,
        check_out_grace: 15,
        work_days: [0, 1, 2, 3, 4, 6]
      });
    }
  };

  const handleEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setNewShift(shift);
    setIsEditOpen(true);
  };

  const handleUpdateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShift) return;

    const { error } = await supabase
      .from('shifts')
      .update(newShift)
      .eq('id', editingShift.id);

    if (error) {
      toast.error('خطأ في تحديث الوردية: ' + error.message);
    } else {
      toast.success('تم تحديث الوردية بنجاح');
      setIsEditOpen(false);
      setEditingShift(null);
      fetchShifts();
    }
  };

  const handleDeleteShift = (shift: Shift) => {
    setShiftToDelete(shift);
    setIsDeleteOpen(true);
  };

  const confirmDeleteShift = async () => {
    if (!shiftToDelete) return;

    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('id', shiftToDelete.id);

    if (error) {
      toast.error('خطأ في حذف الوردية: ' + error.message);
    } else {
      toast.success('تم حذف الوردية بنجاح');
      fetchShifts();
    }
    setIsDeleteOpen(false);
    setShiftToDelete(null);
  };

  const toggleDay = (dayId: number) => {
    setNewShift(prev => {
      const current = prev.work_days || [];
      if (current.includes(dayId)) {
        return { ...prev, work_days: current.filter(id => id !== dayId) };
      } else {
        return { ...prev, work_days: [...current, dayId].sort() };
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">إدارة الورديات</h2>
          <p className="text-sm text-slate-500">تحديد أوقات الدوام الرسمية والسماحيات</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger render={<Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 shadow-sm" />}>
            <Plus size={18} className="ml-2" />
            إضافة وردية جديدة
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">إضافة وردية جديدة</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddShift} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label>اسم الوردية</Label>
                <Input 
                  value={newShift.name}
                  onChange={e => setNewShift({...newShift, name: e.target.value})}
                  placeholder="مثلاً: الوردية الصباحية"
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>وقت الدخول</Label>
                  <Input 
                    type="time"
                    value={newShift.start_time}
                    onChange={e => setNewShift({...newShift, start_time: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>وقت الانصراف</Label>
                  <Input 
                    type="time"
                    value={newShift.end_time}
                    onChange={e => setNewShift({...newShift, end_time: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>سماحية الحضور (دقيقة)</Label>
                  <Input 
                    type="number"
                    value={newShift.check_in_grace}
                    onChange={e => setNewShift({...newShift, check_in_grace: parseInt(e.target.value)})}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>سماحية الانصراف (دقيقة)</Label>
                  <Input 
                    type="number"
                    value={newShift.check_out_grace}
                    onChange={e => setNewShift({...newShift, check_out_grace: parseInt(e.target.value)})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>أيام العمل</Label>
                <div className="grid grid-cols-4 gap-2">
                  {DAYS.map(day => (
                    <div key={day.id} className="flex items-center gap-2">
                      <input 
                        type="checkbox"
                        id={`day-${day.id}`} 
                        checked={newShift.work_days?.includes(day.id)}
                        onChange={() => toggleDay(day.id)}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                      <label htmlFor={`day-${day.id}`} className="text-xs">{day.label}</label>
                    </div>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11 rounded-xl font-bold">حفظ الوردية</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shifts.map(shift => (
          <div key={shift.id} className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
            
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
                  <Clock size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">{shift.name}</h3>
                  <Badge variant="outline" className="text-[10px] mt-1 bg-slate-50 dark:bg-slate-800">
                    {shift.work_days.length} أيام في الأسبوع
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => handleEditShift(shift)}>
                  <Edit2 size={16} />
                </Button>
                <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteShift(shift)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                <span className="text-[10px] text-slate-400 block mb-1">وقت الحضور</span>
                <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{shift.start_time}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                <span className="text-[10px] text-slate-400 block mb-1">وقت الانصراف</span>
                <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{shift.end_time}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-500">
                  <Timer size={14} />
                  <span>سماحية الحضور</span>
                </div>
                <span className="font-bold text-blue-600">{shift.check_in_grace} دقيقة</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-500">
                  <Timer size={14} />
                  <span>سماحية الانصراف</span>
                </div>
                <span className="font-bold text-indigo-600">{shift.check_out_grace} دقيقة</span>
              </div>
              
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap gap-1">
                  {DAYS.map(day => (
                    <span 
                      key={day.id} 
                      className={`text-[9px] w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                        shift.work_days.includes(day.id) 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                      title={day.label}
                    >
                      {day.label[0]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {shifts.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar size={40} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">لا توجد ورديات حالياً</h3>
            <p className="text-slate-500 mt-2">ابدأ بإضافة وردية العمل الأولى لموظفيك</p>
          </div>
        )}
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">تعديل الوردية</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateShift} className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label>اسم الوردية</Label>
              <Input 
                value={newShift.name}
                onChange={e => setNewShift({...newShift, name: e.target.value})}
                required
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>وقت الدخول</Label>
                <Input 
                  type="time"
                  value={newShift.start_time}
                  onChange={e => setNewShift({...newShift, start_time: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>وقت الانصراف</Label>
                <Input 
                  type="time"
                  value={newShift.end_time}
                  onChange={e => setNewShift({...newShift, end_time: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>سماحية الحضور (دقيقة)</Label>
                <Input 
                  type="number"
                  value={newShift.check_in_grace}
                  onChange={e => setNewShift({...newShift, check_in_grace: parseInt(e.target.value)})}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>سماحية الانصراف (دقيقة)</Label>
                <Input 
                  type="number"
                  value={newShift.check_out_grace}
                  onChange={e => setNewShift({...newShift, check_out_grace: parseInt(e.target.value)})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>أيام العمل</Label>
              <div className="grid grid-cols-4 gap-2">
                {DAYS.map(day => (
                  <div key={day.id} className="flex items-center gap-2">
                    <input 
                      type="checkbox"
                      id={`edit-day-${day.id}`} 
                      checked={newShift.work_days?.includes(day.id)}
                      onChange={() => toggleDay(day.id)}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <label htmlFor={`edit-day-${day.id}`} className="text-xs">{day.label}</label>
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11 rounded-xl font-bold">تحديث الوردية</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600">تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <p className="text-slate-700 dark:text-slate-300">
              هل أنت متأكد من حذف الوردية <span className="font-bold text-slate-900 dark:text-slate-100">"{shiftToDelete?.name}"</span>؟ لا يمكن التراجع عن هذا الإجراء وسيؤثر هذا على إعدادات الموظفين المرتبطين بها.
            </p>
          </div>
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="rounded-xl h-10 w-24">
              إلغاء
            </Button>
            <Button variant="destructive" onClick={confirmDeleteShift} className="rounded-xl h-10 w-24 bg-red-600 hover:bg-red-700">
              حذف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
