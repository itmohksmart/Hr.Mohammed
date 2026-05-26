import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  Download, 
  FileText, 
  Users, 
  Clock, 
  Calendar, 
  ChevronDown,
  Printer,
  Share2,
  Filter,
  Search,
  MapPin,
  Briefcase,
  Activity,
  DollarSign,
  ShieldCheck,
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronUp
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Employee, Location, Shift, Attendance } from '../types';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getSystemSettings } from '../services/settingsService';
import { applyAttendancePolicy } from '../services/attendancePolicyService';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import domtoimage from 'dom-to-image-more';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area,
  LabelList
} from 'recharts';

export default function Reports() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [reportType, setReportType] = useState('attendance');
  const [locationsReport, setLocationsReport] = useState<any[]>([]);
  const [monthlyGrid, setMonthlyGrid] = useState<any[]>([]);
  const [datesList, setDatesList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filter states
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedShift, setSelectedShift] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  
  // Sorting state for report
  const [reportSort, setReportSort] = useState<{ key: string; direction: 'asc' | 'desc' | 'none' }>({ key: 'name', direction: 'none' });

  // Data for filters
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [reportData, setReportData] = useState<any[]>([]);

  // Summary data for tables
  const [summaryData, setSummaryData] = useState({
    employees: 0,
    attendance: 0,
    leaves: 0,
    payroll: 0,
    locations: 0,
    departments: 0,
    userRoles: 0
  });

  useEffect(() => {
    fetchUserRole();
    fetchFilterData();
    fetchSummaryCounts();
  }, []);

  const fetchSummaryCounts = async () => {
    try {
      const tables = ['employees', 'attendance', 'leaves', 'payroll', 'locations', 'departments', 'user_roles'];
      const counts: any = {};
      
      for (const table of tables) {
        let query = supabase.from(table).select('*', { count: 'exact', head: true });
        
        // Exclude probation employees from summary counts if it's the employees table
        if (table === 'employees') {
          query = query.neq('status', 'probation');
        }
        
        const { count, error } = await query;
        
        if (!error) {
          const key = table === 'user_roles' ? 'userRoles' : table;
          counts[key] = count || 0;
        }
      }
      
      setSummaryData(prev => ({ ...prev, ...counts }));
    } catch (error) {
      console.error('Error fetching summary counts:', error);
    }
  };

  const fetchFilterData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Fetch user role first
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();
    
    const role = roleData?.role || 'employee';
    const isSectorManager = role === 'sector_manager';

    let empQuery = supabase.from('employees').select('*, location:locations(*)').neq('status', 'probation');
    let locQuery = supabase.from('locations').select('*');
    let shiftQuery = supabase.from('shifts').select('*');

    if (isSectorManager) {
      const { data: managerEmp } = await supabase
        .from('employees')
        .select('location_id')
        .eq('email', session.user.email)
        .single();
      
      if (managerEmp?.location_id) {
        empQuery = empQuery.eq('location_id', managerEmp.location_id);
        setSelectedLocation(managerEmp.location_id);
      }
    }

    const { data: empData } = await empQuery;
    const { data: locData } = await locQuery;
    const { data: shiftData } = await shiftQuery;
    
    if (empData) {
      const mappedEmployees = empData.map(emp => ({
        ...emp,
        name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
      }));
      setEmployees(mappedEmployees);
      const depts = Array.from(new Set(mappedEmployees.map(e => e.department).filter(Boolean)));
      setDepartments(depts as string[]);
    }
    if (locData) setLocations(locData);
    if (shiftData) setShifts(shiftData);
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      if (reportType === 'attendance') {
        const settings = await getSystemSettings();
        // Fetch data based on filters - specifically exclude probation employees
        let query = supabase.from('attendance').select('*, employee:employees!inner(*)');

        if (dateFrom) query = query.gte('date', dateFrom);
        if (dateTo) query = query.lte('date', dateTo);
        if (selectedEmployee !== 'all') {
          query = query.eq('employee_id', selectedEmployee);
        } else {
          // Only include non-probation if "all" is selected
          query = query.neq('employee.status', 'probation');
        }
        
        const { data, error } = await query;

        if (error) throw error;

        // Filter by department, location, and shift client-side
        let filteredData = (data || []).map(item => ({
          ...item,
          employee: item.employee ? {
            ...item.employee,
            name: item.employee.name || `${item.employee.first_name || ''} ${item.employee.last_name || ''}`.trim()
          } : undefined
        }));

        if (selectedDept !== 'all') {
          filteredData = filteredData.filter(item => item.employee?.department === selectedDept);
        }
        if (selectedLocation !== 'all') {
          filteredData = filteredData.filter(item => item.employee?.location_id === selectedLocation);
        }
        if (selectedShift !== 'all') {
          filteredData = filteredData.filter(item => item.employee?.shift_id === selectedShift);
        }

        // Apply policy
        filteredData = filteredData.map(record => {
          const shift = shifts.find(s => s.id === record.employee?.shift_id);
          return applyAttendancePolicy(record as any, shift, settings);
        });

        setReportData(filteredData);
        setReportSort({ key: 'name', direction: 'none' }); // Reset sort when generating new report
        toast.success('تم إنشاء تقرير الحضور بنجاح');
      } else if (reportType === 'monthly_summary') {
        const settings = await getSystemSettings();
        // Fetch employees first
        let empQuery = supabase.from('employees').select('*, location:locations(*)').neq('status', 'probation');
        if (selectedLocation !== 'all') empQuery = empQuery.eq('location_id', selectedLocation);
        if (selectedDept !== 'all') empQuery = empQuery.eq('department', selectedDept);
        if (selectedShift !== 'all') empQuery = empQuery.eq('shift_id', selectedShift);
        if (selectedEmployee !== 'all') empQuery = empQuery.eq('id', selectedEmployee);
        
        const { data: emps } = await empQuery;
        if (!emps) return;

        // Determine date range
        const from = dateFrom || format(startOfMonth(new Date()), 'yyyy-MM-dd');
        const to = dateTo || format(endOfMonth(new Date()), 'yyyy-MM-dd');
        
        const interval = eachDayOfInterval({
          start: parseISO(from),
          end: parseISO(to)
        });
        
        const dates = interval.map(d => format(d, 'yyyy-MM-dd'));
        setDatesList(dates);

        // Fetch all attendance records for this period
        const { data: attData } = await supabase
          .from('attendance')
          .select('*')
          .gte('date', from)
          .lte('date', to);

        const grid = emps.map(emp => {
          const empAttendance = (attData || []).filter(a => a.employee_id === emp.id);
          const empShift = shifts.find(s => s.id === emp.shift_id);
          const row: any = { 
            id: emp.id, 
            emp_id: emp.emp_id, 
            name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
            department: emp.department,
            location: emp.location?.name,
            days: {},
            total_present: 0,
            total_absent: 0,
            total_late: 0,
            total_missing: 0,
            total_leave: 0,
            total_time_off: 0
          };

          dates.forEach(date => {
            const rawRecord = empAttendance.find(a => a.date === date);
            if (!rawRecord) {
              row.days[date] = null;
              return;
            }

            const record = applyAttendancePolicy(rawRecord as any, empShift, settings);
            row.days[date] = record.status;
            
            if (record.status === 'present') row.total_present++;
            if (record.status === 'absent') row.total_absent++;
            if (record.status === 'late') {
              row.total_present++;
              row.total_late += (record.late_minutes || 0);
            }
            if (record.status === 'missing_checkout' || record.status === 'missing_checkin') row.total_missing++;
            if (record.status === 'leave') row.total_leave++;
            if (record.status === 'time_off') row.total_time_off++;
          });

          return row;
        });

        setMonthlyGrid(grid);
        toast.success('تم إنشاء ملخص الحضور الشهري بنجاح');
      } else if (reportType === 'locations_detail') {
        // Special Report: Location Analysis
        // We use the already fetched employees and locations data
        const adminKeywords = ['إداري', 'مدير', 'محاسب', 'سكرتير', 'شؤون', 'موارد', 'مالية', 'مكتب', 'أخصائي', 'منسق', 'تقني', 'نظم', 'IT', 'إدارة'];
        const techKeywords = ['فني', 'مهندس', 'عامل', 'سائق', 'ميكانيكي', 'كهربائي', 'صيانة', 'هندسة', 'مشغل', 'ميداني', 'مراقب', 'أمن'];

        const locReport = locations.map(loc => {
          const locEmployees = employees.filter(emp => emp.location_id === loc.id && emp.status !== 'probation');
          
          if (locEmployees.length === 0 && selectedLocation !== 'all' && selectedLocation !== loc.id) return null;
          if (selectedLocation !== 'all' && selectedLocation !== loc.id) return null;

          const admins = locEmployees.filter(emp => {
            const title = (emp.job_title || '').toLowerCase();
            const dept = (emp.department || '').toLowerCase();
            return adminKeywords.some(k => title.includes(k.toLowerCase()) || dept.includes(k.toLowerCase()));
          });

          const techs = locEmployees.filter(emp => {
            const title = (emp.job_title || '').toLowerCase();
            const dept = (emp.department || '').toLowerCase();
            return techKeywords.some(k => title.includes(k.toLowerCase()) || dept.includes(k.toLowerCase()));
          });

          // All other employees that don't match specifically (default to tech if not admin, or however preferred)
          // For precision, let's just use the keywords
          
          const jobTitles: Record<string, number> = {};
          locEmployees.forEach(emp => {
            const title = emp.job_title || 'غير محدد';
            jobTitles[title] = (jobTitles[title] || 0) + 1;
          });

          return {
            id: loc.id,
            locationName: loc.name,
            total: locEmployees.length,
            admins: admins.length,
            techs: techs.length,
            others: locEmployees.length - (admins.length + techs.length),
            jobTitles: Object.entries(jobTitles).map(([title, count]) => ({ title, count }))
          };
        }).filter(Boolean);

        setLocationsReport(locReport);
        setReportData([]); // Clear attendance data if switching
        toast.success('تم إنشاء تقرير تحليل المواقع بنجاح');
      }
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast.error('خطأ في توليد التقرير');
    } finally {
      setLoading(false);
    }
  };

  const sortedReportData = React.useMemo(() => {
    if (reportSort.direction === 'none') return reportData;

    return [...reportData].sort((a, b) => {
      let aValue: any = '';
      let bValue: any = '';

      switch (reportSort.key) {
        case 'name':
          aValue = a.employee?.name || '';
          bValue = b.employee?.name || '';
          break;
        case 'date':
          aValue = a.date || '';
          bValue = b.date || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'department':
          aValue = a.employee?.department || '';
          bValue = b.employee?.department || '';
          break;
        case 'late':
          aValue = a.late_minutes || 0;
          bValue = b.late_minutes || 0;
          break;
        default:
          return 0;
      }

      const direction = reportSort.direction === 'asc' ? 1 : -1;
      
      if (typeof aValue === 'string') {
        return direction * aValue.localeCompare(bValue, 'ar');
      }
      return direction * (aValue - bValue);
    });
  }, [reportData, reportSort]);

  const handleSortReport = (key: string) => {
    setReportSort(prev => {
      if (prev.key === key) {
        if (prev.direction === 'none') return { key, direction: 'asc' };
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return { key, direction: 'none' };
      }
      return { key, direction: 'asc' };
    });
  };

  const getReportSortIcon = (key: string) => {
    if (reportSort.key !== key || reportSort.direction === 'none') return <Filter size={12} className="opacity-20" />;
    return reportSort.direction === 'asc' ? <ChevronUp size={12} className="text-primary" /> : <ChevronDown size={12} className="text-primary" />;
  };

  const exportToExcel = () => {
    if (sortedReportData.length === 0) {
      toast.error('لا توجد بيانات لتصديرها. قم بتوليد تقرير أولاً.');
      return;
    }

    const statusTranslations: Record<string, string> = {
      present: 'حاضر',
      absent: 'غائب',
      late: 'متأخر',
      missing_checkout: 'ناقص',
      leave: 'مجاز'
    };

    const worksheet = XLSX.utils.json_to_sheet(sortedReportData.map(item => ({
      'الموظف': item.employee?.name || '-',
      'البريد الإلكتروني': item.employee?.email,
      'التاريخ': item.date,
      'وقت الدخول': item.check_in || '-',
      'وقت الخروج': item.check_out || '-',
      'الحالة': statusTranslations[item.status] || item.status,
      'دقائق التأخير': item.late_minutes || 0,
      'خروج مبكر': item.early_exit_minutes || 0,
      'القسم': item.employee?.department || '-',
      'الموقع': locations.find(l => l.id === item.employee?.location_id)?.name || '-',
      'الوردية': shifts.find(s => s.id === item.employee?.shift_id)?.name || '-'
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "تقرير الحضور");
    XLSX.writeFile(workbook, `Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('تم تصدير ملف Excel بنجاح');
  };

  const exportToPDF = async () => {
    if (sortedReportData.length === 0) {
      toast.error('لا توجد بيانات لتصديرها. قم بتوليد تقرير أولاً.');
      return;
    }

    const reportElement = document.getElementById('pdf-report-template');
    if (!reportElement) {
      toast.error('لم يتم العثور على قالب التقرير');
      return;
    }

    setLoading(true);
    try {
      // Temporarily remove hidden class to capture
      reportElement.classList.remove('hidden');
      
      const dataUrl = await domtoimage.toPng(reportElement, {
        bgcolor: '#ffffff',
        width: 800, // A4 aspect ratio helper
        style: {
          transform: 'none',
          margin: '0',
          display: 'block'
        }
      });
      
      reportElement.classList.add('hidden');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Attendance_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('تم تصدير ملف PDF بنجاح');
    } catch (error) {
      console.error('PDF Export Error:', error);
      toast.error('خطأ في تصدير ملف PDF');
      reportElement.classList.add('hidden');
    } finally {
      setLoading(false);
    }
  };

  const exportMonthlyToExcel = async () => {
    if (monthlyGrid.length === 0) {
      toast.error('لا توجد بيانات لتصديرها. قم بتوليد التقرير أولاً.');
      return;
    }

    setLoading(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('ملخص الحضور الشهري', {
        views: [{ rightToLeft: true }]
      });

      // Status Styles
      const styles: Record<string, Partial<ExcelJS.Style>> = {
        present: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }, font: { color: { argb: 'FF006100' }, bold: true }, alignment: { horizontal: 'center', vertical: 'middle' }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } },
        absent: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }, font: { color: { argb: 'FF9C0006' }, bold: true }, alignment: { horizontal: 'center', vertical: 'middle' }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } },
        leave: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } }, font: { color: { argb: 'FF9C5700' }, bold: true }, alignment: { horizontal: 'center', vertical: 'middle' }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } },
        late: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE6CC' } }, font: { color: { argb: 'FFCC5E00' }, bold: true }, alignment: { horizontal: 'center', vertical: 'middle' }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } },
        missing_checkout: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6CCFF' } }, font: { color: { argb: 'FF5E00CC' }, bold: true }, alignment: { horizontal: 'center', vertical: 'middle' }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } },
        missing_checkin: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCE6FF' } }, font: { color: { argb: 'FF005ECC' }, bold: true }, alignment: { horizontal: 'center', vertical: 'middle' }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } },
        time_off: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFFCC' } }, font: { color: { argb: 'FF008000' }, bold: true }, alignment: { horizontal: 'center', vertical: 'middle' }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } },
        holiday: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }, font: { color: { argb: 'FF4B5563' } }, alignment: { horizontal: 'center', vertical: 'middle' }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } },
        default: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }, font: { color: { argb: 'FF000000' }, bold: true }, alignment: { horizontal: 'center', vertical: 'middle' }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } },
        header: { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1E1E' } }, font: { color: { argb: 'FFFFFFFF' }, bold: true }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } } }
      } as const;

      // Construct Headers
      
      // Add Title
      const titleRowContent = [`تقرير الحضور والغياب للفترة من ${dateFrom || 'غير محدد'} إلى ${dateTo || 'غير محدد'}`];
      // padding array to align with width
      const totalCols = 3 + datesList.length + 6;
      for(let i=1; i<totalCols; i++) {
        titleRowContent.push('');
      }
      const titleRow = worksheet.addRow(titleRowContent);
      worksheet.mergeCells(1, 1, 1, totalCols);
      titleRow.height = 40;
      titleRow.getCell(1).style = {
        font: { bold: true, size: 16 },
        alignment: { horizontal: 'center', vertical: 'middle' },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
      }

      const headers_days = ['كود الموظف', 'الاسم', 'الوظيفة', ...datesList.map(d => format(parseISO(d), 'EEEE', { locale: ar })), 'عدد أيام الحضور', 'عدد أيام الاجازات', 'عدد أيام الغياب', 'دقائق التأخير', 'الزمنيات', 'ناقص بصمة'];
      const headers_nums = ['كود الموظف', 'الاسم', 'الوظيفة', ...datesList.map(d => format(parseISO(d), 'd')), 'عدد أيام الحضور', 'عدد أيام الاجازات', 'عدد أيام الغياب', 'دقائق التأخير', 'الزمنيات', 'ناقص بصمة'];
      
      const dayNameRow = worksheet.addRow(headers_days);
      const headerRow = worksheet.addRow(headers_nums);
      
      dayNameRow.height = 70;
      headerRow.height = 30;
      
      dayNameRow.eachCell((cell, colNumber) => {
        const isDateCol = colNumber >= 4 && colNumber < 4 + datesList.length;
        if (isDateCol) {
          const isFriday = format(parseISO(datesList[colNumber - 4]), 'i') === '5';
          cell.style = { 
            ...styles.header, 
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: isFriday ? 'FFE5E7EB' : 'FF2D2D2D' } }, 
            font: { color: { argb: isFriday ? 'FF4B5563' : 'FFCBD5E1' }, bold: true } 
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
        } else {
          cell.style = styles.header;
        }
      });

      headerRow.eachCell((cell, colNumber) => {
        const isDateCol = colNumber >= 4 && colNumber < 4 + datesList.length;
        if (isDateCol) {
          const isFriday = format(parseISO(datesList[colNumber - 4]), 'i') === '5';
          if(isFriday) {
            cell.style = { 
              ...styles.header, 
              fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }, 
              font: { color: { argb: 'FF4B5563' }, bold: true } 
            };
          } else {
             cell.style = styles.header;
          }
        } else {
          cell.style = styles.header;
        }
      });

      // Merge cells for non-date columns
      worksheet.mergeCells(2, 1, 3, 1); // Code
      worksheet.mergeCells(2, 2, 3, 2); // Name
      worksheet.mergeCells(2, 3, 3, 3); // Job

      // Set explicit col widths
      worksheet.getColumn(1).width = 12; // Code
      worksheet.getColumn(2).width = 25; // Name
      worksheet.getColumn(3).width = 20; // Job
      
      for(let i=0; i<datesList.length; i++) {
        worksheet.getColumn(4+i).width = 6;
      }
      
      const lastColsStartIdx = 3 + datesList.length + 1;
      for(let i=0; i<6; i++) {
        worksheet.mergeCells(2, lastColsStartIdx + i, 3, lastColsStartIdx + i);
        worksheet.getColumn(lastColsStartIdx + i).width = 12;
      }

      // Add Data
      monthlyGrid.forEach((row, idx) => {
        const rowData = [
          row.emp_id || (idx + 1),
          row.name,
          row.department || '-',
          ...datesList.map(date => {
            const status = row.days[date];
            if (status === 'present') return 'حضور';
            if (status === 'absent') return 'غياب';
            if (status === 'leave') return 'اجازة';
            if (status === 'late') return 'L';
            if (status === 'missing_checkout') return 'T';
            if (status === 'missing_checkin') return 'E';
            if (status === 'time_off') return 'اذن';
            if (status === 'holiday' || format(parseISO(date), 'i') === '5') return 'عطلة';
            return '-';
          }),
          row.total_present,
          row.total_leave,
          row.total_absent,
          row.total_late || '-',
          row.total_time_off || '-',
          row.total_missing || '-'
        ];
        
        const excelRow = worksheet.addRow(rowData);
        
        // Style Cells
        excelRow.eachCell((cell, colNumber) => {
           cell.style = styles.default;
        });

        datesList.forEach((date, i) => {
          const status = row.days[date];
          const cell = excelRow.getCell(i + 4); 
          const isFriday = format(parseISO(date), 'i') === '5';
          
          if (status === 'present') cell.style = styles.present;
          else if (status === 'absent') cell.style = styles.absent;
          else if (status === 'leave') cell.style = styles.leave;
          else if (status === 'late') cell.style = styles.late;
          else if (status === 'missing_checkout') cell.style = styles.missing_checkout;
          else if (status === 'missing_checkin') cell.style = styles.missing_checkin;
          else if (status === 'time_off') cell.style = styles.time_off;
          else if (status === 'holiday' || isFriday) cell.style = styles.holiday;
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Monthly_Attendance_${dateFrom || 'start'}_to_${dateTo || 'end'}.xlsx`);
      toast.success('تم تصدير ملف Excel الملون بنجاح');
    } catch (error) {
      console.error('Excel Export Error:', error);
      toast.error('خطأ في تصدير ملف Excel');
    } finally {
      setLoading(false);
    }
  };

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

  const exportTableData = async (tableName: string, displayName: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error(`لا توجد بيانات لتصديرها من جدول ${displayName}`);
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, displayName);
      XLSX.writeFile(workbook, `${tableName}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`تم تصدير جدول ${displayName} بنجاح`);
    } catch (error: any) {
      console.error(`Export error for ${tableName}:`, error);
      toast.error(`خطأ في تصدير جدول ${displayName}`);
    } finally {
      setLoading(false);
    }
  };

  const attendanceData = [
    { name: 'الأحد', present: 22, absent: 2, late: 1 },
    { name: 'الاثنين', present: 24, absent: 0, late: 1 },
    { name: 'الثلاثاء', present: 20, absent: 4, late: 2 },
    { name: 'الأربعاء', present: 23, absent: 1, late: 0 },
    { name: 'الخميس', present: 21, absent: 3, late: 1 },
  ];

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#14b8a6', '#f43f5e', '#84cc16'];

  const departmentChartData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    employees.filter(e => e.status !== 'probation').forEach(emp => {
      const deptName = emp.department || 'بدون قسم';
      counts[deptName] = (counts[deptName] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [employees]);

  const chartData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    employees.filter(e => e.status !== 'probation').forEach(emp => {
      // Use location from populated relation or manually find it if only ID exists
      const locName = emp.location?.name || locations.find((l: any) => l.id === emp.location_id)?.name || 'غير محدد';
      counts[locName] = (counts[locName] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [employees, locations]);

  const isHRorAdmin = userRole === 'admin' || userRole === 'hr';
  const isSectorManager = userRole === 'sector_manager';
  const canAccessReports = isHRorAdmin || isSectorManager;

  if (userRole && !canAccessReports) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
          <BarChart3 size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">عذراً، ليس لديك صلاحية</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">هذه الصفحة مخصصة لمسؤولي النظام و HR فقط.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 md:pb-0">
      {/* Summary Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm rounded-[24px] overflow-hidden group hover:shadow-md transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl group-hover:scale-110 transition-transform">
                <Users size={24} />
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => exportTableData('employees', 'الموظفين')}
                title="تصدير جدول الموظفين"
              >
                <Download size={18} />
              </Button>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">إجمالي الموظفين</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{summaryData.employees}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm rounded-[24px] overflow-hidden group hover:shadow-md transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-2xl group-hover:scale-110 transition-transform">
                <Activity size={20} />
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => exportTableData('attendance', 'الحضور')}
                title="تصدير جدول الحضور"
              >
                <Download size={18} />
              </Button>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">سجلات الحضور</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{summaryData.attendance}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm rounded-[24px] overflow-hidden group hover:shadow-md transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl group-hover:scale-110 transition-transform">
                <Calendar size={24} />
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => exportTableData('leaves', 'الإجازات')}
                title="تصدير جدول الإجازات"
              >
                <Download size={18} />
              </Button>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">طلبات الإجازة</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{summaryData.leaves}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm rounded-[24px] overflow-hidden group hover:shadow-md transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-2xl group-hover:scale-110 transition-transform">
                <DollarSign size={24} />
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => exportTableData('payroll', 'الرواتب')}
                title="تصدير جدول الرواتب"
              >
                <Download size={18} />
              </Button>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">مسودات الرواتب</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{summaryData.payroll}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm rounded-[24px] overflow-hidden group hover:shadow-md transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl group-hover:scale-110 transition-transform">
                <MapPin size={24} />
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => exportTableData('locations', 'المواقع')}
                title="تصدير جدول المواقع"
              >
                <Download size={18} />
              </Button>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">إجمالي المواقع</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{summaryData.locations}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm rounded-[24px] overflow-hidden group hover:shadow-md transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl group-hover:scale-110 transition-transform">
                <Briefcase size={24} />
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => exportTableData('departments', 'الأقسام')}
                title="تصدير جدول الأقسام"
              >
                <Download size={18} />
              </Button>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">إجمالي الأقسام</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{summaryData.departments}</h3>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm rounded-[24px] overflow-hidden group hover:shadow-md transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 rounded-2xl group-hover:scale-110 transition-transform">
                <ShieldCheck size={24} />
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => exportTableData('user_roles', 'الصلاحيات')}
                title="تصدير جدول الصلاحيات"
              >
                <Download size={18} />
              </Button>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">مستخدمي الصلاحيات</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{summaryData.userRoles}</h3>
          </CardContent>
        </Card>
      </div>

      {/* Custom Report Generator Section */}
      <Card className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none"></div>
        
        <CardHeader className="px-0 pt-0 pb-6 border-b border-slate-50 dark:border-slate-800/60 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                <Filter size={24} />
              </div>
              <div>
                <CardTitle className="text-xl font-black text-slate-900 dark:text-slate-100">منشئ التقارير المخصصة</CardTitle>
                <CardDescription className="text-sm font-medium text-slate-500 mt-1">حدد المعايير المطلوبة لإنشاء تقرير دقيق ومفصل</CardDescription>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
               <Button 
                variant="outline" 
                className="rounded-xl h-10 px-4 text-xs font-bold border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setSelectedEmployee('all');
                  setSelectedDept('all');
                  setSelectedShift('all');
                  setSelectedLocation('all');
                  setReportData([]);
                }}
              >
                إعادة ضبط المعايير
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="px-0 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 lg:gap-6">
            <div className="space-y-2 xl:col-span-2">
              <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">نوع التقرير</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="rounded-xl h-12 text-sm font-bold bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="اختر نوع التقرير" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-100 dark:border-slate-800 shadow-xl">
                  <SelectItem value="attendance" className="rounded-lg focus:bg-primary/10">تقرير الحضور والغياب (قائمة)</SelectItem>
                  <SelectItem value="monthly_summary" className="rounded-lg focus:bg-primary/10">ملخص الحضور الشهري (جدول)</SelectItem>
                  <SelectItem value="locations_detail" className="rounded-lg focus:bg-primary/10">تحليل مواقع العمل (تقرير خاص)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 xl:col-span-2 relative">
              <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">الفترة الزمنية</Label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Input 
                    type="date" 
                    className="w-full rounded-xl h-12 text-sm font-bold bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-primary/20 pr-10" 
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                  />
                  <Calendar size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <span className="text-slate-400 text-xs font-bold shrink-0">إلى</span>
                <div className="relative flex-1">
                  <Input 
                    type="date" 
                    className="w-full rounded-xl h-12 text-sm font-bold bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-primary/20 pr-10" 
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                  />
                  <Calendar size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">الموظف</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="rounded-xl h-12 text-sm font-bold bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="اختر الموظف">
                    {selectedEmployee === 'all' 
                      ? 'جميع الموظفين' 
                      : (employees.find(e => String(e.id) === String(selectedEmployee))?.name || 'جاري التحميل...')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-100 dark:border-slate-800 shadow-xl max-h-60">
                  <SelectItem value="all" className="rounded-lg focus:bg-primary/10">جميع الموظفين</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id} className="rounded-lg focus:bg-primary/10">{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">القسم</Label>
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="rounded-xl h-12 text-sm font-bold bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-100 dark:border-slate-800 shadow-xl">
                  <SelectItem value="all" className="rounded-lg focus:bg-primary/10">جميع الأقسام</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept} className="rounded-lg focus:bg-primary/10">{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">الوردية</Label>
              <Select value={selectedShift} onValueChange={setSelectedShift}>
                <SelectTrigger className="rounded-xl h-12 text-sm font-bold bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="اختر الوردية">
                    {selectedShift === 'all' 
                      ? 'جميع الورديات' 
                      : (shifts.find(s => String(s.id) === String(selectedShift))?.name || 'جاري التحميل...')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-100 dark:border-slate-800 shadow-xl">
                  <SelectItem value="all" className="rounded-lg focus:bg-primary/10">جميع الورديات</SelectItem>
                  {shifts.map(shift => (
                    <SelectItem key={shift.id} value={shift.id} className="rounded-lg focus:bg-primary/10">{shift.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">الموقع</Label>
              <Select 
                value={selectedLocation} 
                onValueChange={setSelectedLocation}
                disabled={isSectorManager}
              >
                <SelectTrigger className="rounded-xl h-12 text-sm font-bold bg-slate-50 dark:bg-slate-800 border-none focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder="اختر الموقع">
                    {selectedLocation === 'all' 
                      ? 'جميع المواقع' 
                      : (locations.find(l => String(l.id) === String(selectedLocation))?.name || 'جاري التحميل...')
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-100 dark:border-slate-800 shadow-xl">
                  {!isSectorManager && <SelectItem value="all" className="rounded-lg focus:bg-primary/10">جميع المواقع</SelectItem>}
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id} className="rounded-lg focus:bg-primary/10">{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800/60 flex flex-wrap justify-between items-center gap-4">
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant="outline"
                className="rounded-xl h-12 px-6 text-sm font-bold border-green-200 text-green-700 bg-green-50/50 hover:bg-green-100 dark:border-green-900/30 dark:text-green-400 dark:bg-green-900/10 dark:hover:bg-green-900/30 flex-1 sm:flex-none shadow-sm transition-all"
                onClick={exportToExcel}
                disabled={reportData.length === 0 && locationsReport.length === 0}
              >
                تصدير Excel
                <Download size={18} className="mr-2" />
              </Button>
              <Button 
                variant="outline"
                className="rounded-xl h-12 px-6 text-sm font-bold border-red-200 text-red-700 bg-red-50/50 hover:bg-red-100 dark:border-red-900/30 dark:text-red-400 dark:bg-red-900/10 dark:hover:bg-red-900/30 flex-1 sm:flex-none shadow-sm transition-all"
                onClick={exportToPDF}
                disabled={reportData.length === 0 || reportType !== 'attendance'}
              >
                تصدير PDF
                <FileText size={18} className="mr-2" />
              </Button>
            </div>

            <Button 
              onClick={handleGenerateReport} 
              disabled={loading}
              className="rounded-xl h-12 px-8 text-sm font-black bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 w-full sm:w-auto transition-all text-white"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin border-transparent"></div>
                  <span>جاري المعالجة...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>توليد التقرير</span>
                  <BarChart3 size={18} className="mr-2" />
                </div>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {reportType === 'locations_detail' && locationsReport.length > 0 && (
        <div className="grid grid-cols-1 gap-8 mt-4">
          {locationsReport.map((loc, idx) => (
            <Card key={idx} className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden relative group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-all"></div>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
                    <MapPin size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">{loc.locationName}</h3>
                    <p className="text-sm font-bold text-slate-400 mt-1 flex items-center gap-2">
                      <Users size={14} />
                      إجمالي الموظفين: <span className="text-blue-600 text-base">{loc.total}</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4 w-full md:w-auto">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl flex-1 md:flex-none md:min-w-[120px] text-center border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">إداريين</p>
                    <p className="text-xl font-black text-slate-900 dark:text-slate-100">{loc.admins}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl flex-1 md:flex-none md:min-w-[120px] text-center border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">فنيين</p>
                    <p className="text-xl font-black text-blue-600">{loc.techs}</p>
                  </div>
                  {loc.others > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl flex-1 md:flex-none md:min-w-[120px] text-center border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">أخرى</p>
                      <p className="text-xl font-black text-slate-500">{loc.others}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-800 w-full mb-8"></div>

              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
                  <Briefcase size={16} className="text-blue-600" />
                  توزيع الموظفين حسب المسمى الوظيفي
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {loc.jobTitles.map((jt: any, jidx: number) => (
                    <div key={jidx} className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-800 transition-colors">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate mr-2" title={jt.title}>{jt.title}</span>
                      <Badge variant="secondary" className="bg-white dark:bg-slate-900 text-blue-600 font-black shadow-sm text-xs">
                        {jt.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      
      {reportType === 'monthly_summary' && monthlyGrid.length > 0 && (
        <Card className="bg-white dark:bg-slate-900 overflow-hidden rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm mt-4">
          <CardHeader className="border-b border-slate-50 dark:border-slate-800 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold">تقرير الحضور والغياب للفترة من {dateFrom || 'غير محدد'} إلى {dateTo || 'غير محدد'}</CardTitle>
              <CardDescription className="text-xs">عرض شبكي لحالة الحضور لجميع الموظفين خلال الفترة المختارة</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                className="rounded-xl h-10 px-4 text-xs font-bold bg-green-600 text-white hover:bg-green-700 shadow-sm"
                onClick={exportMonthlyToExcel}
              >
                <Download size={16} className="ml-2" />
                تصدير Excel
              </Button>
              <Button 
                className="rounded-xl h-10 px-4 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                onClick={() => {
                const printWindow = window.open('', '_blank');
                if (!printWindow) return;
                
                const tableHtml = document.getElementById('monthly-print-sheet')?.innerHTML;
                
                printWindow.document.write(`
                  <html dir="rtl">
                    <head>
                      <title>تقرير الحضور الشهري</title>
                      <style>
                        body { font-family: 'Arial', sans-serif; padding: 10px; margin: 0; }
                        table { border-collapse: collapse; width: 100%; table-layout: auto; border: 1px solid #000; }
                        th, td { border: 1px solid #000; padding: 2px; text-align: center; vertical-align: middle; font-size: 8px; word-break: break-all; }
                        th { background-color: #eee; font-weight: bold; }
                        .day-name { writing-mode: vertical-rl; transform: rotate(180deg); padding: 5px 2px; white-space: nowrap; height: 80px; min-width: 25px; }
                        .header-main { text-align: center; margin-bottom: 15px; }
                        /* Remove sticky positioning for print */
                        .sticky, .z-10, .z-20, .z-30 { 
                          position: static !important; 
                          background-color: transparent !important;
                        }
                        tr:nth-child(even) { background-color: #f9f9f9; }
                        @media print {
                          @page { size: landscape; margin: 1cm; }
                          body { padding: 0; }
                        }
                      </style>
                    </head>
                    <body>
                      <div class="header-main">
                        <h2 style="margin:0">تقرير الحضور والغياب</h2>
                        <p style="margin:5px 0">الفترة من ${dateFrom || 'غير محدد'} إلى ${dateTo || 'غير محدد'}</p>
                      </div>
                      <table>
                        ${tableHtml}
                      </table>
                    </body>
                  </html>
                `);
                printWindow.document.close();
                setTimeout(() => {
                  printWindow.focus();
                  printWindow.print();
                }, 500);
              }}
            >
              <Printer size={16} className="ml-2" />
              طباعة التقرير
            </Button>
          </div>
        </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto" id="monthly-summary-table">
              <table className="w-full text-center border-collapse min-w-[2000px] print:min-w-0" id="monthly-print-sheet" style={{ fontFamily: 'Arial, sans-serif' }}>
                <thead className="bg-[#1e1e1e] text-white whitespace-nowrap sticky top-0 z-20">
                  <tr>
                    <th rowSpan={2} className="px-3 py-3 text-xs font-bold border border-slate-600 sticky right-0 bg-[#1e1e1e] z-30 w-[80px]">كود الموظف</th>
                    <th rowSpan={2} className="px-3 py-3 text-xs font-bold border border-slate-600 sticky right-[80px] bg-[#1e1e1e] z-30 w-[180px]">الاسم</th>
                    <th rowSpan={2} className="px-3 py-3 text-xs font-bold border border-slate-600 sticky right-[260px] bg-[#1e1e1e] z-30 w-[120px]">الوظيفة</th>
                    {datesList.map((date, i) => {
                      const isFriday = format(parseISO(date), 'i') === '5';
                      return (
                      <th key={i} className={`px-1 py-1 text-[10px] font-bold border border-slate-600 min-w-[45px] h-[80px] align-middle ${isFriday ? 'bg-slate-200 text-slate-500' : 'bg-[#2d2d2d] text-slate-300'}`}>
                        <div className="[writing-mode:vertical-rl] [transform:rotate(180deg)] mx-auto h-full flex items-center justify-center">
                          {format(parseISO(date), 'EEEE', { locale: ar })}
                        </div>
                      </th>
                    )})}
                    <th rowSpan={2} className="px-2 py-3 text-[10px] font-bold border border-slate-600 min-w-[60px] whitespace-normal">عدد أيام الحضور</th>
                    <th rowSpan={2} className="px-2 py-3 text-[10px] font-bold border border-slate-600 min-w-[60px] whitespace-normal">عدد أيام الاجازات</th>
                    <th rowSpan={2} className="px-2 py-3 text-[10px] font-bold border border-slate-600 min-w-[60px] whitespace-normal">عدد أيام الغياب</th>
                    <th rowSpan={2} className="px-2 py-3 text-[10px] font-bold border border-slate-600 min-w-[50px] whitespace-normal">دقائق التأخير</th>
                    <th rowSpan={2} className="px-2 py-3 text-[10px] font-bold border border-slate-600 min-w-[50px] whitespace-normal">الزمنيات</th>
                    <th rowSpan={2} className="px-2 py-3 text-[10px] font-bold border border-slate-600 min-w-[50px] whitespace-normal">ناقص بصمة</th>
                  </tr>
                  <tr>
                    {datesList.map((date, i) => {
                      const isFriday = format(parseISO(date), 'i') === '5';
                      return (
                      <th key={i} className={`px-1 py-2 text-xs font-bold border border-slate-600 min-w-[45px] ${isFriday ? 'bg-slate-200 text-slate-600' : 'bg-[#1e1e1e] text-white'}`}>
                        {format(parseISO(date), 'd')}
                      </th>
                    )})}
                  </tr>
                </thead>
                <tbody className="bg-white text-xs text-black">
                  {monthlyGrid.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-2 py-2 border border-slate-400 font-bold sticky right-0 bg-white z-10">{row.emp_id || (idx + 1)}</td>
                      <td className="px-3 py-2 border border-slate-400 font-bold text-right sticky right-[80px] bg-white z-10 whitespace-nowrap">{row.name}</td>
                      <td className="px-3 py-2 border border-slate-400 font-bold sticky right-[260px] bg-white z-10">{row.department || '-'}</td>
                      {datesList.map((date, i) => {
                        const status = row.days[date];
                        let statusChar = '';
                        let bgClass = 'bg-white';
                        let textClass = 'text-black';
                        
                        if (status === 'present') { 
                            statusChar = 'حضور'; 
                            bgClass = 'bg-[#c6efce]'; 
                            textClass = 'text-[#006100]'; 
                        } else if (status === 'absent') { 
                            statusChar = 'غياب'; 
                            bgClass = 'bg-[#ffc7ce]'; 
                            textClass = 'text-[#9c0006]'; 
                        } else if (status === 'leave') { 
                            statusChar = 'اجازة'; 
                            bgClass = 'bg-[#ffeb9c]'; 
                            textClass = 'text-[#9c5700]'; 
                        } else if (status === 'late') { 
                            statusChar = 'L'; 
                            bgClass = 'bg-[#ffe6cc]'; 
                            textClass = 'text-[#cc5e00]'; 
                        } else if (status === 'missing_checkout') { 
                            statusChar = 'T'; 
                            bgClass = 'bg-[#e6ccff]'; 
                            textClass = 'text-[#5e00cc]'; 
                        } else if (status === 'missing_checkin') { 
                            statusChar = 'E'; 
                            bgClass = 'bg-[#cce6ff]'; 
                            textClass = 'text-[#005ecc]'; 
                        } else if (status === 'time_off') { 
                            statusChar = 'اذن'; 
                            bgClass = 'bg-[#ccffcc]'; 
                            textClass = 'text-[#008000]'; 
                        } else if (status === 'holiday') { 
                            statusChar = 'عطلة'; 
                            bgClass = 'bg-slate-200'; 
                            textClass = 'text-slate-600'; 
                        } else if (format(parseISO(date), 'i') === '5') {
                            statusChar = 'عطلة';
                            bgClass = 'bg-slate-200';
                            textClass = 'text-slate-600';
                        }

                        return (
                          <td key={i} className={`px-1 py-1 border border-slate-400 font-bold ${bgClass} ${textClass}`}>
                            {statusChar}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 border border-slate-400 font-bold text-center">{row.total_present}</td>
                      <td className="px-2 py-2 border border-slate-400 font-bold text-center">{row.total_leave}</td>
                      <td className="px-2 py-2 border border-slate-400 font-bold text-center">{row.total_absent}</td>
                      <td className="px-2 py-2 border border-slate-400 font-bold text-center">{row.total_late || '-'}</td>
                      <td className="px-2 py-2 border border-slate-400 font-bold text-center">{row.total_time_off || '-'}</td>
                      <td className="px-2 py-2 border border-slate-400 font-bold text-center">{row.total_missing || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {reportType === 'attendance' && sortedReportData.length > 0 && (
        <Card id="report-results-table" className="bg-white dark:bg-slate-900 overflow-hidden rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm">
          <CardHeader className="border-b border-slate-50 dark:border-slate-800">
            <div className="flex flex-col">
              <CardTitle className="text-lg font-bold">نتائج التقرير ({sortedReportData.length})</CardTitle>
              <div className="flex gap-4 mt-1 text-[10px] font-medium text-slate-500">
                <span className="flex items-center gap-1"><Briefcase size={10} /> القسم: {selectedDept === 'all' ? 'جميع الأقسام' : selectedDept}</span>
                <span className="text-slate-200">|</span>
                <span className="flex items-center gap-1"><Clock size={10} /> الوردية: {selectedShift === 'all' ? 'جميع الورديات' : (shifts.find(s => String(s.id) === String(selectedShift))?.name || '-')}</span>
                <span className="text-slate-200">|</span>
                <span className="flex items-center gap-1"><MapPin size={10} /> الموقع: {selectedLocation === 'all' ? 'جميع المواقع' : (locations.find(l => String(l.id) === String(selectedLocation))?.name || '-')}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th 
                      className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleSortReport('name')}
                    >
                      <div className="flex items-center gap-1">
                        الموظف
                        {getReportSortIcon('name')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleSortReport('date')}
                    >
                      <div className="flex items-center gap-1">
                        التاريخ
                        {getReportSortIcon('date')}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">الدخول</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">الخروج</th>
                    <th 
                      className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleSortReport('status')}
                    >
                      <div className="flex items-center gap-1">
                        الحالة
                        {getReportSortIcon('status')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleSortReport('late')}
                    >
                      <div className="flex items-center gap-1">
                        تأخير (دقائق)
                        {getReportSortIcon('late')}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      انصراف مبكر
                    </th>
                    <th 
                      className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleSortReport('department')}
                    >
                      <div className="flex items-center gap-1">
                        القسم
                        {getReportSortIcon('department')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {sortedReportData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {item.employee?.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.check_in || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.check_out || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${
                          item.status === 'present' ? 'bg-green-50 text-green-700' : 
                          item.status === 'absent' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {item.status === 'present' ? 'حاضر' : 
                           item.status === 'absent' ? 'غائب' : 
                           item.status === 'late' ? 'متأخر' : 
                           item.status === 'missing_checkout' ? 'ناقص' : item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.late_minutes || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.early_exit_minutes || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.employee?.department}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900 p-6 rounded-[24px] border-none text-white shadow-lg relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-white/10 rounded-xl">
                <FileText size={20} />
              </div>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 h-9 w-9 p-0 rounded-full">
                <Download size={16} />
              </Button>
            </div>
            <h3 className="text-sm font-medium text-slate-400">تقرير الحضور الشهري</h3>
            <p className="text-2xl font-bold mt-1">مارس 2024</p>
            <p className="text-[11px] mt-3 text-slate-500">تم التحديث منذ ساعتين</p>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        </Card>

        <Card className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <BarChart3 size={20} />
            </div>
            <Button variant="ghost" size="sm" className="text-slate-400 hover:bg-slate-50 h-9 w-9 p-0 rounded-full">
              <Download size={16} />
            </Button>
          </div>
          <h3 className="text-sm font-medium text-slate-500">تحليل الرواتب السنوي</h3>
          <p className="text-2xl font-bold text-slate-900 mt-1">2024</p>
          <p className="text-[11px] mt-3 text-slate-400">متاح للتحميل بصيغة PDF</p>
        </Card>

        <Card className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Users size={20} />
            </div>
            <Button variant="ghost" size="sm" className="text-slate-400 hover:bg-slate-50 h-9 w-9 p-0 rounded-full">
              <Download size={16} />
            </Button>
          </div>
          <h3 className="text-sm font-medium text-slate-500">توزيع الموظفين</h3>
          <p className="text-2xl font-bold text-slate-900 mt-1">حسب الأقسام</p>
          <p className="text-[11px] mt-3 text-slate-400">آخر تحديث: اليوم</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm">
          <CardHeader className="px-0 pt-0 pb-6 border-b border-slate-50 dark:border-slate-800 mb-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">تحليل الحضور الأسبوعي</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">مقارنة بين الحضور والغياب والتأخير</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-xl h-9 text-xs border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                <Printer size={14} className="ml-2" />
                طباعة
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl h-9 text-xs border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                <Share2 size={14} className="ml-2" />
                مشاركة
              </Button>
            </div>
          </CardHeader>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceData}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="present" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPresent)" strokeWidth={3} />
                <Area type="monotone" dataKey="absent" stroke="#ef4444" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                <Area type="monotone" dataKey="late" stroke="#f59e0b" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="bg-white dark:bg-slate-900 p-6 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm">
          <CardHeader className="px-0 pt-0 pb-6 border-b border-slate-50 dark:border-slate-800 mb-6">
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">توزيع الموظفين</CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">حسب القسم</CardDescription>
          </CardHeader>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={departmentChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {departmentChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', backgroundColor: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#0f172a' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-6">
            {departmentChartData.map((dept, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{dept.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{dept.value} موظف</span>
                  <span className="text-[10px] text-slate-400">({Math.round((dept.value / (employees.length || 1)) * 100)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card className="bg-white dark:bg-slate-900 p-6 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm mt-8">
          <CardHeader className="px-0 pt-0 pb-6 border-b border-slate-50 dark:border-slate-800 mb-6">
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">توزيع الموظفين حسب موقع العمل</CardTitle>
          </CardHeader>
          <div className="h-[300px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#0f172a', fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Bar dataKey="count" name="عدد الموظفين" fill="#0ea5e9" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  <LabelList dataKey="count" position="top" fill="#64748b" fontSize={12} offset={10} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Hidden PDF Template */}
      <div id="pdf-report-template" className="hidden fixed left-[-9999px] top-0 w-[800px] bg-white p-12 font-sans border-0" dir="rtl">
        {/* Modern Header Layout */}
        <div className="mb-10">
          <div className="flex justify-between items-start mb-6">
            <div className="text-right">
              <h1 className="text-[20px] font-black text-slate-900 leading-tight mb-1">HR-Mohammed</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">نظام إدارة الموارد البشرية</p>
            </div>
            <div className="text-left" dir="ltr">
              <div className="bg-slate-900 text-white px-4 py-1 rounded-md inline-block mb-1">
                <span className="text-[10px] font-black tracking-[0.2em]">ATTENDANCE REPORT</span>
              </div>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center">Official Internal Document</p>
            </div>
          </div>
          
          <div className="h-px bg-slate-100 w-full mb-6"></div>
          
          <div className="flex flex-wrap items-center gap-y-2 gap-x-8">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">موقع العمل</span>
              <span className="text-[11px] font-bold text-slate-700">{selectedLocation === 'all' ? 'جميع المواقع' : (locations.find(l => String(l.id) === String(selectedLocation))?.name || '-')}</span>
            </div>
            <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">الفترة</span>
              <span className="text-[11px] font-bold text-slate-700">{dateFrom || 'من البداية'} ← {dateTo || 'اليوم'}</span>
            </div>
            <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">القسم</span>
              <span className="text-[11px] font-bold text-slate-700">{selectedDept === 'all' ? 'عام' : selectedDept}</span>
            </div>
            <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">الوردية</span>
              <span className="text-[11px] font-bold text-slate-700">{selectedShift === 'all' ? 'جميع الورديات' : (shifts.find(s => s.id === selectedShift)?.name || '-')}</span>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 mb-12 shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-900">
                <th className="p-4 text-right text-[10px] font-black text-white uppercase tracking-widest border-b border-slate-800">الموظف</th>
                <th className="p-4 text-right text-[10px] font-black text-white uppercase tracking-widest border-b border-slate-800">التاريخ</th>
                <th className="p-4 text-right text-[10px] font-black text-white uppercase tracking-widest border-b border-slate-800">الدخول</th>
                <th className="p-4 text-right text-[10px] font-black text-white uppercase tracking-widest border-b border-slate-800">الخروج</th>
                <th className="p-4 text-center text-[10px] font-black text-white uppercase tracking-widest border-b border-slate-800">الحالة</th>
                <th className="p-4 text-center text-[10px] font-black text-white uppercase tracking-widest border-b border-slate-800">التأخير</th>
              </tr>
            </thead>
            <tbody>
              {sortedReportData.map((item, idx) => (
                <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} border-b border-slate-100 last:border-0`}>
                  <td className="p-3 text-[12px] border-l border-slate-50 text-slate-900 font-bold">
                    {item.employee?.name}
                  </td>
                  <td className="p-3 text-[12px] border-l border-slate-50 text-slate-600 font-medium">{item.date}</td>
                  <td className="p-3 text-[12px] border-l border-slate-50 text-slate-600 font-medium">{item.check_in || '-'}</td>
                  <td className="p-3 text-[12px] border-l border-slate-50 text-slate-600 font-medium">{item.check_out || '-'}</td>
                  <td className="p-3 text-[12px] border-l border-slate-50 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                      item.status === 'present' ? 'bg-green-50 text-green-700 ' : 
                      item.status === 'absent' ? 'bg-red-50 text-red-700 ' : 
                      item.status === 'late' ? 'bg-amber-50 text-amber-700 ' : 
                      item.status === 'missing_checkout' ? 'bg-slate-50 text-slate-600 ' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {item.status === 'present' ? 'حاضر' : 
                       item.status === 'absent' ? 'غائب' : 
                       item.status === 'late' ? 'متأخر' : 
                       item.status === 'missing_checkout' ? 'ناقص' : item.status}
                    </span>
                  </td>
                  <td className="p-3 text-[12px] text-center font-black text-slate-900">
                    {item.late_minutes ? `${item.late_minutes} د` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-end pt-12 border-t border-slate-200">
          <div>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">توقيع المسؤول</p>
            <div className="h-16 w-48 border-b-2 border-slate-100 italic font-serif text-slate-300 flex items-end pb-2">Verified Digital Signature</div>
          </div>
          <div className="text-left text-slate-400 text-[10px] font-bold" dir="ltr">
            <p>&copy; {new Date().getFullYear()} HR-MOHAMMED. ALL RIGHTS RESERVED.</p>
            <p className="mt-1">PAGE 1 OF 1</p>
          </div>
        </div>
      </div>
    </div>
  );
}
