import { supabase } from './supabase';
import { Leave } from '../types';
import { toast } from 'sonner';

export const syncLeaveToAttendance = async (leave: Leave) => {
  try {
    const datesToSync: string[] = [];
    let currentDate = new Date(leave.start_date);
    const endDate = new Date(leave.end_date);
    
    // Generate all dates in range
    while (currentDate <= endDate) {
      datesToSync.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Check existing attendance for these dates
    const { data: existingAttendance } = await supabase
      .from('attendance')
      .select('id, date')
      .eq('employee_id', leave.employee_id)
      .in('date', datesToSync);

    const existingDates = existingAttendance?.map(a => a.date) || [];
    
    let attendanceStatus = 'leave'; // Default to leave (مجاز)
    if (leave.type === 'hourly' || (leave.type === 'other' && leave.reason?.includes('[إجازة زمنية]'))) {
      attendanceStatus = 'time_off';
    } else if (leave.type === 'unpaid') {
      attendanceStatus = 'absent'; // الغياب (بدون راتب)
    } else if (leave.type === 'regular' || leave.type === 'sick') {
      attendanceStatus = 'leave'; // مجاز للإجازة الاعتيادية والمرضية
    }

    // Update existing records
    for (const a of (existingAttendance || [])) {
      await supabase.from('attendance').update({ status: attendanceStatus }).eq('id', a.id);
    }

    // Insert new records for missing dates
    const newDates = datesToSync.filter(d => !existingDates.includes(d));
    if (newDates.length > 0) {
      const inserts = newDates.map(d => ({
        employee_id: leave.employee_id,
        date: d,
        status: attendanceStatus
      }));
      await supabase.from('attendance').insert(inserts);
    }
  } catch (err) {
    console.error('Failed to sync leave to attendance', err);
  }
};

export const processLeaveStatusUpdate = async (leaveId: string, status: 'approved' | 'rejected') => {
  // First, fetch the leave data since we might only have the ID
  const { data: leaveData } = await supabase
    .from('leaves')
    .select('*')
    .eq('id', leaveId)
    .single();

  if (!leaveData) {
    toast.error('لم يتم العثور على الإجازة');
    return false;
  }

  const { error } = await supabase
    .from('leaves')
    .update({ status })
    .eq('id', leaveId);

  if (error) {
    toast.error('خطأ في تحديث الحالة: ' + error.message);
    return false;
  }

  if (status === 'approved') {
    await syncLeaveToAttendance(leaveData);
  }
  
  // Send notification to employee
  if (leaveData.employee_id) {
    try {
      let msg = `تم ${status === 'approved' ? 'قبول' : 'رفض'} طلب الإجازة الخاص بك للفترة من ${leaveData.start_date} إلى ${leaveData.end_date}.`;
      if (leaveData.type === 'hourly' || leaveData.reason?.includes('[إجازة زمنية]')) {
         const timeMatch = leaveData.reason?.match(/\[من (.*?) إلى (.*?)\]/);
         if (timeMatch) {
            msg = `تم ${status === 'approved' ? 'قبول' : 'رفض'} طلب الإجازة الزمنية الخاص بك ليوم ${leaveData.start_date} من الساعة ${timeMatch[1]} إلى الساعة ${timeMatch[2]}.`;
         } else {
            msg = `تم ${status === 'approved' ? 'قبول' : 'رفض'} طلب الإجازة الزمنية الخاص بك ليوم ${leaveData.start_date}.`;
         }
      }

      const { error: notifError } = await supabase.from('notifications').insert({
        employee_id: leaveData.employee_id,
        title: status === 'approved' ? 'تم قبول طلب الإجازة' : 'تم رفض طلب الإجازة',
        message: msg,
        type: status === 'approved' ? 'leave_approved' : 'leave_rejected',
        is_read: false
      });
      
      if (notifError) {
        console.error('Notification insertion error:', notifError);
        toast.error('لم يتم إرسال الإشعار للموظف: ' + notifError.message);
      }
    } catch (e) {
      console.error('Failed to send notification', e);
    }
  }

  toast.success(`تم ${status === 'approved' ? 'قبول' : 'رفض'} الطلب بنجاح`);
  return true;
};
