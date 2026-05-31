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
import { Badge } from '@/components/ui/badge';
import { Payroll as PayrollType, Employee, Location, Shift } from '../types';
import { toast } from 'sonner';
import { getSystemSettings } from '../services/settingsService';
import { 
  CreditCard, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Search,
  Printer,
  MapPin,
  Edit2,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Clock
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import * as xlsx from 'xlsx';

import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function Payroll() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [payroll, setPayroll] = useState<PayrollType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [editingPayroll, setEditingPayroll] = useState<PayrollType | null>(null);
  const [editBonuses, setEditBonuses] = useState(0);
  const [editDeductions, setEditDeductions] = useState(0);

  useEffect(() => {
    fetchData();
    fetchUserRole();
  }, [selectedMonth, selectedYear]);

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

    let empQuery = supabase.from('employees').select('*').eq('status', 'active');
    let payQuery = supabase
      .from('payroll')
      .select('*, employee:employees!inner(*)')
      .eq('month', selectedMonth)
      .eq('year', selectedYear)
      .neq('employee.status', 'probation');

    if (!isHRorAdmin) {
      const { data: currentUserEmp } = await supabase
        .from('employees')
        .select('id')
        .eq('email', session.user.email)
        .single();
      
      if (currentUserEmp) {
        empQuery = empQuery.eq('id', currentUserEmp.id);
        payQuery = payQuery.eq('employee_id', currentUserEmp.id);
      }
    }

    const { data: empData } = await empQuery;
    const { data: payData } = await payQuery;
    const { data: locData } = await supabase.from('locations').select('*');
    const { data: shiftData } = await supabase.from('shifts').select('*');

    if (empData) {
      const mappedEmployees = empData.map(emp => ({
        ...emp,
        name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
      }));
      setEmployees(mappedEmployees);
    }
    if (payData) {
      const mappedPayroll = payData.map(pay => ({
        ...pay,
        employee: pay.employee ? {
          ...pay.employee,
          name: pay.employee.name || `${pay.employee.first_name || ''} ${pay.employee.last_name || ''}`.trim()
        } : undefined
      }));
      setPayroll(mappedPayroll);
    }
    if (locData) setLocations(locData);
    if (shiftData) setShifts(shiftData);
    setLoading(false);
  };

  const generatePayroll = async () => {
    setLoading(true);
    
    // Fetch system settings for policies
    const settings = await getSystemSettings();
    const isAutoAbsenceEnabled = settings.autoAbsenceDeduction;
    const isAutoHourEnabled = settings.autoHourDeduction;

    // Get start and end date of the selected month
    const startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    const endDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${lastDay}`;

    // Fetch all attendance for the selected month to apply policies
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('*, employee:employees(shift_id)')
      .gte('date', startDate)
      .lte('date', endDate);

    // Group deductions by employee
    const totalDeductions: Record<string, number> = {};
    const deductionReasons: Record<string, { reason: string; amount: number; days: string[] }[]> = {};
    const shiftsData = shifts; 
    
    employees.forEach(emp => {
      const empAttendance = attendanceData?.filter(a => a.employee_id === emp.id) || [];
      const dailyRate = emp.salary / lastDay;
      const hourlyRate = dailyRate / 8; 
      
      let empDeductionTotal = 0;
      let reasons: { reason: string; amount: number; days: string[] }[] = [];

      // Joined date prorated deduction
      if (emp.hire_date) {
        const hireDate = new Date(emp.hire_date);
        const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
        
        // If they joined after the start of this payroll month
        if (hireDate > monthStart && hireDate.getMonth() + 1 === selectedMonth && hireDate.getFullYear() === selectedYear) {
          const daysBeforeJoining = hireDate.getDate() - 1;
          if (daysBeforeJoining > 0) {
            const amount = daysBeforeJoining * dailyRate;
            empDeductionTotal += amount;
            
            const missedDays: string[] = [];
            for (let i = 1; i <= daysBeforeJoining; i++) {
              missedDays.push(`${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`);
            }

            reasons.push({
              reason: 'مباشرة خلال الشهر (أيام ما قبل المباشرة)',
              amount: Math.round(amount),
              days: missedDays
            });
          }
        }
      }

      // 1. Absent days (Full daily rate deduction)
      const absentDays = empAttendance.filter(r => r.status === 'absent');
      const fullyPenalizedDates = new Set<string>();

      if (absentDays.length > 0 && isAutoAbsenceEnabled) {
        const amount = absentDays.length * dailyRate;
        empDeductionTotal += amount;
        absentDays.forEach(r => fullyPenalizedDates.add(r.date));
        
        reasons.push({
          reason: 'غياب كامل',
          amount: Math.round(amount),
          days: absentDays.map(r => r.date)
        });
      }

      // 2. Missing checkout/checkin (Special Policy Deduction)
      const missingRecords = empAttendance.filter(r => {
        // Pre-filtered: ignore if already marked as absent
        if (fullyPenalizedDates.has(r.date)) return false;

        // Explicit statuses
        if (r.status === 'missing_checkout' || r.status === 'missing_checkin') return true;
        
        // Dynamic detection: if past day and one side is missing
        const isPast = r.date < new Date().toISOString().split('T')[0];
        if (isPast) {
          if (r.check_in && !r.check_out && (r.status === 'present' || r.status === 'late')) return true;
          if (!r.check_in && r.check_out && (r.status === 'present' || r.status === 'late')) return true;
        }
        
        return false;
      });

      if (isAutoHourEnabled) {
        // Process Missing Records FIRST to identify dates that become "Absence equivalent"
        missingRecords.forEach(record => {
          const isCheckout = record.status === 'missing_checkout' || (record.check_in && !record.check_out);
          const policy = isCheckout ? settings.missingCheckoutPolicy : settings.missingCheckinPolicy;
          const dedHours = isCheckout ? settings.missingCheckoutDeductionHours : settings.missingCheckinDeductionHours;
          const reasonPrefix = isCheckout ? 'نسيان بصمة انصراف' : 'نسيان بصمة حضور';

          let amount = 0;
          let reasonLabel = '';

          if (policy === 'deduct_hours') {
            amount = dedHours * hourlyRate;
            reasonLabel = `${reasonPrefix} (خصم ${dedHours} ساعة)`;
          } else if (policy === 'half_day') {
            amount = dailyRate / 2;
            reasonLabel = `${reasonPrefix} (خصم نصف يوم)`;
            fullyPenalizedDates.add(record.date); // Mark as penalized to avoid minute-based double-dip
          } else if (policy === 'full_absence') {
            amount = dailyRate;
            reasonLabel = `${reasonPrefix} (خصم يوم كامل)`;
            fullyPenalizedDates.add(record.date); // Mark as fully penalized
          }

          if (amount > 0) {
            empDeductionTotal += amount;
            const existingReason = reasons.find(r => r.reason === reasonLabel);
            if (existingReason) {
              existingReason.amount += Math.round(amount);
              existingReason.days.push(record.date);
            } else {
              reasons.push({
                reason: reasonLabel,
                amount: Math.round(amount),
                days: [record.date]
              });
            }
          }
        });

        // 3. Late calculation (Minute-based)
        // Skip dates already handled by "Full Absence" or "Half Day" missing punch policies
        const lateRecords = empAttendance.filter(r => 
          r.status === 'late' && 
          r.late_minutes && 
          r.late_minutes > 0 &&
          !fullyPenalizedDates.has(r.date)
        );
        
        let totalLateMinutes = 0;
        let lateDates: string[] = [];
        
        lateRecords.forEach(record => {
          totalLateMinutes += (record.late_minutes || 0);
          lateDates.push(record.date);
        });

        if (totalLateMinutes > 0) {
          const lateHours = totalLateMinutes / 60;
          const lateAmount = Math.ceil(lateHours * hourlyRate);
          
          if (lateAmount > 0) {
            empDeductionTotal += lateAmount;
            reasons.push({
              reason: `تأخير فعال (${Math.round(totalLateMinutes)} دقيقة)`,
              amount: lateAmount,
              days: lateDates
            });
          }
        }

        // 4. Early Exit calculation (Minute-based)
        const earlyExitRecords = empAttendance.filter(r => 
          r.early_exit_minutes && 
          r.early_exit_minutes > 0 &&
          !fullyPenalizedDates.has(r.date)
        );
        
        let totalEarlyExitMinutes = 0;
        let earlyExitDates: string[] = [];
        
        earlyExitRecords.forEach(record => {
          totalEarlyExitMinutes += (record.early_exit_minutes || 0);
          earlyExitDates.push(record.date);
        });

        if (totalEarlyExitMinutes > 0) {
          const earlyExitHours = totalEarlyExitMinutes / 60;
          const earlyExitAmount = Math.ceil(earlyExitHours * hourlyRate);
          
          if (earlyExitAmount > 0) {
            empDeductionTotal += earlyExitAmount;
            reasons.push({
              reason: `انصراف مبكر (${Math.round(totalEarlyExitMinutes)} دقيقة)`,
              amount: earlyExitAmount,
              days: earlyExitDates
            });
          }
        }
      }


      totalDeductions[emp.id] = Math.round(empDeductionTotal);
      deductionReasons[emp.id] = reasons;
    });

    const payrollEntries = employees.map(emp => {
      const deductions = totalDeductions[emp.id] || 0;
      const reasons = deductionReasons[emp.id] || [];
      
      return {
        employee_id: emp.id,
        month: selectedMonth,
        year: selectedYear,
        base_salary: emp.salary,
        bonuses: 0,
        deductions: deductions,
        deduction_reasons: reasons,
        net_salary: emp.salary - deductions,
        status: 'pending'
      };
    });

    const { error } = await supabase
      .from('payroll')
      .upsert(payrollEntries, { onConflict: 'employee_id,month,year' });

    if (error && (error.message.includes('column "deduction_reasons" does not exist') || error.message.includes('deduction_reasons') || error.code === '42703')) {
      const strippedEntries = payrollEntries.map(({ deduction_reasons, ...rest }: any) => rest);
      const { error: retryError } = await supabase
        .from('payroll')
        .upsert(strippedEntries, { onConflict: 'employee_id,month,year' });
      
      if (retryError) {
        toast.error('خطأ في إنشاء الرواتب: ' + retryError.message);
      } else {
        toast.success('تم إنشاء سجلات الرواتب (بدون تفاصيل الاستقطاع - يرجى تحديث قاعدة البيانات)');
        fetchData();
      }
    } else if (error) {
      toast.error('خطأ في إنشاء الرواتب: ' + error.message);
    } else {
      toast.success('تم إنشاء سجلات الرواتب مع احتساب الغيابات تلقائياً');
      fetchData();
    }
    setLoading(false);
  };

  const handleMarkAsPaid = async (payrollId: string) => {
    const { error } = await supabase
      .from('payroll')
      .update({ status: 'paid' })
      .eq('id', payrollId);

    if (error) {
      toast.error('خطأ في تحديث الحالة: ' + error.message);
    } else {
      toast.success('تم تحديث حالة الراتب بنجاح');
      fetchData();
    }
  };

  const handleSaveEdits = async () => {
    if (!editingPayroll) return;
    
    // Calculate new net salary
    const netSalary = editingPayroll.base_salary + editBonuses - editDeductions;
    
    const { error } = await supabase
      .from('payroll')
      .update({ 
        bonuses: editBonuses,
        deductions: editDeductions,
        net_salary: netSalary
      })
      .eq('id', editingPayroll.id);

    if (error) {
      toast.error('خطأ في حفظ التعديلات: ' + error.message);
    } else {
      toast.success('تم حفظ التعديلات بنجاح');
      setEditingPayroll(null);
      fetchData();
    }
  };

  const handlePrint = () => {
    const printStyles = `
      @media print {
        body * { visibility: hidden; }
        .print-section, .print-section * { visibility: visible; }
        .print-section { 
          position: absolute; 
          left: 0; 
          top: 0; 
          width: 100%; 
          padding: 20px;
        }
        .no-print { display: none !important; }
        .print-only { display: block !important; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
        th { background-color: #f2f2f2; }
      }
    `;
    const styleSheet = document.createElement("style");
    styleSheet.innerText = printStyles;
    document.head.appendChild(styleSheet);
    window.print();
    document.head.removeChild(styleSheet);
  };

  const exportToExcel = async () => {
    if (filteredPayroll.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }
    
    setLoading(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const { saveAs } = (await import('file-saver')).default || await import('file-saver');

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(`رواتب ${selectedMonth}-${selectedYear}`, {
        views: [{ rightToLeft: true }]
      });

      // --- Setup Columns ---
      // A to W is 23 columns
      sheet.columns = [
        { key: 'A', width: 6 },  // الرقم
        { key: 'B', width: 12 }, // الاسم
        { key: 'C', width: 12 }, // الاب
        { key: 'D', width: 12 }, // الجد
        { key: 'E', width: 12 }, // اللقب
        { key: 'F', width: 18 }, // الوظيفة
        { key: 'G', width: 8 },  // الفئة
        { key: 'H', width: 18 }, // الراتب الاسمي
        { key: 'I', width: 8 },  // غياب
        { key: 'J', width: 8 },  // تأخير
        { key: 'K', width: 8 },  // اضافي
        { key: 'L', width: 8 },  // فرق
        { key: 'M', width: 8 },  // استمرار
        { key: 'N', width: 12 }, // مكافئة
        { key: 'O', width: 12 }, // سلف
        { key: 'P', width: 8 },  // مشاركة
        { key: 'Q', width: 12 }, // استقطاع
        { key: 'R', width: 12 }, // مبالغ اخرى
        { key: 'S', width: 18 }, // الاستحقاق
        { key: 'T', width: 10 }, // ملاحظات
        { key: 'U', width: 10 }, // ملاحظات
        { key: 'V', width: 10 }, // ملاحظات
        { key: 'W', width: 15 }, // التوقيع
      ];

      // --- Custom Styling & Header Rows ---
      const totalSalaries = filteredPayroll.reduce((sum, p) => sum + p.base_salary, 0);

      // Row 1 & 2 & 3: Header Area
      sheet.mergeCells('H1:W3');
      const titleCell = sheet.getCell('H1');
      titleCell.value = 'جدول رواتب الموظفين (دينار)';
      titleCell.font = { name: 'Arial', size: 24, bold: true, color: { argb: 'FFFF0000' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };

      sheet.mergeCells('B1:G1');
      sheet.getCell('B1').value = 'Project:';
      sheet.getCell('B1').font = { size: 16, bold: true };
      sheet.getCell('B1').alignment = { vertical: 'middle', horizontal: 'right' };
      sheet.getCell('B1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } };

      sheet.mergeCells('B2:G3');
      sheet.getCell('B2').value = '0'; // placeholder logic
      sheet.getCell('B2').font = { size: 14, bold: true };
      sheet.getCell('B2').alignment = { vertical: 'middle', horizontal: 'center' };

      // Row 4 & 5: Summary Info
      sheet.mergeCells('B4:H4');
      sheet.getCell('B4').value = 'المبلغ الكلي (دينار):';
      sheet.getCell('B4').alignment = { horizontal: 'center' };
      sheet.getCell('B4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };

      sheet.mergeCells('B5:H5');
      sheet.getCell('B5').value = totalSalaries.toLocaleString();
      sheet.getCell('B5').font = { size: 14, bold: true };
      sheet.getCell('B5').alignment = { horizontal: 'center' };

      sheet.mergeCells('I4:L4');
      sheet.getCell('I4').value = 'عدد الافراد';
      sheet.getCell('I4').alignment = { horizontal: 'center' };
      sheet.getCell('I4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };

      sheet.mergeCells('I5:L5');
      sheet.getCell('I5').value = filteredPayroll.length;
      sheet.getCell('I5').font = { size: 12, bold: true };
      sheet.getCell('I5').alignment = { horizontal: 'center' };

      // Month/Year
      sheet.mergeCells('M4:O4');
      sheet.getCell('M4').value = 'الشهر والسنة';
      sheet.getCell('M4').alignment = { horizontal: 'center' };
      sheet.getCell('M4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };

      sheet.getCell('M5').value = selectedYear;
      sheet.getCell('M5').alignment = { horizontal: 'center' };
      sheet.getCell('M5').font = { color: { argb: 'FFFF0000' }, bold: true };
      
      sheet.getCell('N5').value = selectedMonth;
      sheet.getCell('N5').alignment = { horizontal: 'center' };
      sheet.getCell('N5').font = { color: { argb: 'FFFF0000' }, bold: true };
      
      sheet.getCell('O5').value = months.find(m => m.value === selectedMonth)?.label || '';
      sheet.getCell('O5').alignment = { horizontal: 'center' };
      sheet.getCell('O5').font = { color: { argb: 'FFFF0000' }, bold: true };

      sheet.mergeCells('P4:Q4');
      sheet.getCell('P4').value = 'اسم الفئة / Group';
      sheet.getCell('P4').alignment = { horizontal: 'center' };
      sheet.getCell('P4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };

      sheet.mergeCells('P5:Q5');
      sheet.getCell('P5').value = 'D'; // Dummy or generic Group
      sheet.getCell('P5').alignment = { horizontal: 'center' };
      sheet.getCell('P5').font = { bold: true };

      // Date section
      sheet.mergeCells('R4:W5');
      sheet.getCell('R4').value = new Date().toLocaleString('en-US');
      sheet.getCell('R4').alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.getCell('R4').font = { bold: true };
      sheet.getCell('R4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC9DAF8' } };

      // --- Main Table Headers (Row 6) ---
      const headerRow1 = sheet.getRow(6);
      headerRow1.height = 20;
      sheet.mergeCells('A6:E6');
      sheet.getCell('A6').value = 'المعلومات الشخصية';
      sheet.mergeCells('F6:G6');
      sheet.getCell('F6').value = 'معلومات الوظيفة';
      sheet.mergeCells('I6:L6');
      sheet.getCell('I6').value = 'الموقف الحضوري';

      const headerRow2 = sheet.getRow(7);
      headerRow2.height = 20;
      sheet.mergeCells('A7:A8'); // الرقم extends down
      sheet.getCell('A7').value = 'الرقم';

      sheet.mergeCells('B7:E7');
      sheet.getCell('B7').value = 'الاسم';
      sheet.getCell('B8').value = 'الاسم';
      sheet.getCell('C8').value = 'الاب';
      sheet.getCell('D8').value = 'الجد';
      sheet.getCell('E8').value = 'اللقب';

      sheet.mergeCells('F7:F8');
      sheet.getCell('F7').value = 'الوظيفة الحالية';

      sheet.mergeCells('G7:G8');
      sheet.getCell('G7').value = 'الفئة Group';

      sheet.mergeCells('H6:H8');
      sheet.getCell('H6').value = 'الراتب الاسمي (دينار)';

      sheet.getCell('I7').value = 'ع ايام غياب';
      sheet.getCell('I8').value = '';
      sheet.getCell('J7').value = 'ع س تاخير';
      sheet.getCell('J8').value = '';
      sheet.getCell('K7').value = 'ع س اضافية';
      sheet.getCell('K8').value = '';
      sheet.getCell('L7').value = 'فرق ايام';
      sheet.getCell('L8').value = '';

      sheet.mergeCells('M6:M8');
      sheet.getCell('M6').value = 'الاستمرار';

      sheet.mergeCells('N6:N8');
      sheet.getCell('N6').value = 'مكافئة حسن الاداء (دينار)';

      sheet.mergeCells('O6:O8');
      sheet.getCell('O6').value = 'سلف (دينار)';

      sheet.mergeCells('P6:P8');
      sheet.getCell('P6').value = 'مشاركة';

      sheet.mergeCells('Q6:Q8');
      sheet.getCell('Q6').value = 'استقطاع';

      sheet.mergeCells('R6:R8');
      sheet.getCell('R6').value = 'مبالغ اخرى (دينار) + -';

      sheet.mergeCells('S6:S8');
      sheet.getCell('S6').value = 'مبلغ الاستحقاق (دينار)';

      sheet.mergeCells('T6:V8');
      sheet.getCell('T6').value = 'ملاحظات عامة';

      sheet.mergeCells('W6:W8');
      sheet.getCell('W6').value = 'التوقيع';

      // Style header cells
      for (let i = 6; i <= 8; i++) {
        const row = sheet.getRow(i);
        row.eachCell((cell) => {
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE5CD' } };
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
          };
        });
      }
      
      // Some specialized header colors
      sheet.getCell('H6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4CCCC' } }; // light red
      sheet.getCell('S6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4CCCC' } }; // light red

      // Add borders to summary cells
      ['B4','B5','I4','I5','M4','M5','N5','O5','P4','P5','R4'].forEach(address => {
         sheet.getCell(address).border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
         };
      });

      // --- Data Rows ---
      let currentRowIndex = 9;
      filteredPayroll.forEach((pay, index) => {
        const nameParts = (pay.employee?.name || '').split(' ');
        const w1 = nameParts[0] || '';
        const w2 = nameParts[1] || '';
        const w3 = nameParts[2] || '';
        const w4 = nameParts.slice(3).join(' ') || '**';

        const reasonsStr = pay.deduction_reasons?.map(r => `${r.reason}: ${r.amount}`).join(' | ') || '';

        const row = sheet.addRow([
          index + 1,        // A الرقم
          w1,               // B الاسم
          w2,               // C الاب
          w3,               // D الجد
          w4,               // E اللقب
          pay.employee?.department || '', // F الوظيفة
          '**',             // G الفئة
          pay.base_salary,  // H الراتب الاسمي
          0,                // I غياب (يمكن حسابها من الأسباب)
          0,                // J تاخير
          0,                // K اضافي
          0,                // L فرق ايام
          1,                // M استمرار
          pay.bonuses || 0, // N مكافئة
          0,                // O سلف
          0,                // P مشاركة
          pay.deductions || 0, // Q استقطاع
          0,                // R مبالغ اخرى
          pay.net_salary,   // S الاستحقاق
          reasonsStr,       // T ملاحظات 
          '',               // U 
          '',               // V
          ''                // W التوقيع
        ]);

        // merge notes columns
        sheet.mergeCells(`T${currentRowIndex}:V${currentRowIndex}`);

        row.eachCell((cell, colNumber) => {
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
          };
          
          // Color text based on columns like in the image
          if (colNumber === 8 || colNumber === 19) { // Base salary & Net Salary -> bold
            cell.font = { bold: true };
          }
          if (colNumber >= 14 && colNumber <= 18) { // deductions/bonuses red
             if (colNumber === 14 || colNumber === 17) { // مكافئة, استقطاع
                cell.font = { color: { argb: 'FFFF0000' }, bold: true };
             }
          }
          if (colNumber === 13) { // استمرار green
            cell.font = { color: { argb: 'FF00B050' }, bold: true };
          }
        });
        
        row.height = 25;
        currentRowIndex++;
      });

      // Save File
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `payroll_${selectedYear}_${selectedMonth}.xlsx`);
      
      toast.success('تم تصدير الرواتب بنجاح');
    } catch (error) {
      console.error('Error exporting payroll:', error);
      toast.error('حدث خطأ أثناء التصدير');
    } finally {
      setLoading(false);
    }
  };

  const months = [
    { value: 1, label: 'يناير' }, { value: 2, label: 'فبراير' }, { value: 3, label: 'مارس' },
    { value: 4, label: 'أبريل' }, { value: 5, label: 'مايو' }, { value: 6, label: 'يونيو' },
    { value: 7, label: 'يوليو' }, { value: 8, label: 'أغسطس' }, { value: 9, label: 'سبتمبر' },
    { value: 10, label: 'أكتوبر' }, { value: 11, label: 'نوفمبر' }, { value: 12, label: 'ديسمبر' }
  ];

  const filteredPayroll = payroll.filter(p => {
    const emp = p.employee;
    if (!emp) return false;
    const matchesSearch = (emp.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLocation = locationFilter === 'all' || emp.location_id === locationFilter;
    return matchesSearch && matchesLocation;
  });

  const getAvatarGradient = (name: string) => {
    const gradients = [
      'bg-gradient-to-br from-indigo-500 to-purple-600',
      'bg-gradient-to-br from-blue-500 to-cyan-500',
      'bg-gradient-to-br from-emerald-400 to-teal-500',
      'bg-gradient-to-br from-rose-400 to-red-500',
      'bg-gradient-to-br from-amber-400 to-orange-500',
      'bg-gradient-to-br from-fuchsia-500 to-pink-600',
    ];
    const charCode = name ? name.charCodeAt(0) : 0;
    return gradients[charCode % gradients.length];
  };

  const isAdmin = userRole === 'admin';
  const isHR = userRole === 'hr';

  // Calculate Summary metrics
  const totalPayroll = filteredPayroll.reduce((acc, pay) => acc + (pay.net_salary || 0), 0);
  const totalPaid = filteredPayroll.filter(p => p.status === 'paid').reduce((acc, pay) => acc + (pay.net_salary || 0), 0);
  const totalPending = totalPayroll - totalPaid;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-2xl">
            {(isAdmin || isHR) && (
              <>
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    placeholder="بحث عن موظف..." 
                    className="pr-10 rounded-lg h-10 text-sm border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 w-full" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="w-full sm:w-48 rounded-lg h-10 text-sm border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                    <SelectValue placeholder="تصفية حسب الموقع">
                      {locationFilter === 'all' 
                        ? 'جميع المواقع' 
                        : (locations.find(l => String(l.id) === String(locationFilter))?.name || 'جاري التحميل...')
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المواقع</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
            {(isAdmin || isHR) && (
              <Button 
                onClick={exportToExcel}
                variant="outline" 
                className="rounded-lg h-10 text-xs md:text-sm border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 w-full sm:w-auto"
                disabled={loading || filteredPayroll.length === 0}
              >
                <Download size={16} className="ml-2" />
                تصدير Excel
              </Button>
            )}
            {(isAdmin || isHR) && (
              <Button 
                onClick={handlePrint}
                variant="outline" 
                className="rounded-lg h-10 text-xs md:text-sm border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 w-full sm:w-auto"
              >
                <Printer size={16} className="ml-2" />
                طباعة الكل
              </Button>
            )}
            {(isAdmin || isHR) && (
              <Button onClick={generatePayroll} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-10 text-xs md:text-sm shadow-sm w-full sm:w-auto" disabled={loading}>
                <CreditCard size={16} className="ml-2" />
                إنشاء مسودة الرواتب
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 md:gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Select value={selectedMonth.toString()} onValueChange={v => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-[110px] md:w-32 rounded-lg h-9 text-xs md:text-sm border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              <SelectValue placeholder="الشهر" />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[90px] md:w-32 rounded-lg h-9 text-xs md:text-sm border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
              <SelectValue placeholder="السنة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="rounded-lg h-9 w-9 p-0 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0" onClick={fetchData}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-5 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium font-bold block mb-1">{(isAdmin || isHR) ? 'إجمالي الرواتب' : 'الراتب المستحق'}</p>
            <h4 className="text-xl font-black text-slate-900 dark:text-slate-100">{totalPayroll.toLocaleString()} <span className="text-xs text-slate-500">د.ع</span></h4>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-5 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-2xl flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium font-bold block mb-1">{(isAdmin || isHR) ? 'المدفوع' : 'المقبوض'}</p>
            <h4 className="text-xl font-black text-slate-900 dark:text-slate-100">{totalPaid.toLocaleString()} <span className="text-xs text-slate-500">د.ع</span></h4>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 p-5 flex items-center gap-4 transition-all hover:shadow-md">
          <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 rounded-2xl flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium font-bold block mb-1">الرصيد المعلق</p>
            <h4 className="text-xl font-black text-slate-900 dark:text-slate-100">{totalPending.toLocaleString()} <span className="text-xs text-slate-500">د.ع</span></h4>
          </div>
        </div>
      </div>

      <div className="print-only hidden mb-8 text-center">
        <h1 className="text-2xl font-bold">كشف رواتب الموظفين</h1>
        <p className="text-sm text-slate-500 mt-2">الشهر: {selectedMonth} | السنة: {selectedYear}</p>
      </div>

      <div className="panel shadow-sm overflow-x-auto border-slate-100 dark:border-slate-800 rounded-[24px] print-section bg-white dark:bg-slate-900">
        <Table className="min-w-[800px]">
          <TableHeader className="bg-slate-50/70 dark:bg-slate-800/50 backdrop-blur-sm">
            <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
              <TableHead className="text-right text-slate-400 font-black py-4 text-[10px] uppercase tracking-widest">الموظف</TableHead>
              <TableHead className="text-right text-slate-400 font-black py-4 text-[10px] uppercase tracking-widest">الراتب الأساسي</TableHead>
              <TableHead className="text-right text-slate-400 font-black py-4 text-[10px] uppercase tracking-widest">المكافآت</TableHead>
              <TableHead className="text-right text-slate-400 font-black py-4 text-[10px] uppercase tracking-widest">الاستقطاعات</TableHead>
              <TableHead className="text-right text-slate-400 font-black py-4 text-[10px] uppercase tracking-widest">صافي الراتب</TableHead>
              <TableHead className="text-right text-slate-400 font-black py-4 text-[10px] uppercase tracking-widest">الحالة</TableHead>
              <TableHead className="text-left text-slate-400 font-black py-4 text-[10px] uppercase tracking-widest pr-10 no-print">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayroll.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-20 text-slate-400 dark:text-slate-500 italic font-bold">
                  لا توجد سجلات رواتب لهذا الشهر. اضغط على "إنشاء مسودة" للبدء.
                </TableCell>
              </TableRow>
            ) : (
              filteredPayroll.map((pay) => (
                <TableRow key={pay.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-all border-slate-50 dark:border-slate-800 group">
                  <TableCell className="py-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-11 h-11 ${getAvatarGradient(pay.employee?.name || '')} text-white rounded-2xl flex items-center justify-center font-black text-sm shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300`}>
                        {(pay.employee?.name || '')[0]}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-slate-100 text-[13px]">{pay.employee?.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">{pay.employee?.job_title}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-700 dark:text-slate-300 font-bold text-[13px] py-4">{pay.base_salary?.toLocaleString()} د.ع</TableCell>
                  <TableCell className="py-4">
                     <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-bold text-[13px] bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md">
                        <TrendingUp size={12} />
                        +{pay.bonuses?.toLocaleString() || 0} د.ع
                     </span>
                  </TableCell>
                  <TableCell className="py-4">
                    {pay.deductions > 0 ? (
                      <Popover>
                        <PopoverTrigger className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-bold text-[13px] bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 transition-all cursor-pointer">
                          <TrendingDown size={12} />
                          -{pay.deductions?.toLocaleString() || 0} د.ع
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4 rounded-2xl shadow-xl border-slate-100 dark:border-slate-800" align="center" side="top">
                          <div className="space-y-3" dir="rtl">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                              <AlertCircle size={16} className="text-red-500" />
                              <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">تفاصيل الاستقطاعات</h4>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
                              {pay.deduction_reasons && pay.deduction_reasons.length > 0 ? (
                                pay.deduction_reasons.map((reason, idx) => (
                                  <div key={idx} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">{reason.reason}</span>
                                      <span className="text-[11px] font-bold text-red-600">-{reason.amount.toLocaleString()} د.ع</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {reason.days.map((day, dIdx) => (
                                        <Badge key={dIdx} variant="outline" className="text-[9px] px-1.5 py-0 border-slate-200 dark:border-slate-700 font-medium">
                                          {day}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-center py-4">
                                  <p className="text-[11px] text-slate-500 italic">تم إدخال الاستقطاع يدوياً أو لا يوجد تفاصيل مسجلة.</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400 font-bold text-[13px] bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-md">
                        0 د.ع
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-black text-blue-600 dark:text-blue-400 text-[14px] py-4">{pay.net_salary?.toLocaleString()} د.ع</TableCell>
                  <TableCell className="py-4">
                    {pay.status === 'paid' ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-0 rounded-full px-3 py-1 text-[9px] font-black tracking-widest uppercase">تم الدفع</Badge>
                    ) : (
                      <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 border-0 rounded-full px-3 py-1 text-[9px] font-black tracking-widest uppercase">معلق</Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-4 no-print text-left">
                    <div className="flex items-center justify-end gap-2">
                       {(isAdmin || isHR) && pay.status === 'pending' && (
                        <Button 
                          onClick={() => {
                            setEditingPayroll(pay);
                            setEditBonuses(pay.bonuses || 0);
                            setEditDeductions(pay.deductions || 0);
                          }}
                          variant="ghost" 
                          size="icon" 
                          className="w-8 h-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                          title="تعديل"
                        >
                          <Edit2 size={16} />
                        </Button>
                      )}
                      {(isAdmin || isHR) && pay.status === 'pending' && (
                        <Button 
                          onClick={() => handleMarkAsPaid(pay.id)}
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700 text-white rounded-xl h-8 px-4 text-xs font-bold shadow-md shadow-green-600/20 active:scale-95 transition-all"
                        >
                          تأكيد الدفع
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <Download size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

       {/* Edit Modal */}
       <Dialog open={!!editingPayroll} onOpenChange={(open) => !open && setEditingPayroll(null)}>
        <DialogContent className="sm:max-w-md rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-slate-100 mb-4">
              تعديل راتب {editingPayroll?.employee?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 mb-4 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-500">الراتب الأساسي</span>
              <span className="text-lg font-black text-slate-900 dark:text-slate-100">{editingPayroll?.base_salary.toLocaleString()} د.ع</span>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700 dark:text-slate-300">إضافة مكافآت (د.ع)</Label>
              <Input 
                type="number" 
                value={editBonuses} 
                onChange={(e) => setEditBonuses(Number(e.target.value))}
                className="rounded-xl h-12 text-lg text-green-600 font-bold bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700 dark:text-slate-300">الاستقطاعات (د.ع)</Label>
              <Input 
                type="number" 
                value={editDeductions} 
                onChange={(e) => setEditDeductions(Number(e.target.value))}
                className="rounded-xl h-12 text-lg text-red-600 font-bold bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700"
              />
            </div>
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-6 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-500">الصافي المتوقع</span>
              <span className="text-2xl font-black text-blue-600">
                {((editingPayroll?.base_salary || 0) + editBonuses - editDeductions).toLocaleString()} د.ع
              </span>
            </div>
          </div>
          <DialogFooter className="mt-6 flex gap-3 sm:justify-start">
            <Button variant="outline" onClick={() => setEditingPayroll(null)} className="rounded-xl flex-1 font-bold">
              إلغاء
            </Button>
            <Button onClick={handleSaveEdits} className="rounded-xl flex-1 bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20">
              حفظ وتحديث
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
