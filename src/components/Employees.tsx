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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Employee, Department, Location, Shift } from '../types';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { MoreVertical, Edit2, Trash2, UserPlus, Mail, Phone, Briefcase, Search, XCircle, ShieldCheck, ChevronLeft, ChevronRight, UserMinus, UserCheck, Eye, Activity, Calendar, FileText, User, Users, MapPin, Settings2, DollarSign, ArrowDownAZ, ArrowUpAZ, Filter, Printer, ChevronUp, ChevronDown, LayoutGrid, List, Fingerprint, ScanFace, Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableItemProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: () => void;
  key?: React.Key;
}

function SortableColumnItem({ id, label, checked, onCheckedChange }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 group-hover:text-slate-400">
          <GripVertical size={16} />
        </div>
        <Label className="text-sm font-bold text-slate-600 dark:text-slate-400 cursor-pointer" onClick={onCheckedChange}>{label}</Label>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default function Employees() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | 'none' }>({ key: 'name', direction: 'none' });
  const [letterFilter, setLetterFilter] = useState<string>('all');

  const clearFilters = () => {
    setSearchQuery('');
    setLocationFilter('all');
    setLetterFilter('all');
    setCurrentTab('active');
  };
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [groupBy, setGroupBy] = useState<'none' | 'department' | 'location'>('none');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [attendanceMethod, setAttendanceMethod] = useState<'gps' | 'gps_photo' | 'gps_biometric'>('gps');
  const [selectedSmartLocations, setSelectedSmartLocations] = useState<string[]>([]);
  const [allSmartLocations, setAllSmartLocations] = useState<any[]>([]);

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

  const EmployeeTableRow = ({ emp, idx }: { emp: Employee, idx: number, key?: any }) => {
    const rowPadding = density === 'compact' ? 'py-2' : 'py-5';
    
    return (
      <motion.tr 
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        key={emp.id} 
        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-all border-slate-50 dark:border-slate-800 group relative border-b"
      >
        {columnOrder.map(colId => {
          if (!(visibleColumns as any)[colId]) return null;

          switch (colId) {
            case 'employee':
              return (
                <TableCell key={colId} className={rowPadding}>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className={`w-10 h-10 ${getAvatarGradient(emp.name)} text-white rounded-xl flex items-center justify-center font-black text-xs shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all duration-300`}>
                        {(emp.name || '')[0]}
                      </div>
                      {registeredEmails.has(emp.email) && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
                      )}
                    </div>
                    <div>
                      {editingCell?.id === emp.id && editingCell.field === 'name' ? (
                        <Input 
                          autoFocus
                          className="h-7 text-[13px] font-black w-full"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => handleInlineSave(emp.id, 'name', editingValue)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleInlineSave(emp.id, 'name', editingValue);
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                        />
                      ) : (
                        <p 
                          onClick={() => handleViewDetails(emp)}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (isHRorAdmin) {
                              setEditingCell({ id: emp.id, field: 'name' });
                              setEditingValue(emp.name || '');
                            }
                          }}
                          className="font-black text-slate-900 dark:text-slate-100 text-[13px] hover:text-primary cursor-pointer transition-colors"
                        >
                          {emp.name}
                        </p>
                      )}
                      {(visibleColumns.jobTitleDetail || visibleColumns.departmentDetail) && (
                        <div className="flex items-center gap-2 mt-0.5">
                          {visibleColumns.jobTitleDetail && (
                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                              <Briefcase size={10} />
                              {emp.job_title}
                            </span>
                          )}
                          {visibleColumns.jobTitleDetail && visibleColumns.departmentDetail && (
                            <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                          )}
                          {visibleColumns.departmentDetail && (
                            <span className="text-[10px] font-bold text-slate-400">{emp.department}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
              );
            case 'employee_number':
              return (
                <TableCell 
                  key={colId} 
                  className={rowPadding}
                  onDoubleClick={() => {
                    if (isHRorAdmin) {
                      setEditingCell({ id: emp.id, field: 'employee_number' });
                      setEditingValue(emp.employee_number || '');
                    }
                  }}
                >
                  {editingCell?.id === emp.id && editingCell.field === 'employee_number' ? (
                    <Input 
                      autoFocus
                      className="h-8 text-xs font-bold w-full"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => handleInlineSave(emp.id, 'employee_number', editingValue)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleInlineSave(emp.id, 'employee_number', editingValue);
                        if (e.key === 'Escape') setEditingCell(null);
                      }}
                    />
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer group">
                      <Hash size={12} className="text-slate-300 group-hover:text-primary transition-colors" />
                      <span className="bg-slate-50 dark:bg-slate-800/80 px-2 py-0.5 rounded text-[10px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors font-mono">
                        {emp.employee_number || '---'}
                      </span>
                    </div>
                  )}
                </TableCell>
              );
            case 'email':
              return (
                <TableCell key={colId} className={rowPadding}>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400">
                    <Mail size={12} className="text-slate-300" />
                    {emp.email}
                  </div>
                </TableCell>
              );
            case 'location':
              return (
                <TableCell 
                  key={colId} 
                  className={rowPadding}
                  onDoubleClick={() => {
                    if (isHRorAdmin) {
                      setEditingCell({ id: emp.id, field: 'location_id' });
                      setEditingValue(emp.location_id || 'none');
                    }
                  }}
                >
                  {editingCell?.id === emp.id && editingCell.field === 'location_id' ? (
                    <Select 
                      defaultValue={String(editingValue)}
                      onValueChange={(val) => handleInlineSave(emp.id, 'location_id', val === 'none' ? null : val)}
                      onOpenChange={(open) => { if(!open && editingCell?.field === 'location_id') setEditingCell(null); }}
                    >
                      <SelectTrigger className="h-8 text-[10px] font-bold w-full">
                        <SelectValue>
                          {locations.find(l => String(l.id) === String(editingValue))?.name || emp.location?.name || editingValue}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">بدون موقع</SelectItem>
                        {locations.map(loc => (
                          <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer group">
                      <MapPin size={12} className="text-slate-300 group-hover:text-primary transition-colors" />
                      <span className="group-hover:text-primary transition-colors">{emp.location?.name || 'غير محدد'}</span>
                    </div>
                  )}
                </TableCell>
              );
            case 'jobTitle':
              return (
                <TableCell 
                  key={colId} 
                  className={rowPadding}
                  onDoubleClick={() => {
                    if (isHRorAdmin) {
                      setEditingCell({ id: emp.id, field: 'job_title' });
                      setEditingValue(emp.job_title || '');
                    }
                  }}
                >
                  {editingCell?.id === emp.id && editingCell.field === 'job_title' ? (
                    <Input 
                      autoFocus
                      className="h-8 text-xs font-bold w-full"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => handleInlineSave(emp.id, 'job_title', editingValue)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleInlineSave(emp.id, 'job_title', editingValue);
                        if (e.key === 'Escape') setEditingCell(null);
                      }}
                    />
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer group">
                      <Briefcase size={12} className="text-slate-300 group-hover:text-primary transition-colors" />
                      <span className="group-hover:text-primary transition-colors">{emp.job_title}</span>
                    </div>
                  )}
                </TableCell>
              );
            case 'department':
              return (
                <TableCell 
                  key={colId} 
                  className={rowPadding}
                  onDoubleClick={() => {
                    if (isHRorAdmin) {
                      setEditingCell({ id: emp.id, field: 'department' });
                      setEditingValue(emp.department || '');
                    }
                  }}
                >
                  {editingCell?.id === emp.id && editingCell.field === 'department' ? (
                    <Input 
                      autoFocus
                      className="h-8 text-xs font-bold w-full"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => handleInlineSave(emp.id, 'department', editingValue)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleInlineSave(emp.id, 'department', editingValue);
                        if (e.key === 'Escape') setEditingCell(null);
                      }}
                    />
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer group">
                      <span className="group-hover:text-primary transition-colors">{emp.department}</span>
                    </div>
                  )}
                </TableCell>
              );
            case 'salary':
              return (
                <TableCell 
                  key={colId} 
                  className={rowPadding}
                  onDoubleClick={() => {
                    if (isHRorAdmin) {
                      setEditingCell({ id: emp.id, field: 'salary' });
                      setEditingValue(emp.salary || 0);
                    }
                  }}
                >
                  {editingCell?.id === emp.id && editingCell.field === 'salary' ? (
                    <Input 
                      autoFocus
                      type="number"
                      className="h-8 text-xs font-black w-24 text-blue-600"
                      value={editingValue}
                      onChange={(e) => setEditingValue(parseFloat(e.target.value) || 0)}
                      onBlur={() => handleInlineSave(emp.id, 'salary', editingValue)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleInlineSave(emp.id, 'salary', editingValue);
                        if (e.key === 'Escape') setEditingCell(null);
                      }}
                    />
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-black text-blue-600 dark:text-blue-400 cursor-pointer group">
                      <DollarSign size={12} className="group-hover:scale-110 transition-transform" />
                      <span className="group-hover:underline">{emp.salary ? emp.salary.toLocaleString() : '0'}</span>
                    </div>
                  )}
                </TableCell>
              );
            case 'status':
              return (
                <TableCell key={colId} className={rowPadding}>
                  <Badge className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest border-0 ${
                    (!emp.status || emp.status === 'active') ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 
                    emp.status === 'probation' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                  }`}>
                    {(!emp.status || emp.status === 'active') ? 'نشط' : 
                     emp.status === 'probation' ? 'تحت التجربة' :
                     ((emp as any).termination_date ? `متوقف (${(emp as any).termination_date})` : 'غير نشط')}
                  </Badge>
                </TableCell>
              );
            case 'hireDate':
              return (
                <TableCell 
                  key={colId} 
                  className={`text-slate-500 font-bold text-[11px] ${rowPadding} italic`}
                  onDoubleClick={() => {
                    if (isHRorAdmin) {
                      setEditingCell({ id: emp.id, field: 'hire_date' });
                      setEditingValue(emp.hire_date || '');
                    }
                  }}
                >
                  {editingCell?.id === emp.id && editingCell.field === 'hire_date' ? (
                    <Input 
                      autoFocus
                      type="date"
                      className="h-8 text-[10px] w-full"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => handleInlineSave(emp.id, 'hire_date', editingValue)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleInlineSave(emp.id, 'hire_date', editingValue);
                        if (e.key === 'Escape') setEditingCell(null);
                      }}
                    />
                  ) : (
                    <span className="cursor-pointer hover:text-primary hover:underline">{emp.hire_date}</span>
                  )}
                </TableCell>
              );
            case 'terminationDate':
              return (
                <TableCell key={colId} className={`text-red-500 font-bold text-[11px] ${rowPadding} italic`}>{emp.termination_date || '-'}</TableCell>
              );
            default:
              return null;
          }
        })}
        <TableCell className={`${rowPadding} print:hidden`}>
          <div className="flex items-center justify-end gap-1 px-4">
            <Button 
              onClick={() => handleViewDetails(emp)}
              variant="ghost" 
              size="icon" 
              className="w-8 h-8 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl"
              title="عرض التفاصيل"
            >
              <Eye size={16} />
            </Button>
            {isHRorAdmin && (
              <>
                <Button 
                  onClick={() => handleEditEmployee(emp)}
                  variant="ghost" 
                  size="icon" 
                  className="w-8 h-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl"
                  title="تعديل"
                >
                  <Edit2 size={16} />
                </Button>
                <Button 
                  onClick={() => handleCreateLoginClick(emp)}
                  variant="ghost" 
                  size="icon" 
                  className={`w-8 h-8 rounded-xl ${registeredEmails.has(emp.email) ? 'text-green-600 bg-green-50 dark:bg-green-900/30' : 'text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30'}`}
                  title={registeredEmails.has(emp.email) ? 'إدارة الحساب' : 'إنشاء دخول'}
                >
                  <ShieldCheck size={16} />
                </Button>
                {(!emp.status || emp.status === 'active') ? (
                  <Button 
                    onClick={() => handleSuspendEmployee(emp)}
                    variant="ghost" 
                    size="icon" 
                    className="w-8 h-8 text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-xl"
                    title="إيقاف الخدمة"
                  >
                    <UserMinus size={16} />
                  </Button>
                ) : (
                  <Button 
                    onClick={() => handleRestoreEmployee(emp)}
                    variant="ghost" 
                    size="icon" 
                    className="w-8 h-8 text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-xl"
                    title={emp.status === 'probation' ? 'نقل للقائمة الأساسية' : 'استعادة'}
                  >
                    {emp.status === 'probation' ? <UserPlus size={16} /> : <UserCheck size={16} />}
                  </Button>
                )}
                <Button 
                  onClick={() => handleDeleteClick(emp)}
                  variant="ghost" 
                  size="icon" 
                  className="w-8 h-8 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl"
                  title="حذف"
                >
                  <Trash2 size={16} />
                </Button>

                <Popover>
                  <PopoverTrigger render={
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="w-8 h-8 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-xl"
                      title="خيارات الحماية"
                    >
                      <Fingerprint size={16} />
                    </Button>
                  } />
                  <PopoverContent className="w-56 p-1 rounded-xl shadow-xl" align="end" dir="rtl">
                    <div className="p-2 space-y-2">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 mb-1">التحقق الحيوي</h4>
                       <button 
                         onClick={() => handleResetFaceID(emp.id)}
                         disabled={!emp.face_descriptor}
                         className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed group transition-colors"
                       >
                         <div className="flex items-center gap-2">
                           <ScanFace size={14} className="text-teal-500" />
                           <span>مسح بصمة الوجه</span>
                         </div>
                         {emp.face_descriptor && <Trash2 size={12} className="text-red-400 group-hover:text-red-600" />}
                       </button>

                       <button 
                         onClick={() => handleResetBiometrics(emp.id)}
                         disabled={!emp.biometric_credential_id}
                         className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed group transition-colors"
                       >
                         <div className="flex items-center gap-2">
                           <Fingerprint size={14} className="text-blue-500" />
                           <span>مسح بصمة الإصبع</span>
                         </div>
                         {emp.biometric_credential_id && <Trash2 size={12} className="text-red-400 group-hover:text-red-600" />}
                       </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        </TableCell>
      </motion.tr>
    );
  };

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('employees_visible_columns');
    const defaultCols = {
      employee: true,
      employee_number: true,
      email: true,
      location: true,
      jobTitle: true,
      department: true,
      salary: false,
      status: true,
      hireDate: true,
      terminationDate: true,
      jobTitleDetail: true,
      departmentDetail: true
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          if (parsed.employee_number === undefined) {
            parsed.employee_number = true;
          }
          return parsed;
        }
      } catch (e) {
        console.error('Error parsing visible columns:', e);
      }
    }
    return defaultCols;
  });

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('employees_column_order');
    const defaultOrder = [
      'employee',
      'employee_number',
      'email',
      'location',
      'jobTitle',
      'department',
      'salary',
      'status',
      'hireDate',
      'terminationDate'
    ];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed)) {
          if (!parsed.includes('employee_number')) {
            const index = parsed.indexOf('employee');
            if (index !== -1) {
              parsed.splice(index + 1, 0, 'employee_number');
            } else {
              parsed.unshift('employee_number');
            }
          }
          return parsed;
        }
      } catch (e) {
        console.error('Error parsing column order:', e);
      }
    }
    return defaultOrder;
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  const getVisibleColumnsCount = () => {
    return columnOrder.filter(key => (visibleColumns as any)[key]).length + 1; // +1 for Actions
  };

  const [employeeForLogin, setEmployeeForLogin] = useState<Employee | null>(null);
  const [customPassword, setCustomPassword] = useState('password123');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [registeredEmails, setRegisteredEmails] = useState<Set<string>>(new Set());
  const [currentTab, setCurrentTab] = useState<'active' | 'suspended' | 'probation'>('active');
  const [searchCriteria, setSearchCriteria] = useState<'name' | 'department' | 'job_title'>('name');
  const [selectedDetailsEmployee, setSelectedDetailsEmployee] = useState<Employee | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: string, field: 'name' | 'salary' | 'job_title' | 'department' | 'location_id' | 'hire_date' } | null>(null);
  const [editingValue, setEditingValue] = useState<string | number>('');
  const [performanceData, setPerformanceData] = useState<{
    present: number;
    absent: number;
    late: number;
    days: any[];
  } | null>(null);

  const [newEmployee, setNewEmployee] = useState({
    name: '',
    employee_number: '',
    email: '',
    phone: '',
    department: '',
    location_id: '',
    job_title: '',
    salary: 0,
    shift_id: '',
    hire_date: new Date().toISOString().split('T')[0],
    termination_date: ''
  });

  useEffect(() => {
    localStorage.setItem('employees_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    localStorage.setItem('employees_column_order', JSON.stringify(columnOrder));
  }, [columnOrder]);

  useEffect(() => {
    fetchData();
    fetchUserRole();
    fetchRegisteredUsers();
    fetchSmartLocations();
  }, []);

  const fetchSmartLocations = async () => {
    const { data } = await supabase.from('smart_locations').select('*').eq('is_active', true);
    setAllSmartLocations(data || []);
  };

  const fetchRegisteredUsers = async () => {
    try {
      const response = await fetch('/api/admin/list-users');
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          console.warn('API returned HTML instead of JSON. The backend Express server is likely not running on this static hosting platform (e.g. Cloudflare Pages).');
          return;
        }
        const users = await response.json();
        const emails = new Set<string>();
        users.forEach((u: any) => emails.add(u.email));
        setRegisteredEmails(emails);
      }
    } catch (e) {
      console.error('Failed to fetch registered users', e);
    }
  };

  const fetchPerformance = async (employeeId: string) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: attendance } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth);

    if (attendance) {
      setPerformanceData({
        present: attendance.filter(a => a.status === 'present').length,
        absent: attendance.filter(a => a.status === 'absent').length,
        late: attendance.filter(a => a.status === 'late').length,
        days: attendance
      });
    }
  };

  const handleViewDetails = (emp: Employee) => {
    setSelectedDetailsEmployee(emp);
    setPerformanceData(null);
    fetchPerformance(emp.id);
    setIsDetailsOpen(true);
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

  const fetchData = async () => {
    setLoading(true);
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

    let empQuery = supabase.from('employees').select('*, location:locations(name), shift:shifts(name)');
    
    if (isSectorManager) {
      const { data: managerEmp } = await supabase
        .from('employees')
        .select('location_id')
        .eq('email', session.user.email)
        .single();
      
      if (managerEmp?.location_id) {
        empQuery = empQuery.eq('location_id', managerEmp.location_id);
        setLocationFilter(managerEmp.location_id);
      }
    }

    const { data: empData } = await empQuery;
    
    const { data: locData } = await supabase
      .from('locations')
      .select('*')
      .order('name');

    const { data: shiftData } = await supabase
      .from('shifts')
      .select('*')
      .order('name');

    if (empData) {
      const mappedEmployees = empData.map(emp => ({
        ...emp,
        name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
      }));
      setEmployees(mappedEmployees);
    }
    setLocations(locData || []);
    setShifts(shiftData || []);
    setLoading(false);
  };

  const handleResetFaceID = async (employeeId: string) => {
    if (!window.confirm('هل أنت متأكد من مسح بصمة الوجه لهذا الموظف؟ سيُطلب منه إعدادها من جديد عند تسجيل الحضور.')) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('employees')
      .update({ face_descriptor: null })
      .eq('id', employeeId);

    if (error) {
      toast.error('فشل مسح بصمة الوجه: ' + error.message);
    } else {
      toast.success('تم مسح بصمة الوجه بنجاح');
      if (selectedDetailsEmployee?.id === employeeId) {
        setSelectedDetailsEmployee({ ...selectedDetailsEmployee, face_descriptor: null });
      }
      fetchData();
    }
    setLoading(false);
  };

  const handleResetBiometrics = async (employeeId: string) => {
    if (!window.confirm('هل أنت متأكد من مسح بصمة الإصبع المسجلة لهذا الموظف؟')) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('employees')
      .update({ biometric_credential_id: null })
      .eq('id', employeeId);

    if (error) {
      toast.error('فشل مسح البصمة: ' + error.message);
    } else {
      toast.success('تم مسح بصمة الإصبع بنجاح');
      if (selectedDetailsEmployee?.id === employeeId) {
        setSelectedDetailsEmployee({ ...selectedDetailsEmployee, biometric_credential_id: null });
      }
      fetchData();
    }
    setLoading(false);
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, ...employeeData } = newEmployee;
    const finalEmail = employeeData.email?.trim() === '' ? null : employeeData.email?.trim();
    const finalLocationId = !employeeData.location_id || employeeData.location_id === 'none' ? null : employeeData.location_id;
    const finalShiftId = !employeeData.shift_id || employeeData.shift_id === 'none' ? null : employeeData.shift_id;
    
    // Use the status from state if present (set by the probation button), otherwise default to active
    const status = (employeeData as any).status || 'active';

    const insertData: any = {
      ...employeeData,
      status: status,
      email: finalEmail,
      location_id: finalLocationId,
      shift_id: finalShiftId,
      first_name: name,
      last_name: '',
      attendance_method: attendanceMethod,
      allowed_locations_ids: selectedSmartLocations,
      termination_date: employeeData.termination_date || null
    };

    let empData = null;
    let error = null;
    let insertDataToTry = { ...insertData };
    let maxRetries = 4;

    while (maxRetries > 0) {
      const res = await supabase
        .from('employees')
        .insert([insertDataToTry])
        .select()
        .single();
      
      if (res.error) {
        // Find which column is missing using a regex match from the database error string
        let missingColumn = null;
        const msg = res.error.message;
        const match1 = msg.match(/column\s+["']?([a-zA-Z0-9_]+)["']?/i);
        const match2 = msg.match(/["']?([a-zA-Z0-9_]+)["']?\s+column/i);
        
        if (match1 && match1[1]) {
          missingColumn = match1[1];
        } else if (match2 && match2[1]) {
          missingColumn = match2[1];
        }

        // Hardcoded backup checks for typical missing fields
        if (!missingColumn) {
          if (msg.includes('employee_number') && 'employee_number' in insertDataToTry) {
            missingColumn = 'employee_number';
          } else if (msg.includes('attendance_method') && 'attendance_method' in insertDataToTry) {
            missingColumn = 'attendance_method';
          } else if (msg.includes('allowed_locations_ids') && 'allowed_locations_ids' in insertDataToTry) {
            missingColumn = 'allowed_locations_ids';
          } else if (msg.includes('biometric_credential_id') && 'biometric_credential_id' in insertDataToTry) {
            missingColumn = 'biometric_credential_id';
          }
        }

        if (missingColumn && missingColumn in insertDataToTry) {
          delete insertDataToTry[missingColumn];
          maxRetries--;
          continue;
        }
        error = res.error;
        break;
      } else {
        empData = res.data;
        error = null;
        break;
      }
    }

    if (error) {
      if (error.message.includes('not-null constraint') && error.message.includes('email')) {
        toast.error('الفشل في إضافة الموظف بدون إيميل: يرجى تنفيذ هذا الأمر في Supabase SQL لإلغاء إلزامية الإيميل: ALTER TABLE employees ALTER COLUMN email DROP NOT NULL;');
      } else {
        toast.error('خطأ في إضافة الموظف: ' + error.message);
      }
    } else {
      // Handle allowed locations - Primary storage: JSONB column (already done in insertData)
      
      // Secondary storage: Join table for relational queries (optional but good for backwards compatibility)
      if (empData && selectedSmartLocations.length > 0) {
        try {
          const relations = selectedSmartLocations.map(locId => ({
            employee_id: empData.id,
            smart_location_id: locId
          }));
          await supabase.from('employee_smart_locations').insert(relations);
        } catch (e) {
          console.warn('Failed to sync to join table, but main record is saved:', e);
        }
      }

      toast.success('تم إضافة الموظف بنجاح');
      setIsAddOpen(false);
      setNewEmployee({
        name: '',
        employee_number: '',
        email: '',
        phone: '',
        department: '',
        location_id: '',
        job_title: '',
        salary: 0,
        shift_id: '',
        hire_date: new Date().toISOString().split('T')[0],
        termination_date: ''
      });
      setAttendanceMethod('gps');
      setSelectedSmartLocations([]);
      fetchData();
    }
  };

  const openEditDialog = async (employee: Employee) => {
    // Ensure data is loaded
    if (locations.length === 0 || shifts.length === 0) {
      await fetchData();
    }
    
    setEditingEmployee(employee);
    setNewEmployee({
      name: employee.name,
      employee_number: employee.employee_number || '',
      email: employee.email,
      phone: employee.phone || '',
      department: employee.department || '',
      location_id: employee.location_id || '',
      job_title: employee.job_title || '',
      salary: employee.salary || 0,
      shift_id: employee.shift_id || '',
      biometric_credential_id: employee.biometric_credential_id,
      hire_date: employee.hire_date ? new Date(employee.hire_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      termination_date: employee.termination_date ? new Date(employee.termination_date).toISOString().split('T')[0] : ''
    });
    setAttendanceMethod(employee.attendance_method || 'gps');
    setSelectedSmartLocations(employee.allowed_locations_ids || []);
    
    // Fallback/Sync: Fetch assigned locations from join table if JSONB is empty
    if (!employee.allowed_locations_ids || employee.allowed_locations_ids.length === 0) {
      const { data } = await supabase.from('employee_smart_locations').select('smart_location_id').eq('employee_id', employee.id);
      if (data && data.length > 0) {
        setSelectedSmartLocations(data.map(d => d.smart_location_id));
      }
    }
    
    setIsEditOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    openEditDialog(employee);
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    const { name, ...employeeData } = newEmployee;
    const finalEmail = employeeData.email?.trim() === '' ? null : employeeData.email?.trim();
    const finalLocationId = !employeeData.location_id || employeeData.location_id === 'none' ? null : employeeData.location_id;
    const finalShiftId = !employeeData.shift_id || employeeData.shift_id === 'none' ? null : employeeData.shift_id;

    const updateData: any = {
      ...employeeData,
      email: finalEmail,
      location_id: finalLocationId,
      shift_id: finalShiftId,
      first_name: name,
      last_name: '',
      attendance_method: attendanceMethod,
      allowed_locations_ids: selectedSmartLocations,
      termination_date: employeeData.termination_date || null
    };

    let error = null;
    let updateDataToTry = { ...updateData };
    let maxRetries = 4;

    while (maxRetries > 0) {
      const res = await supabase
        .from('employees')
        .update(updateDataToTry)
        .eq('id', editingEmployee.id);
      
      if (res.error) {
        // Find which column is missing using regex match from database error
        let missingColumn = null;
        const msg = res.error.message;
        const match1 = msg.match(/column\s+["']?([a-zA-Z0-9_]+)["']?/i);
        const match2 = msg.match(/["']?([a-zA-Z0-9_]+)["']?\s+column/i);
        
        if (match1 && match1[1]) {
          missingColumn = match1[1];
        } else if (match2 && match2[1]) {
          missingColumn = match2[1];
        }

        // Hardcoded backup checks for typical missing fields
        if (!missingColumn) {
          if (msg.includes('employee_number') && 'employee_number' in updateDataToTry) {
            missingColumn = 'employee_number';
          } else if (msg.includes('attendance_method') && 'attendance_method' in updateDataToTry) {
            missingColumn = 'attendance_method';
          } else if (msg.includes('allowed_locations_ids') && 'allowed_locations_ids' in updateDataToTry) {
            missingColumn = 'allowed_locations_ids';
          } else if (msg.includes('biometric_credential_id') && 'biometric_credential_id' in updateDataToTry) {
            missingColumn = 'biometric_credential_id';
          }
        }

        if (missingColumn && missingColumn in updateDataToTry) {
          delete updateDataToTry[missingColumn];
          maxRetries--;
          continue;
        }
        error = res.error;
        break;
      } else {
        error = null;
        break;
      }
    }

    if (error) {
      if (error.message.includes('not-null constraint') && error.message.includes('email')) {
        toast.error('الفشل في تحديث الموظف بدون إيميل: يرجى تنفيذ هذا الأمر في Supabase SQL لإلغاء إلزامية الإيميل: ALTER TABLE employees ALTER COLUMN email DROP NOT NULL;');
      } else {
        toast.error('خطأ في تحديث البيانات: ' + error.message);
      }
    } else {
      // Sync locations
      // 1. Join table sync (Optional/Relational)
      try {
        await supabase.from('employee_smart_locations').delete().eq('employee_id', editingEmployee.id);
        if (selectedSmartLocations.length > 0) {
          const relations = selectedSmartLocations.map(locId => ({
            employee_id: editingEmployee.id,
            smart_location_id: locId
          }));
          await supabase.from('employee_smart_locations').insert(relations);
        }
      } catch (e) {
        console.warn('Join table sync failed:', e);
      }
      
      // The JSONB column was already updated in handlesUpdateEmployee via updateData.allowed_locations_ids

      toast.success('تم تحديث بيانات الموظف بنجاح');
      setIsEditOpen(false);
      setEditingEmployee(null);
      setAttendanceMethod('gps');
      setSelectedSmartLocations([]);
      fetchData();
    }
  };

  const handleDeleteClick = (employee: Employee) => {
    setEmployeeToDelete(employee);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!employeeToDelete) return;

    const toastId = toast.loading('جاري حذف الموظف...');
    try {
      // 1. Delete from Supabase Auth if exists
      if (registeredEmails.has(employeeToDelete.email)) {
        await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: employeeToDelete.email }),
        });
      }

      // 2. Delete from employees table
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employeeToDelete.id);

      if (error) throw error;

      toast.success('تم حذف الموظف وكافة بيانات الدخول بنجاح', { id: toastId });
      setIsDeleteOpen(false);
      setEmployeeToDelete(null);
      fetchData();
      fetchRegisteredUsers();
    } catch (error: any) {
      toast.error('خطأ في حذف الموظف: ' + error.message, { id: toastId });
    }
  };

  const handleCreateLoginClick = (employee: Employee) => {
    if (registeredEmails.has(employee.email)) {
      toast.info("هذا الموظف يمتلك حساباً بالفعل. يمكنك إرسال رابط إعادة تعيين كلمة المرور.");
    }
    setEmployeeForLogin(employee);
    setCustomPassword('password123');
    setIsLoginOpen(true);
  };

  const handleCreateLogin = async () => {
    if (!employeeForLogin) return;
    
    const toastId = toast.loading('جاري معالجة الطلب...');
    
    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: employeeForLogin.email,
          password: customPassword,
          role: 'employee'
        }),
      });

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error('static_html_served');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      if (data.message.includes("already exists")) {
        toast.info("هذا البريد مسجل مسبقاً. تم تحديث صلاحيات الوصول فقط.", { id: toastId });
      } else {
        toast.success(`تم إنشاء حساب للموظف بنجاح. كلمة المرور: ${customPassword}`, { id: toastId });
      }
      setIsLoginOpen(false);
      fetchRegisteredUsers();
    } catch (error: any) {
      if (error.message === 'static_html_served' || error.message.includes('Unexpected token') || error.message.includes('JSON')) {
        toast.error('رابط Cloudflare يستضيف الملفات الثابتة فقط ولا يقوم بتشغيل خادم الباك إند (Node.js). يرجى فتح رابط المعاينة الكامل للتطبيق لإدارة وإنشاء حسابات الموظفين.', { id: toastId, duration: 8000 });
      } else if (error.message === 'Failed to fetch') {
        toast.error('لم نتمكن من الاتصال بالخادم. تأكد من تشغيل الخادم بشكل صحيح.', { id: toastId });
      } else {
        toast.error('خطأ في إنشاء الحساب: ' + error.message, { id: toastId });
      }
    }
  };

  const handleSendResetEmail = async () => {
    if (!employeeForLogin) return;

    const toastId = toast.loading('جاري إرسال رابط إعادة التعيين...');

    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: employeeForLogin.email
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset link');
      }

      toast.success('تم توليد رابط إعادة تعيين كلمة المرور بنجاح (ملاحظة: يتطلب ضبط SMTP في Supabase للإرسال التلقائي)', { id: toastId });
      setIsLoginOpen(false);
    } catch (error: any) {
      if (error.message === 'Failed to fetch') {
        toast.error('لم نتمكن من الاتصال بالخادم. تأكد من تشغيل الخادم بشكل صحيح.', { id: toastId });
      } else {
        toast.error('خطأ في إرسال الرابط: ' + error.message, { id: toastId });
      }
    }
  };

  const handleUpdateUserPassword = async () => {
    if (!employeeForLogin || !customPassword) return;
    
    setIsUpdatingPassword(true);
    const toastId = toast.loading('جاري تحديث كلمة المرور...');
    
    try {
      const response = await fetch('/api/admin/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: employeeForLogin.email,
          newPassword: customPassword
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      toast.success('تم تحديث كلمة المرور بنجاح', { id: toastId });
      setIsLoginOpen(false);
    } catch (error: any) {
      toast.error('خطأ في تحديث كلمة المرور: ' + error.message, { id: toastId });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSuspendEmployee = async (employee: Employee) => {
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('employees')
      .update({ status: 'inactive', termination_date: today })
      .eq('id', employee.id);

    if (error) {
      toast.error('خطأ في إيقاف الخدمات: ' + error.message);
    } else {
      toast.success('تم إيقاف الموظف ونقله إلى قائمة المتوقفين');
      fetchData();
    }
  };

  const handleRestoreEmployee = async (employee: Employee) => {
    const { error } = await supabase
      .from('employees')
      .update({ status: 'active', termination_date: null })
      .eq('id', employee.id);

    if (error) {
      toast.error('خطأ في استعادة الموظف: ' + error.message);
    } else {
      toast.success('تم استعادة الموظف بنجاح إلى القائمة الرئيسية');
      fetchData();
    }
  };

  const handleInlineSave = async (id: string, field: 'name' | 'salary' | 'job_title' | 'department' | 'location_id' | 'hire_date' | 'employee_number', value: any) => {
    if (!isHRorAdmin) {
      toast.error('ليس لديك الصلاحية لتعديل البيانات');
      setEditingCell(null);
      return;
    }
    const toastId = toast.loading('جاري التحديث...');
    try {
      const { error } = await supabase
        .from('employees')
        .update({ [field]: value })
        .eq('id', id);

      if (error) throw error;

      toast.success('تم التحديث بنجاح', { id: toastId });
      setEditingCell(null);
      fetchData();
    } catch (error: any) {
      if (error.message?.includes('employee_number') || error.message?.includes('schema cache')) {
        toast.error('لم يتم تدوين حقل رقم الموظف في قاعدة بياناتك بعد. يرجى الذهاب إلى الإعدادات ثم "تشخيصات النظام" لتحديث قاعدة البيانات بنقرة واحدة.', { id: toastId, duration: 6000 });
      } else {
        toast.error('خطأ في التحديث: ' + error.message, { id: toastId });
      }
    }
  };

  const alphabet = ["أ", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "هـ", "و", "ي"];

  const filteredEmployees = employees.filter(emp => {
    if (currentTab === 'active' && emp.status !== 'active' && emp.status !== undefined) return false;
    if (currentTab === 'suspended' && emp.status !== 'inactive') return false;
    if (currentTab === 'probation' && emp.status !== 'probation') return false;

    // Handle legacy case where status might be missing (treat as active)
    if (currentTab === 'active' && !emp.status && emp.status !== 'inactive' && emp.status !== 'probation') {
      // already handled by first check mostly, but being explicit
    }

    let matchesSearch = false;
    const query = searchQuery.toLowerCase();
    
    if (searchCriteria === 'name') {
      matchesSearch = (emp.name || '').toLowerCase().includes(query) || 
                      (emp.email || '').toLowerCase().includes(query) ||
                      (emp.employee_number || '').toLowerCase().includes(query);
    } else if (searchCriteria === 'department') {
      matchesSearch = (emp.department || '').toLowerCase().includes(query);
    } else if (searchCriteria === 'job_title') {
      matchesSearch = (emp.job_title || '').toLowerCase().includes(query);
    }
    
    const matchesLocation = locationFilter === 'all' || emp.location_id === locationFilter;
    
    // Exact letter match or "all"
    const matchesLetter = letterFilter === 'all' || (emp.name || '').trim().startsWith(letterFilter);
    
    return matchesSearch && matchesLocation && matchesLetter;
  }).sort((a, b) => {
    if (sortConfig.direction === 'none') return 0;
    
    let aValue: any = '';
    let bValue: any = '';

    switch (sortConfig.key) {
      case 'name':
        aValue = a.name || '';
        bValue = b.name || '';
        break;
      case 'email':
        aValue = a.email || '';
        bValue = b.email || '';
        break;
      case 'location':
        aValue = a.location?.name || '';
        bValue = b.location?.name || '';
        break;
      case 'jobTitle':
        aValue = a.job_title || '';
        bValue = b.job_title || '';
        break;
      case 'department':
        aValue = a.department || '';
        bValue = b.department || '';
        break;
      case 'salary':
        aValue = a.salary || 0;
        bValue = b.salary || 0;
        break;
      case 'status':
        aValue = a.status || 'active';
        bValue = b.status || 'active';
        break;
      case 'hireDate':
        aValue = a.hire_date || '';
        bValue = b.hire_date || '';
        break;
      case 'terminationDate':
        aValue = a.termination_date || '';
        bValue = b.termination_date || '';
        break;
      default:
        return 0;
    }

    if (typeof aValue === 'string') {
      return sortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue, 'ar') 
        : bValue.localeCompare(aValue, 'ar');
    }

    return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return { key, direction: 'none' };
        return { key, direction: 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key || sortConfig.direction === 'none') return null;
    return sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-primary" /> : <ChevronDown size={12} className="text-primary" />;
  };

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, locationFilter, letterFilter, sortConfig]);

  const isHRorAdmin = userRole === 'admin' || userRole === 'hr';
  const isSectorManager = userRole === 'sector_manager';
  const canViewEmployees = isHRorAdmin || isSectorManager;

  const exportToExcel = async (type: 'current' | 'active' | 'probation' | 'suspended' | 'all') => {
    const toastId = toast.loading('جاري تجهيز ملف الاكسل...');
    
    try {
      let dataToExport: Employee[] = [];
      let fileName = 'Employees_Report';

      if (type === 'current') {
        dataToExport = filteredEmployees;
        fileName = `Employees_Filtered_${new Date().toISOString().split('T')[0]}`;
      } else if (type === 'all') {
        dataToExport = employees;
        fileName = `All_Employees_${new Date().toISOString().split('T')[0]}`;
      } else {
        dataToExport = employees.filter(emp => emp.status === type || (type === 'active' && (!emp.status || emp.status === 'active')));
        const typeNames = { active: 'نشط', probation: 'تحت_التجربة', suspended: 'متوقفين' };
        fileName = `Employees_${typeNames[type as keyof typeof typeNames] || type}_${new Date().toISOString().split('T')[0]}`;
      }

      if (dataToExport.length === 0) {
        toast.error('لا توجد بيانات لتصديرها', { id: toastId });
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('الموظفين');

      // Styles
      const headerStyle: Partial<ExcelJS.Style> = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
      };

      const cellStyle: Partial<ExcelJS.Style> = {
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
      };

      // Define Columns
      const columns = [
        { header: 'الاسم', key: 'name', width: 30 },
        { header: 'البريد الإلكتروني', key: 'email', width: 25 },
        { header: 'رقم الهاتف', key: 'phone', width: 15 },
        { header: 'القسم', key: 'department', width: 20 },
        { header: 'المسمى الوظيفي', key: 'job_title', width: 20 },
        { header: 'الموقع', key: 'location', width: 20 },
        { header: 'الوردية', key: 'shift', width: 20 },
        { header: 'الراتب', key: 'salary', width: 15 },
        { header: 'تاريخ التعيين', key: 'hire_date', width: 15 },
        { header: 'الحالة', key: 'status', width: 15 },
        { header: 'تاريخ التوقف', key: 'termination_date', width: 15 }
      ];

      worksheet.columns = columns;

      // Header Row Styling
      const headerRow = worksheet.getRow(1);
      headerRow.height = 30;
      headerRow.eachCell((cell) => {
        cell.style = headerStyle;
      });

      // Add Data
      dataToExport.forEach(emp => {
        const rowData = {
          name: emp.name,
          email: emp.email || '-',
          phone: emp.phone || '-',
          department: emp.department || '-',
          job_title: emp.job_title || '-',
          location: emp.location?.name || '-',
          shift: emp.shift?.name || '-',
          salary: emp.salary || 0,
          hire_date: emp.hire_date || '-',
          status: emp.status === 'active' || !emp.status ? 'نشط' : emp.status === 'probation' ? 'تحت التجربة' : 'متوقف',
          termination_date: emp.termination_date || '-'
        };
        const row = worksheet.addRow(rowData);
        row.eachCell((cell) => {
          cell.style = cellStyle;
        });
      });

      // Right-to-Left writing
      worksheet.views = [{ rightToLeft: true }];

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `${fileName}.xlsx`);
      
      toast.success('تم تصدير البيانات بنجاح', { id: toastId });
    } catch (error: any) {
      console.error('Export Error:', error);
      toast.error('فشل تصدير البيانات: ' + error.message, { id: toastId });
    }
  };

  if (userRole && !canViewEmployees) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
          <XCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">عذراً، ليس لديك صلاحية</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">هذه الصفحة مخصصة لمسؤولي النظام و HR فقط.</p>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-1 px-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 italic">قائمة الموظفين</h1>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-black shadow-sm border border-blue-100 dark:border-blue-800/50">
            <Users size={14} />
            <span>العدد الإجمالي: {filteredEmployees.length}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
        
        <div className="flex flex-col gap-4 lg:gap-6 flex-1 relative z-10 w-full">
          {/* Row 1: Search and Primary Filters */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
              <Input 
                placeholder={
                  searchCriteria === 'name' ? "بحث عن اسم أو بريد..." :
                  searchCriteria === 'department' ? "بحث حسب القسم..." :
                  "بحث حسب المسمى الوظيفي..."
                } 
                className="pr-12 rounded-2xl h-11 md:h-12 text-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary w-full font-bold" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center bg-slate-50/50 dark:bg-slate-800/30 p-1 rounded-2xl border border-slate-100 dark:border-slate-800/50 overflow-x-auto no-scrollbar scroll-smooth">
              <div className="flex items-center min-w-max">
                <Select value={searchCriteria} onValueChange={(val: any) => setSearchCriteria(val)}>
                  <SelectTrigger className="h-8 md:h-9 w-28 md:w-32 border-none bg-transparent font-black text-[10px] md:text-xs shadow-none hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <SelectValue placeholder="بحث حسب" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value="name" className="rounded-xl font-bold">الاسم والبريد</SelectItem>
                    <SelectItem value="department" className="rounded-xl font-bold">القسم</SelectItem>
                    <SelectItem value="job_title" className="rounded-xl font-bold">المسمى</SelectItem>
                  </SelectContent>
                </Select>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                <Select value={locationFilter} onValueChange={setLocationFilter} disabled={isSectorManager}>
                  <SelectTrigger className="h-8 md:h-9 w-32 md:w-40 border-none bg-transparent font-black text-[10px] md:text-xs shadow-none hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <MapPin size={12} className="ml-1 text-primary" />
                    <SelectValue placeholder="الموقع">
                      {locationFilter === 'all' ? 'جميع المواقع' : locations.find(l => String(l.id) === String(locationFilter))?.name || locationFilter}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    {!isSectorManager && <SelectItem value="all" className="rounded-xl font-bold italic">جميع المواقع</SelectItem>}
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={String(loc.id)} className="rounded-xl font-bold">{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                <Select 
                  value={sortConfig.key === 'name' ? (sortConfig.direction === 'none' ? 'none' : `name-${sortConfig.direction}`) : 'none'} 
                  onValueChange={(val: any) => {
                    if (val === 'none') setSortConfig({ key: 'name', direction: 'none' });
                    else if (val === 'name-asc') setSortConfig({ key: 'name', direction: 'asc' });
                    else if (val === 'name-desc') setSortConfig({ key: 'name', direction: 'desc' });
                  }}
                >
                  <SelectTrigger className="h-8 md:h-9 w-32 md:w-40 border-none bg-transparent font-black text-[10px] md:text-xs shadow-none hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <ArrowDownAZ size={12} className="ml-1 text-blue-500" />
                    <SelectValue placeholder="ترتيب الموظفين" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value="none" className="rounded-xl font-bold">بدون ترتيب (الأحدث)</SelectItem>
                    <SelectItem value="name-asc" className="rounded-xl font-bold">الاسم (أ - ي)</SelectItem>
                    <SelectItem value="name-desc" className="rounded-xl font-bold">الاسم (ي - أ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Row 2: Tabs and View Settings */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="flex bg-slate-50/80 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-100 dark:border-slate-800/50 overflow-x-auto no-scrollbar">
                <div className="flex items-center min-w-max">
                  <button onClick={() => setCurrentTab('active')} className={`px-4 md:px-6 py-2 text-[10px] md:text-xs font-black rounded-xl transition-all ${currentTab === 'active' ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>الموظفين المثبتين</button>
                  <button onClick={() => setCurrentTab('probation')} className={`px-4 md:px-6 py-2 text-[10px] md:text-xs font-black rounded-xl transition-all ${currentTab === 'probation' ? 'bg-white dark:bg-slate-900 text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>تحت التجربة</button>
                  <button onClick={() => setCurrentTab('suspended')} className={`px-4 md:px-6 py-2 text-[10px] md:text-xs font-black rounded-xl transition-all ${currentTab === 'suspended' ? 'bg-white dark:bg-slate-900 text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>الخدمة المتوقفة</button>
                </div>
              </div>

              <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm w-fit">
                <Select value={groupBy} onValueChange={(val: any) => setGroupBy(val)}>
                  <SelectTrigger className="h-7 md:h-8 w-28 md:w-36 border-none bg-transparent font-black text-[10px] md:text-[11px] shadow-none hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors px-2 md:px-3">
                    <SelectValue placeholder="تجميع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون تجميع</SelectItem>
                    <SelectItem value="department">القسم</SelectItem>
                    <SelectItem value="location">الموقع</SelectItem>
                  </SelectContent>
                </Select>
                <div className="w-px h-3 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                <div className="flex items-center">
                  <button onClick={() => setDensity('comfortable')} className={`p-1.5 rounded-lg transition-all ${density === 'comfortable' ? 'bg-slate-100 dark:bg-slate-800 text-primary' : 'text-slate-400'}`} title="عرض مريح"><Users size={14} /></button>
                  <button onClick={() => setDensity('compact')} className={`p-1.5 rounded-lg transition-all ${density === 'compact' ? 'bg-slate-100 dark:bg-slate-800 text-primary' : 'text-slate-400'}`} title="عرض مضغوط"><LayoutGrid size={14} /></button>
                </div>
                <div className="w-px h-3 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                <div className="flex items-center">
                  <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-slate-100 dark:bg-slate-800 text-primary' : 'text-slate-400'}`} title="عرض الجدول"><List size={14} /></button>
                  <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-100 dark:bg-slate-800 text-primary' : 'text-slate-400'}`} title="عرض الشبكة"><LayoutGrid size={14} /></button>
                </div>
              </div>
            </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                <div className="flex items-center gap-2 min-w-max">
                  <Popover>
                    <PopoverTrigger render={
                      <Button variant="outline" className="rounded-xl h-9 md:h-10 text-[10px] md:text-xs font-bold border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 md:px-4">
                        <Filter size={14} className="ml-1.5 text-slate-400" />
                        تصفية
                      </Button>
                    } />
                  <PopoverContent className="w-80 p-4 rounded-3xl" align="end">
                    <div className="grid grid-cols-7 gap-2">
                      <button onClick={() => setLetterFilter('all')} className={`h-8 rounded-lg text-xs font-bold transition-all ${letterFilter === 'all' ? 'bg-primary text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100'}`}>الكل</button>
                      {alphabet.map(letter => (
                        <button key={letter} onClick={() => setLetterFilter(letter)} className={`h-8 rounded-lg text-xs font-bold transition-all ${letterFilter === letter ? 'bg-primary text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100'}`}>{letter}</button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger render={
                    <Button variant="outline" className="rounded-xl h-9 md:h-10 text-[10px] md:text-xs font-bold border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 md:px-4">
                      <Settings2 size={14} className="ml-1.5 text-slate-400" />
                      الأعمدة
                    </Button>
                  } />
                  <PopoverContent className="w-64 p-4 rounded-3xl" align="end" dir="rtl">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={columnOrder} strategy={verticalListSortingStrategy}>
                        <div className="space-y-1">
                          {columnOrder.map((colId) => (
                            <SortableColumnItem 
                              key={colId} id={colId} 
                              label={colId === 'employee' ? 'الموظف' : colId === 'email' ? 'البريد' : colId === 'location' ? 'الموقع' : colId === 'jobTitle' ? 'المسمى' : colId === 'department' ? 'القسم' : colId === 'salary' ? 'الراتب' : colId === 'status' ? 'الحالة' : colId === 'hireDate' ? 'التعيين' : 'التوقف'} 
                              checked={(visibleColumns as any)[colId]} onCheckedChange={() => toggleColumn(colId as any)} 
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>

                    <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">تفاصيل تحت الاسم</h4>
                      <div className="space-y-4 px-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">المسمى الوظيفي</Label>
                          <Switch checked={visibleColumns.jobTitleDetail} onCheckedChange={() => toggleColumn('jobTitleDetail')} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">القسم</Label>
                          <Switch checked={visibleColumns.departmentDetail} onCheckedChange={() => toggleColumn('departmentDetail')} />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                
                <Popover>
                  <PopoverTrigger render={
                    <Button variant="outline" className="rounded-xl h-9 md:h-10 text-[10px] md:text-xs font-bold border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/10 text-green-600 px-3 md:px-4">
                      <FileText size={14} className="ml-1.5" />
                      تصدير
                    </Button>
                  } />
                  <PopoverContent className="w-48 p-2 rounded-2xl" align="end" dir="rtl">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => exportToExcel('current')} className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg transition-colors text-right">
                        <Search size={14} className="text-slate-400" />
                        تصدير العرض الحالي
                      </button>
                      <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                      <button onClick={() => exportToExcel('active')} className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors text-right">
                        <UserCheck size={14} />
                        تصدير النشطين
                      </button>
                      <button onClick={() => exportToExcel('probation')} className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors text-right">
                        <Activity size={14} />
                        تصدير تحت التجربة
                      </button>
                      <button onClick={() => exportToExcel('suspended')} className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-right">
                        <UserMinus size={14} />
                        تصدير المتوقفين
                      </button>
                      <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                      <button onClick={() => exportToExcel('all')} className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors text-right">
                        <Users size={14} />
                        تصدير الكافة
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                <Button variant="outline" size="icon" className="rounded-xl h-9 w-9 md:h-10 md:w-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" onClick={() => window.print()} title="طباعة">
                  <Printer size={16} className="text-slate-500" />
                </Button>

                {(searchQuery || locationFilter !== 'all' || letterFilter !== 'all' || currentTab !== 'active') && (
                  <Button variant="ghost" className="h-9 md:h-10 rounded-xl px-3 md:px-4 text-[10px] md:text-xs font-bold text-red-500 hover:bg-red-50" onClick={clearFilters}>
                    <XCircle size={14} className="ml-1.5" />
                    مسح
                  </Button>
                )}

                {isHRorAdmin && (
                  <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger render={
                      <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-9 md:h-10 px-3 md:px-6 text-[11px] md:text-xs font-black shadow-lg transition-all active:scale-95">
                        <UserPlus size={14} className="ml-1.5" />
                        موظف جديد
                      </Button>
                    } />
                  <DialogContent className="sm:max-w-lg rounded-2xl border-none shadow-2xl p-0 overflow-hidden" dir="rtl">
                    <div className="bg-slate-50 dark:bg-slate-800/50 px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <DialogHeader>
                        <DialogTitle className="text-lg font-black flex items-center gap-2 text-slate-800 dark:text-white">
                          <UserPlus className="text-primary" size={20} />
                          إضافة موظف جديد
                        </DialogTitle>
                      </DialogHeader>
                    </div>
                    
                    <form onSubmit={handleAddEmployee} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                          <User size={14} />
                          المعلومات الأساسية
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-slate-500 mr-1">الاسم الكامل</Label>
                            <div className="relative">
                              <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <Input 
                                className="h-10 pr-10 rounded-xl border-slate-200 focus:border-primary transition-all bg-slate-50/50"
                                placeholder="أدخل اسم الموظف الرباعي..."
                                value={newEmployee.name || ''}
                                onChange={e => setNewEmployee({...newEmployee, name: e.target.value})}
                                required 
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-slate-500 mr-1">رقم الموظف (ID)</Label>
                            <div className="relative">
                              <Hash className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <Input 
                                className="h-10 pr-10 rounded-xl border-slate-200 focus:border-primary transition-all bg-slate-50/50 font-mono"
                                placeholder="أدخل الرقم الوظيفي..."
                                value={newEmployee.employee_number || ''}
                                onChange={e => setNewEmployee({...newEmployee, employee_number: e.target.value})}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-slate-500 mr-1">البريد الإلكتروني</Label>
                            <div className="relative">
                              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <Input 
                                className="h-10 pr-10 rounded-xl border-slate-200 focus:border-primary transition-all bg-slate-50/50"
                                type="email"
                                placeholder="name@company.com"
                                value={newEmployee.email || ''}
                                onChange={e => setNewEmployee({...newEmployee, email: e.target.value})}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-slate-500 mr-1">رقم الهاتف</Label>
                            <div className="relative">
                              <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <Input 
                                className="h-10 pr-10 rounded-xl border-slate-200 focus:border-primary transition-all bg-slate-50/50"
                                placeholder="07XXXXXXXX"
                                value={newEmployee.phone || ''}
                                onChange={e => setNewEmployee({...newEmployee, phone: e.target.value})}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                          <Briefcase size={14} />
                          التفاصيل الوظيفية
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-slate-500 mr-1">القسم</Label>
                            <Input 
                              className="h-10 rounded-xl border-slate-200 focus:border-primary transition-all bg-slate-50/50"
                              value={newEmployee.department || ''}
                              onChange={e => setNewEmployee({...newEmployee, department: e.target.value})}
                              placeholder="مثل: تقنية المعلومات"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-slate-500 mr-1">المسمى الوظيفي</Label>
                            <Input 
                              className="h-10 rounded-xl border-slate-200 focus:border-primary transition-all bg-slate-50/50"
                              value={newEmployee.job_title || ''}
                              onChange={e => setNewEmployee({...newEmployee, job_title: e.target.value})}
                              placeholder="مثل: مبرمج أول"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-slate-500 mr-1">الراتب الأساسي</Label>
                            <div className="relative">
                              <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <Input 
                                className="h-10 pr-10 rounded-xl border-slate-200 focus:border-primary transition-all bg-slate-50/50 font-bold text-blue-600"
                                type="number"
                                value={newEmployee.salary ?? ''}
                                onChange={e => {
                                  const val = parseFloat(e.target.value);
                                  setNewEmployee({...newEmployee, salary: isNaN(val) ? 0 : val});
                                }}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-slate-500 mr-1">تاريخ التعيين</Label>
                            <div className="relative">
                              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <Input 
                                className="h-10 pr-10 rounded-xl border-slate-200 focus:border-primary transition-all bg-slate-50/50"
                                type="date"
                                value={newEmployee.hire_date || ''}
                                onChange={e => setNewEmployee({...newEmployee, hire_date: e.target.value})}
                              />
                            </div>
                          </div>

                          {newEmployee.status === 'inactive' && (
                            <div className="space-y-1.5 col-span-2">
                              <Label className="text-[11px] font-bold text-red-500 mr-1">تاريخ التوقف عن الخدمة</Label>
                              <Input 
                                className="h-10 rounded-xl border-red-100 bg-red-50/30"
                                type="date"
                                value={newEmployee.termination_date || ''}
                                onChange={e => setNewEmployee({...newEmployee, termination_date: e.target.value})}
                              />
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-slate-500 mr-1">موقع العمل</Label>
                            <Select 
                              value={newEmployee.location_id || 'none'}
                              onValueChange={val => setNewEmployee({...newEmployee, location_id: val === 'none' ? '' : val})}
                            >
                              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50/50 transition-all flex justify-between px-3">
                        <SelectValue placeholder="اختر الموقع">
                          {locations.find(l => String(l.id) === String(newEmployee.location_id))?.name || 
                           (newEmployee.location_id && newEmployee.location_id !== 'none' && newEmployee.location_id !== '' 
                            ? (locations.length === 0 ? 'جاري التحميل...' : String(newEmployee.location_id)) 
                            : null)}
                        </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="rounded-xl shadow-xl border-slate-100">
                                <SelectItem value="none" className="text-xs">بدون موقع</SelectItem>
                                {locations.map(loc => (
                                <SelectItem key={loc.id} value={String(loc.id)} className="text-xs font-bold">{loc.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[11px] font-bold text-slate-500 mr-1">الوردية</Label>
                            <Select 
                              value={newEmployee.shift_id || 'none'}
                              onValueChange={val => setNewEmployee({...newEmployee, shift_id: val === 'none' ? null : val})}
                            >
                              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50/50 transition-all flex justify-between px-3">
                        <SelectValue placeholder="اختر الوردية">
                          {shifts.find(s => String(s.id) === String(newEmployee.shift_id))?.name || 
                           (newEmployee.shift_id && newEmployee.shift_id !== 'none' && newEmployee.shift_id !== '' 
                            ? (shifts.length === 0 ? 'جاري التحميل...' : String(newEmployee.shift_id)) 
                            : null)}
                        </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="rounded-xl shadow-xl border-slate-100">
                                <SelectItem value="none" className="text-xs">بدون وردية</SelectItem>
                                {shifts.map(shift => (
                                <SelectItem key={shift.id} value={String(shift.id)} className="text-xs font-bold">{shift.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Settings2 size={14} />
                            إعدادات الحضور الذكي
                          </h4>
                          <Badge variant="outline" className="text-[9px] font-black py-0 h-5 border-teal-100 text-teal-600 bg-teal-50">خيار متقدم</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-5 bg-teal-50/30 dark:bg-slate-800/30 p-6 rounded-[24px] border border-teal-100/50 dark:border-slate-700/50">
                          <div className="space-y-2">
                             <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">طريقة التحقق المطلوبة</Label>
                             <Select value={attendanceMethod} onValueChange={(v: any) => setAttendanceMethod(v)}>
                               <SelectTrigger className="rounded-xl h-10 border-teal-100 bg-white px-3">
                                 <SelectValue placeholder="اختر الطريقة" />
                               </SelectTrigger>
                               <SelectContent className="rounded-xl">
                                 <SelectItem value="gps" className="text-xs font-bold">الموقع الجغرافي (GPS) فقط</SelectItem>
                                 <SelectItem value="gps_photo" className="text-xs font-bold">الموقع الجغرافي + بصمة الوجه (3D)</SelectItem>
                                 <SelectItem value="gps_biometric" className="text-xs font-bold">الموقع الجغرافي + بصمة الإصبع</SelectItem>
                               </SelectContent>
                             </Select>
                          </div>
                          <div className="space-y-3">
                             <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">المواقع المسموح التسجيل منها</Label>
                             <div className="grid grid-cols-2 gap-2">
                               {allSmartLocations.map(loc => (
                                 <motion.button
                                   type="button"
                                   key={loc.id}
                                   whileHover={{ scale: 1.02 }}
                                   whileTap={{ scale: 0.98 }}
                                   onClick={() => {
                                     if (selectedSmartLocations.includes(loc.id)) setSelectedSmartLocations(selectedSmartLocations.filter(id => id !== loc.id));
                                     else setSelectedSmartLocations([...selectedSmartLocations, loc.id]);
                                   }}
                                   className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-right ${
                                     selectedSmartLocations.includes(loc.id)
                                     ? 'bg-teal-500 text-white border-teal-600 shadow-md shadow-teal-500/20'
                                     : 'bg-white dark:bg-slate-900 text-slate-600 border-slate-100 hover:border-teal-200'
                                   }`}
                                 >
                                   <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${selectedSmartLocations.includes(loc.id) ? 'bg-white/20 border-white/40' : 'bg-slate-50 border-slate-200'}`}>
                                     {selectedSmartLocations.includes(loc.id) && <UserCheck size={12} />}
                                   </div>
                                   <span className="text-[11px] font-bold truncate flex-1">{loc.name}</span>
                                 </motion.button>
                               ))}
                             </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-8 flex flex-col gap-3">
                        <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12 text-sm font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                          <UserPlus size={18} />
                          حفظ بيانات الموظف والبدء في سجله
                        </Button>
                        <p className="text-center text-[10px] text-slate-400">ستتم إضافة الموظف فوراً وبدء احتساب بيانات حضوره من تاريخ التعيين المحدد.</p>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
          
          {/* Main Content Area */}
          <div className="flex-1">

        {/* Edit Employee Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-lg rounded-2xl border-none shadow-2xl p-0 overflow-hidden" dir="rtl">
            <div className="bg-slate-50 dark:bg-slate-800/50 px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <DialogHeader>
                <DialogTitle className="text-lg font-black flex items-center gap-2 text-slate-800 dark:text-white">
                  <Edit2 className="text-blue-500" size={20} />
                  تعديل بيانات الموظف
                </DialogTitle>
              </DialogHeader>
              <Badge variant="outline" className="text-slate-400 border-slate-200 px-3 py-1 rounded-full text-[10px] font-bold">
                ID: {editingEmployee?.id.slice(0, 8)}...
              </Badge>
            </div>
            
            <form onSubmit={handleUpdateEmployee} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                  <User size={14} />
                  الهوية والاتصال
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-500 mr-1">الاسم الكامل</Label>
                    <div className="relative">
                      <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <Input 
                        className="h-10 pr-10 rounded-xl border-slate-200 focus:border-blue-500 transition-all bg-slate-50/50"
                        value={newEmployee.name || ''}
                        onChange={e => setNewEmployee({...newEmployee, name: e.target.value})}
                        required 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-500 mr-1">رقم الموظف (ID)</Label>
                    <div className="relative">
                      <Hash className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <Input 
                        className="h-10 pr-10 rounded-xl border-slate-200 focus:border-blue-500 transition-all bg-slate-50/50 font-mono"
                        placeholder="رقم الموظف..."
                        value={newEmployee.employee_number || ''}
                        onChange={e => setNewEmployee({...newEmployee, employee_number: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-500 mr-1">البريد الإلكتروني</Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <Input 
                        className="h-10 pr-10 rounded-xl border-slate-200 focus:border-blue-500 transition-all bg-slate-50/50"
                        type="email"
                        value={newEmployee.email || ''}
                        onChange={e => setNewEmployee({...newEmployee, email: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-500 mr-1">رقم الهاتف</Label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <Input 
                        className="h-10 pr-10 rounded-xl border-slate-200 focus:border-blue-500 transition-all bg-slate-50/50"
                        value={newEmployee.phone || ''}
                        onChange={e => setNewEmployee({...newEmployee, phone: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                  <Briefcase size={14} />
                  البيانات الوظيفية والمالية
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-500 mr-1">القسم</Label>
                    <Input 
                      className="h-10 rounded-xl border-slate-200 focus:border-blue-500 transition-all bg-slate-50/50"
                      value={newEmployee.department || ''}
                      onChange={e => setNewEmployee({...newEmployee, department: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-500 mr-1">المسمى الوظيفي</Label>
                    <Input 
                      className="h-10 rounded-xl border-slate-200 focus:border-blue-500 transition-all bg-slate-50/50"
                      value={newEmployee.job_title || ''}
                      onChange={e => setNewEmployee({...newEmployee, job_title: e.target.value})}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-500 mr-1">الراتب الأساسي</Label>
                    <div className="relative">
                      <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <Input 
                        className="h-10 pr-10 rounded-xl border-slate-200 focus:border-blue-500 transition-all bg-slate-50/50 font-bold text-blue-600"
                        type="number"
                        value={newEmployee.salary ?? ''}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          setNewEmployee({...newEmployee, salary: isNaN(val) ? 0 : val});
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-500 mr-1">تاريخ التعيين</Label>
                    <div className="relative">
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <Input 
                        className="h-10 pr-10 rounded-xl border-slate-200 focus:border-blue-500 transition-all bg-slate-50/50"
                        type="date"
                        value={newEmployee.hire_date || ''}
                        onChange={e => setNewEmployee({...newEmployee, hire_date: e.target.value})}
                      />
                    </div>
                  </div>

                  {editingEmployee?.status === 'inactive' && (
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-[11px] font-bold text-red-500 mr-1">تاريخ التوقف عن الخدمة</Label>
                      <Input 
                        className="h-11 rounded-xl border-red-100 bg-red-50/30"
                        type="date"
                        value={newEmployee.termination_date || ''}
                        onChange={e => setNewEmployee({...newEmployee, termination_date: e.target.value})}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-500 mr-1">موقع العمل</Label>
                    <Select 
                      value={newEmployee.location_id || 'none'}
                      onValueChange={val => setNewEmployee({...newEmployee, location_id: val === 'none' ? '' : val})}
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50/50 transition-all flex justify-between px-3">
                        <SelectValue placeholder="اختر الموقع">
                          {locations.find(l => String(l.id) === String((newEmployee as any).location_id))?.name || 
                           (String(editingEmployee?.location_id) === String((newEmployee as any).location_id) ? editingEmployee?.location?.name : null) || 
                           ((newEmployee as any).location_id && (newEmployee as any).location_id !== 'none' && (newEmployee as any).location_id !== '' 
                            ? (locations.length === 0 ? 'جاري التحميل...' : String((newEmployee as any).location_id)) 
                            : null)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-xl border-slate-100">
                        <SelectItem value="none" className="text-xs">بدون موقع</SelectItem>
                        {locations.map(loc => (
                          <SelectItem key={loc.id} value={String(loc.id)} className="text-xs font-bold">{loc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-500 mr-1">الوردية</Label>
                    <Select 
                      value={newEmployee.shift_id || 'none'}
                      onValueChange={val => setNewEmployee({...newEmployee, shift_id: val === 'none' ? null : val})}
                    >
                      <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50/50 transition-all flex justify-between px-3">
                        <SelectValue placeholder="اختر الوردية">
                          {shifts.find(s => String(s.id) === String((newEmployee as any).shift_id))?.name || 
                           (String(editingEmployee?.shift_id) === String((newEmployee as any).shift_id) ? editingEmployee?.shift?.name : null) ||
                           ((newEmployee as any).shift_id && (newEmployee as any).shift_id !== 'none' && (newEmployee as any).shift_id !== '' 
                            ? (shifts.length === 0 ? 'جاري التحميل...' : String((newEmployee as any).shift_id)) 
                            : null)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-xl border-slate-100">
                        <SelectItem value="none" className="text-xs">بدون وردية</SelectItem>
                        {shifts.map(shift => (
                          <SelectItem key={shift.id} value={String(shift.id)} className="text-xs font-bold">{shift.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Settings2 size={14} />
                    إعدادات الحضور الذكي
                  </h4>
                  <Badge variant="outline" className="text-[9px] font-black py-0 h-5 border-blue-100 text-blue-600 bg-blue-50">خيار متقدم</Badge>
                </div>
                
                <div className="grid grid-cols-1 gap-5 bg-blue-50/30 dark:bg-slate-800/30 p-5 rounded-2xl border border-blue-100/50 dark:border-slate-700/50">
                  <div className="space-y-2">
                     <div className="flex items-center justify-between mb-1">
                       <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">طريقة التحقق المطلوبة</Label>
                       {newEmployee.biometric_credential_id && (
                         <Button 
                           type="button"
                           variant="ghost" 
                           size="sm" 
                           className="h-6 text-[9px] font-black text-red-500 hover:text-red-600 hover:bg-red-50 border border-red-100 px-2 rounded-lg"
                           onClick={() => setNewEmployee({...newEmployee, biometric_credential_id: undefined})}
                         >
                           <Trash2 size={10} className="ml-1" />
                           مسح البصمة المسجلة
                         </Button>
                       )}
                     </div>
                     <Select value={attendanceMethod} onValueChange={(v: any) => setAttendanceMethod(v)}>
                       <SelectTrigger className="rounded-xl h-10 w-full border-blue-100 bg-white shadow-sm flex justify-between px-3">
                         <SelectValue placeholder="اختر الطريقة">
                            {String(attendanceMethod) === 'gps' ? 'الموقع الجغرافي (GPS) فقط' : 
                             String(attendanceMethod) === 'gps_photo' ? 'الموقع الجغرافي + بصمة الوجه (3D)' : 
                             String(attendanceMethod) === 'gps_biometric' ? 'الموقع الجغرافي + بصمة الإصبع' : 
                             String(attendanceMethod)}
                         </SelectValue>
                       </SelectTrigger>
                       <SelectContent className="rounded-xl shadow-2xl border-slate-100">
                         <SelectItem value="gps" className="text-xs font-bold">الموقع الجغرافي (GPS) فقط</SelectItem>
                         <SelectItem value="gps_photo" className="text-xs font-bold">الموقع الجغرافي + بصمة الوجه (3D)</SelectItem>
                         <SelectItem value="gps_biometric" className="text-xs font-bold">الموقع الجغرافي + بصمة الإصبع</SelectItem>
                       </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-3">
                     <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">المواقع المسموح التسجيل منها</Label>
                     <div className="grid grid-cols-2 gap-2">
                       {allSmartLocations.map(loc => (
                         <motion.button
                           type="button"
                           key={loc.id}
                           whileHover={{ scale: 1.02 }}
                           whileTap={{ scale: 0.98 }}
                           onClick={() => {
                             if (selectedSmartLocations.includes(loc.id)) setSelectedSmartLocations(selectedSmartLocations.filter(id => id !== loc.id));
                             else setSelectedSmartLocations([...selectedSmartLocations, loc.id]);
                           }}
                           className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-right ${
                             selectedSmartLocations.includes(loc.id)
                             ? 'bg-blue-600 text-white border-blue-700 shadow-md shadow-blue-500/20'
                             : 'bg-white dark:bg-slate-900 text-slate-600 border-slate-100 hover:border-blue-200'
                           }`}
                         >
                           <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${selectedSmartLocations.includes(loc.id) ? 'bg-white/20 border-white/40' : 'bg-slate-50 border-slate-200'}`}>
                             {selectedSmartLocations.includes(loc.id) && <UserCheck size={12} />}
                           </div>
                           <span className="text-[11px] font-bold truncate flex-1">{loc.name}</span>
                         </motion.button>
                       ))}
                     </div>
                  </div>
                </div>
              </div>

              <div className="pt-8 flex flex-col gap-3">
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 text-sm font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Activity size={18} />
                  تحديث ملف الموظف وحفظ التغييرات
                </Button>
                <p className="text-center text-[10px] text-slate-400">سيتم تطبيق التغييرات فوراً على حساب الموظف وإعدادات الحضور الخاصة به.</p>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="sm:max-w-md rounded-xl border-none shadow-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-red-600">تأكيد الحذف</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-slate-600 dark:text-slate-400">
                هل أنت متأكد من رغبتك في حذف الموظف <span className="font-bold text-slate-900 dark:text-slate-100">{employeeToDelete?.name}</span>؟
                <br />
                <span className="text-sm text-red-500 mt-2 block">هذا الإجراء لا يمكن التراجع عنه.</span>
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setIsDeleteOpen(false)}
                className="rounded-lg"
              >
                إلغاء
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleConfirmDelete}
                className="rounded-lg bg-red-600 hover:bg-red-700"
              >
                تأكيد الحذف
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
          <DialogContent className="sm:max-w-md rounded-xl border-none shadow-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="text-blue-600" />
                إدارة حساب الدخول
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{employeeForLogin?.name}</p>
                <p className="text-xs text-slate-500">{employeeForLogin?.email}</p>
              </div>

              {!registeredEmails.has(employeeForLogin?.email || '') ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500">كلمة المرور المؤقتة</Label>
                    <Input 
                      type="text"
                      className="h-11 rounded-xl bg-white"
                      value={customPassword}
                      onChange={e => setCustomPassword(e.target.value)}
                      placeholder="كلمة المرور..."
                    />
                    <p className="text-[10px] text-slate-400">سيتم إنشاء حساب جديد بهذا البريد وكلمة المرور المحددة.</p>
                  </div>
                  <Button 
                    onClick={handleCreateLogin}
                    className="w-full bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    إنشاء حساب دخول
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-green-600 font-medium flex items-center gap-1.5 bg-green-50 p-3 rounded-xl border border-green-100">
                    <ShieldCheck size={16} />
                    هذا الموظف يمتلك حساباً نشطاً بالفعل.
                  </p>
                  
                  <div className="border border-slate-100 dark:border-slate-800 p-5 rounded-2xl space-y-4 bg-slate-50/50">
                    <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">تغيير كلمة المرور يدوياً</h4>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500">كلمة المرور الجديدة</Label>
                      <Input 
                        type="text"
                        className="h-11 rounded-xl bg-white border-slate-200"
                        value={customPassword}
                        onChange={e => setCustomPassword(e.target.value)}
                        placeholder="أدخل كلمة المرور الجديدة..."
                      />
                    </div>
                    <Button 
                      onClick={handleUpdateUserPassword}
                      disabled={isUpdatingPassword}
                      className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-11 text-xs font-black"
                    >
                      {isUpdatingPassword ? 'جاري التحديث...' : 'تحديث كلمة المرور الآن'}
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-px bg-slate-100 flex-1"></div>
                    <span className="text-[10px] font-bold text-slate-400">أو</span>
                    <div className="h-px bg-slate-100 flex-1"></div>
                  </div>

                  <div className="border border-slate-100 dark:border-slate-800 p-4 rounded-xl space-y-3">
                    <p className="text-[10px] text-slate-400">يمكنك إرسال رابط للموظف ليقوم بتغيير كلمة المرور بنفسه.</p>
                    <Button 
                      onClick={handleSendResetEmail}
                      variant="outline"
                      className="w-full border-blue-200 dark:border-blue-800 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-xs font-bold rounded-xl"
                    >
                      إرسال رابط استعادة كلمة المرور
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="sm:max-w-md rounded-[28px] border-none shadow-3xl bg-white dark:bg-slate-900 p-0 overflow-hidden" dir="rtl">
            <div className="relative max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="p-5">
                {/* Profile Header - Compact */}
                <div className="flex flex-row gap-4 items-center mb-5 pb-5 border-b border-slate-100 dark:border-slate-800">
                  <div className="shrink-0 relative">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center p-1 border border-slate-100 dark:border-slate-700">
                      <div className={`w-full h-full ${getAvatarGradient(selectedDetailsEmployee?.name || '')} text-white rounded-xl flex items-center justify-center font-black text-xl shadow-inner`}>
                        {selectedDetailsEmployee?.name?.[0]}
                      </div>
                    </div>
                    {(selectedDetailsEmployee?.face_descriptor || selectedDetailsEmployee?.biometric_credential_id) && (
                      <div className="absolute -bottom-1 -left-1 bg-teal-500 text-white p-1 rounded-lg shadow-md border-2 border-white dark:border-slate-900">
                        <ShieldCheck size={10} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-right">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">{selectedDetailsEmployee?.name}</h2>
                      <Badge className="rounded-md px-1.5 py-0 text-[8px] font-black uppercase bg-green-500/10 text-green-600 border-green-200 dark:bg-green-500/20 dark:border-green-800">نشط</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Briefcase size={10} className="text-primary" />
                        <span className="text-[10px] font-bold">{selectedDetailsEmployee?.job_title}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-900 rounded-2xl p-4 text-white relative overflow-hidden">
                    <DollarSign size={40} className="absolute -right-2 -bottom-2 opacity-10" />
                    <p className="text-[8px] font-black opacity-50 uppercase mb-1">الراتب الشهري</p>
                    <h4 className="text-xl font-black text-amber-400">{selectedDetailsEmployee?.salary?.toLocaleString()} <span className="text-[9px] text-white/40">IQD</span></h4>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                    <p className="text-[8px] font-black text-slate-400 uppercase">الالتزام</p>
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center">
                         <span className="text-[9px] font-black text-blue-600">{performanceData ? Math.round((performanceData.present / (performanceData.present + performanceData.absent || 1)) * 100) : 0}%</span>
                       </div>
                       <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-green-600">{performanceData?.present || 0} حضور</span>
                        <span className="text-[9px] font-bold text-red-600">{performanceData?.absent || 0} غياب</span>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 space-y-3">
                  {selectedDetailsEmployee?.employee_number && (
                    <div className="flex items-center gap-3">
                      <Hash size={14} className="text-slate-400" />
                      <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                        رقم الموظف: {selectedDetailsEmployee.employee_number}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Mail size={14} className="text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{selectedDetailsEmployee?.email || 'غير متوفر'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone size={14} className="text-slate-400" />
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{selectedDetailsEmployee?.phone || 'غير متوفر'}</span>
                  </div>
                </div>

                <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <Button variant="ghost" className="flex-1 h-10 rounded-xl text-xs font-bold text-slate-500" onClick={() => setIsDetailsOpen(false)}>إغلاق</Button>
                  {isHRorAdmin && (
                    <Button 
                      className="flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-lg shadow-blue-500/20"
                      onClick={() => {
                        setIsDetailsOpen(false);
                        handleEditEmployee(selectedDetailsEmployee!);
                      }}
                    >
                      تعديل الملف
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      
      <div className="hidden print:block mb-8 text-center border-b pb-6">
        <h1 className="text-3xl font-black mb-2">قائمة الموظفين</h1>
        <p className="text-slate-500 font-bold">تاريخ الطباعة: {new Date().toLocaleDateString('ar-SA')}</p>
        <div className="flex justify-center gap-6 mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <span>العدد الإجمالي: {filteredEmployees.length}</span>
          <span>الموقع: {locationFilter === 'all' ? 'الكل' : (locations.find(l => String(l.id) === String(locationFilter))?.name)}</span>
        </div>
      </div>

      {/* Print-only Full List Table */}
      <div className="hidden print:block w-full">
        <Table className="w-full border-collapse">
          <TableHeader>
            <TableRow className="border-b-2 border-slate-900 text-right">
              {columnOrder.map(colId => {
                if (!(visibleColumns as any)[colId]) return null;
                const labels: Record<string, string> = {
                  employee: 'الموظف',
                  employee_number: 'رقم الموظف',
                  email: 'البريد الإلكتروني',
                  location: 'الموقع',
                  jobTitle: 'المسمى الوظيفي',
                  department: 'القسم',
                  salary: 'الراتب',
                  status: 'الحالة',
                  hireDate: 'تاريخ التعيين'
                };
                return (
                  <TableHead key={colId} className="text-right py-4 font-black text-slate-950">
                    {labels[colId]}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.map((emp) => (
              <TableRow key={emp.id} className="border-b border-slate-200">
                {columnOrder.map(colId => {
                  if (!(visibleColumns as any)[colId]) return null;
                  
                  switch (colId) {
                    case 'employee':
                      return (
                        <TableCell key={colId} className="py-3 text-right">
                          <p className="font-bold text-slate-900">{emp.name}</p>
                          <div className="flex gap-2 text-[10px] text-slate-500">
                            {visibleColumns.jobTitleDetail && <span>{emp.job_title}</span>}
                            {visibleColumns.departmentDetail && <span>{emp.department}</span>}
                          </div>
                        </TableCell>
                      );
                    case 'employee_number':
                      return (
                        <TableCell key={colId} className="py-3 text-xs text-right font-mono font-bold text-slate-600">
                          {emp.employee_number || '---'}
                        </TableCell>
                      );
                    case 'email':
                      return (
                        <TableCell key={colId} className="py-3 text-xs text-right">
                          {emp.email}
                        </TableCell>
                      );
                    case 'location':
                      return (
                        <TableCell key={colId} className="py-3 text-xs text-right">
                          {emp.location?.name || 'غير محدد'}
                        </TableCell>
                      );
                    case 'jobTitle':
                      return (
                        <TableCell key={colId} className="py-3 text-xs text-right">
                          {emp.job_title}
                        </TableCell>
                      );
                    case 'department':
                      return (
                        <TableCell key={colId} className="py-3 text-xs text-right">
                          {emp.department}
                        </TableCell>
                      );
                    case 'salary':
                      return (
                        <TableCell key={colId} className="py-3 text-xs font-bold text-blue-700 text-right">
                          {emp.salary?.toLocaleString()} $
                        </TableCell>
                      );
                    case 'status':
                      return (
                        <TableCell key={colId} className="py-3 text-xs text-right">
                          {(!emp.status || emp.status === 'active') ? 'نشط' : 'متوقف'}
                        </TableCell>
                      );
                    case 'hireDate':
                      return (
                        <TableCell key={colId} className="py-3 text-xs text-right">
                          {emp.hire_date}
                        </TableCell>
                      );
                    default:
                      return null;
                  }
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {viewMode === 'table' ? (
        <div className="panel shadow-sm overflow-hidden border-slate-100 dark:border-slate-800 rounded-[24px] bg-white dark:bg-slate-900 print:hidden transition-all duration-300">
          <Table className="min-w-[800px]">
            <TableHeader className="bg-slate-50/70 dark:bg-slate-800/50 sticky top-0 z-10 backdrop-blur-sm">
              <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                {columnOrder.map(colId => {
                  if (!(visibleColumns as any)[colId]) return null;

                const labels: Record<string, string> = {
                  employee: 'الموظف',
                  employee_number: 'رقم الموظف',
                  email: 'البريد الإلكتروني',
                  location: 'الموقع',
                  jobTitle: 'المسمى الوظيفي',
                  department: 'القسم',
                  salary: 'الراتب',
                  status: 'الحالة',
                  hireDate: 'تاريخ التعيين',
                  terminationDate: 'تاريخ التوقف'
                };
                
                const sortKeys: Record<string, string> = {
                  employee: 'name',
                  employee_number: 'employee_number',
                  email: 'email',
                  location: 'location',
                  jobTitle: 'jobTitle',
                  department: 'department',
                  salary: 'salary',
                  status: 'status',
                  hireDate: 'hireDate',
                  terminationDate: 'terminationDate'
                };

                return (
                  <TableHead 
                    key={colId}
                    className="text-right text-slate-400 font-black py-5 text-[10px] uppercase tracking-widest print:text-slate-950 print:font-black cursor-pointer hover:text-slate-600 dark:hover:text-slate-200"
                    onClick={() => handleSort(sortKeys[colId])}
                  >
                    <div className="flex items-center gap-1">
                      {labels[colId]}
                      {getSortIcon(sortKeys[colId])}
                    </div>
                  </TableHead>
                );
              })}
              <TableHead className="text-left text-slate-400 font-black py-5 text-[10px] uppercase tracking-widest pr-10 print:hidden">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {paginatedEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={getVisibleColumnsCount()} className="text-center py-20">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-600"
                    >
                      <Users size={48} className="mb-3 opacity-20" />
                      <p className="text-sm font-bold tracking-wider italic">لا يوجد موظفين حالياً</p>
                    </motion.div>
                  </TableCell>
                </TableRow>
              ) : (
                (() => {
                  if (groupBy === 'none') {
                    return paginatedEmployees.map((emp, idx) => (
                      <EmployeeTableRow key={emp.id} emp={emp} idx={idx} />
                    ));
                  }

                  const groups = paginatedEmployees.reduce((acc: any, emp) => {
                    const key = groupBy === 'department' ? (emp.department || 'بدون قسم') : (emp.location?.name || 'بدون موقع');
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(emp);
                    return acc;
                  }, {});

                  return Object.keys(groups).map((groupKey) => (
                    <React.Fragment key={groupKey}>
                      <TableRow className="bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-100/50">
                        <TableCell colSpan={getVisibleColumnsCount()} className="py-2 px-6">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {groupBy === 'department' ? 'القسم' : 'الموقع'}:
                            </span>
                            <span className="text-xs font-black text-blue-600 dark:text-blue-400">{groupKey}</span>
                            <Badge variant="outline" className="text-[10px] py-0 h-5 rounded-full border-slate-200 dark:border-slate-700">
                              {groups[groupKey].length} موظف
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                      {groups[groupKey].map((emp: any, idx: number) => (
                        <EmployeeTableRow key={emp.id} emp={emp} idx={idx} />
                      ))}
                    </React.Fragment>
                  ));
                })()
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:hidden">
          <AnimatePresence mode="popLayout">
            {paginatedEmployees.length === 0 ? (
              <div className="col-span-full py-20 bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                <Users size={48} className="mb-3 opacity-20" />
                <p className="text-sm font-bold tracking-wider italic">لا يوجد موظفين حالياً</p>
              </div>
            ) : (
              paginatedEmployees.map((emp, idx) => (
                <motion.div
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  key={emp.id}
                  className="group bg-white dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 relative flex flex-col"
                >
                  <div className="p-6 flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div className="relative">
                        <div className={`w-16 h-16 ${getAvatarGradient(emp.name)} text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-300`}>
                          {(emp.name || '')[0]}
                        </div>
                        {registeredEmails.has(emp.email) && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full flex items-center justify-center" title="لديه حساب دخول">
                            <ShieldCheck size={10} className="text-white" />
                          </div>
                        )}
                      </div>
                      <Badge className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest border-0 ${
                        (!emp.status || emp.status === 'active') ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 
                        emp.status === 'probation' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                      }`}>
                        {(!emp.status || emp.status === 'active') ? 'نشط' : 
                         emp.status === 'probation' ? 'تحت التجربة' : 'متوقف'}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h3 
                          onClick={() => handleViewDetails(emp)}
                          className="font-black text-slate-900 dark:text-slate-100 text-lg hover:text-primary cursor-pointer transition-colors line-clamp-1"
                        >
                          {emp.name}
                        </h3>
                        {(visibleColumns.jobTitleDetail || visibleColumns.departmentDetail) && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 mt-1">
                            {visibleColumns.jobTitleDetail && (
                              <>
                                <Briefcase size={12} />
                                <span>{emp.job_title}</span>
                              </>
                            )}
                            {visibleColumns.jobTitleDetail && visibleColumns.departmentDetail && (
                              <span className="w-1 h-1 rounded-full bg-slate-200 mx-1"></span>
                            )}
                            {visibleColumns.departmentDetail && (
                              <span>{emp.department}</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="pt-4 space-y-2 border-t border-slate-50 dark:border-slate-800/50">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Mail size={14} className="text-slate-300" />
                          <span className="truncate">{emp.email || 'لا يوجد بريد'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Phone size={14} className="text-slate-300" />
                          <span>{emp.phone || 'لا يوجد هاتف'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <MapPin size={14} className="text-slate-300" />
                          <span>{emp.location?.name || 'غير محدد'}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-1.5 text-sm font-black text-blue-600 dark:text-blue-400">
                            <DollarSign size={14} />
                            <span>{emp.salary ? emp.salary.toLocaleString() : '0'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 italic">
                            منذ: {emp.hire_date}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-50 dark:border-slate-800/50 flex items-center justify-end gap-2">
                    <Button 
                      onClick={() => handleViewDetails(emp)}
                      variant="ghost" 
                      size="sm" 
                      className="h-9 px-3 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl text-xs font-bold"
                    >
                      <Eye size={14} className="ml-1.5" />
                      التفاصيل
                    </Button>
                    {isHRorAdmin && (
                      <Popover>
                        <PopoverTrigger render={
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="w-9 h-9 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                          >
                            <MoreVertical size={16} />
                          </Button>
                        } />
                        <PopoverContent className="w-48 p-1 rounded-xl border-slate-100 dark:border-slate-800 shadow-xl" align="end" dir="rtl">
                          <div className="p-1 space-y-0.5">
                            <button 
                              onClick={() => { handleEditEmployee(emp); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 rounded-lg transition-colors"
                            >
                              <Edit2 size={14} />
                              تعديل البيانات
                            </button>
                            <button 
                              onClick={() => handleCreateLoginClick(emp)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors ${registeredEmails.has(emp.email) ? 'text-green-600 bg-green-50 dark:bg-green-900/30' : 'text-slate-600 dark:text-slate-400 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600'}`}
                            >
                              <ShieldCheck size={14} />
                              {registeredEmails.has(emp.email) ? 'إدارة الحساب' : 'إنشاء حساب دخول'}
                            </button>
                            {(!emp.status || emp.status === 'active') ? (
                              <button 
                                onClick={() => handleSuspendEmployee(emp)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:text-orange-600 rounded-lg transition-colors"
                              >
                                <UserMinus size={14} />
                                إيقاف الخدمة
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleRestoreEmployee(emp)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 rounded-lg transition-colors"
                              >
                                {emp.status === 'probation' ? <UserPlus size={14} /> : <UserCheck size={14} />}
                                {emp.status === 'probation' ? 'نقل للقائمة الأساسية' : 'استعادة الخدمة'}
                              </button>
                            )}
                            <div className="h-px bg-slate-50 dark:bg-slate-800 my-1 mx-1"></div>
                            
                            <button 
                              onClick={() => handleResetFaceID(emp.id)}
                              disabled={!emp.face_descriptor}
                              className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 group transition-colors"
                            >
                              <div className="flex items-center gap-2.5">
                                <ScanFace size={14} className="text-teal-500" />
                                <span>مسح بصمة الوجه</span>
                              </div>
                              {emp.face_descriptor && <Trash2 size={12} className="text-red-400 group-hover:text-red-600" />}
                            </button>

                            <button 
                              onClick={() => handleResetBiometrics(emp.id)}
                              disabled={!emp.biometric_credential_id}
                              className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg disabled:opacity-30 group transition-colors"
                            >
                              <div className="flex items-center gap-2.5">
                                <Fingerprint size={14} className="text-blue-500" />
                                <span>مسح بصمة الإصبع</span>
                              </div>
                              {emp.biometric_credential_id && <Trash2 size={12} className="text-red-400 group-hover:text-red-600" />}
                            </button>

                            <div className="h-px bg-slate-50 dark:bg-slate-800 my-1 mx-1"></div>
                            <button 
                              onClick={() => handleDeleteClick(emp)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                              حذف الموظف
                            </button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm print:hidden">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            عرض <span className="font-bold text-slate-900 dark:text-slate-100">{((currentPage - 1) * itemsPerPage) + 1}</span> إلى <span className="font-bold text-slate-900 dark:text-slate-100">{Math.min(currentPage * itemsPerPage, filteredEmployees.length)}</span> من أصل <span className="font-bold text-slate-900 dark:text-slate-100">{filteredEmployees.length}</span> موظف
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="rounded-lg h-9 px-3 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ChevronRight size={16} className="ml-1" />
              السابق
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className={`w-9 h-9 rounded-lg p-0 ${
                    currentPage === page 
                      ? 'bg-primary text-white' 
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {page}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="rounded-lg h-9 px-3 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              التالي
              <ChevronLeft size={16} className="mr-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
    </motion.div>
  );
}
