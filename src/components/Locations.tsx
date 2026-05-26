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
import { Location, Employee } from '../types';
import { toast } from 'sonner';
import { MapPin, Plus, Trash2, Edit2, Search, Map as MapIcon, List, User } from 'lucide-react';

// Leaflet imports
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Leaflet with React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const employeeIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const workplaceIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const createEmployeeIcon = (employee: Employee) => {
  const isRecent = employee.last_location_update && 
    (Date.now() - new Date(employee.last_location_update).getTime() < 120000); // 2 minutes

  const initial = (employee.name?.[0] || 'U').toUpperCase();
  
  return L.divIcon({
    className: 'custom-employee-container',
    html: `
      <div class="flex flex-col items-center">
        <div class="relative">
          <div class="w-10 h-10 rounded-full flex items-center justify-center bg-blue-600 text-white font-bold text-sm shadow-lg ${isRecent ? 'employee-marker-active' : 'border-2 border-slate-300'}">
            ${initial}
          </div>
          <div class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${isRecent ? 'bg-green-500' : 'bg-orange-400'}"></div>
        </div>
        <div class="employee-marker-label mt-1 translate-y-1">${employee.name}</div>
      </div>
    `,
    iconSize: [40, 60],
    iconAnchor: [20, 50],
    popupAnchor: [0, -50]
  });
};

// Map controller to handle programmatically moving the map
function MapController({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, 16, { animate: true });
    }
  }, [position, map]);
  return null;
}

export default function Locations() {
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<[number, number] | null>(null);
  const [newLocation, setNewLocation] = useState({
    name: '',
    latitude: 0,
    longitude: 0,
    allowed_radius: 100
  });

  useEffect(() => {
    fetchData();
    fetchUserRole();
    if (activeTab === 'map') {
      fetchEmployees();
      const interval = setInterval(fetchEmployees, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [activeTab]);

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
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching locations:', error);
    } else if (data) {
      setLocations(data);
    }
    setLoading(false);
  };

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .not('current_lat', 'is', null)
      .not('current_lng', 'is', null);
    
    if (data) setEmployees(data);
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const insertData: any = { 
      name: newLocation.name,
      latitude: newLocation.latitude || null,
      longitude: newLocation.longitude || null,
      allowed_radius: newLocation.allowed_radius
    };

    const { error } = await supabase
      .from('locations')
      .insert([insertData]);

    if (error) {
      toast.error('خطأ في إضافة الموقع: ' + error.message);
    } else {
      toast.success('تم إضافة الموقع بنجاح');
      setIsAddOpen(false);
      setNewLocation({ name: '', latitude: 0, longitude: 0, allowed_radius: 100 });
      fetchData();
    }
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation) return;

    const { error } = await supabase
      .from('locations')
      .update({
        name: editingLocation.name,
        latitude: editingLocation.latitude || null,
        longitude: editingLocation.longitude || null,
        allowed_radius: editingLocation.allowed_radius
      })
      .eq('id', editingLocation.id);

    if (error) {
      toast.error('خطأ في تحديث الموقع: ' + error.message);
    } else {
      toast.success('تم تحديث الموقع بنجاح');
      setIsEditOpen(false);
      setEditingLocation(null);
      fetchData();
    }
  };

  const handleConfirmDelete = async () => {
    if (!locationToDelete) return;

    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', locationToDelete.id);

    if (error) {
      toast.error('خطأ في حذف الموقع: ' + error.message);
    } else {
      toast.success('تم حذف الموقع بنجاح');
      setIsDeleteOpen(false);
      setLocationToDelete(null);
      fetchData();
    }
  };

  const isHRorAdmin = userRole === 'admin' || userRole === 'hr';

  const filteredEmployees = employees.filter(emp => {
    const fullName = (emp.name || `${emp.first_name} ${emp.last_name}`).toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  if (userRole && !isHRorAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
          <MapPin size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">عذراً، ليس لديك صلاحية</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">هذه الصفحة مخصصة لمسؤولي النظام و HR فقط.</p>
      </div>
    );
  }

  const defaultCenter: [number, number] = locations.length > 0 && locations[0].latitude && locations[0].longitude 
    ? [Number(locations[0].latitude), Number(locations[0].longitude)] 
    : [33.3152, 44.3661]; // Default to Baghdad

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-100 dark:border-slate-800 w-fit">
          <Button 
            variant={activeTab === 'list' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('list')}
            className="rounded-lg h-9 text-xs px-4"
          >
            <List size={14} className="ml-2" />
            مواقع العمل
          </Button>
          <Button 
            variant={activeTab === 'map' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('map')}
            className="rounded-lg h-9 text-xs px-4"
          >
            <MapIcon size={14} className="ml-2" />
            تتبع مباشر للموظفين
          </Button>
        </div>

        {activeTab === 'list' && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger render={<Button className="bg-primary hover:bg-primary/90 rounded-lg h-10 text-sm" />}>
              <Plus size={18} className="ml-2" />
              إضافة موقع جديد
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-xl border-none shadow-2xl" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-text-main">إضافة موقع عمل جديد</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddLocation} className="space-y-4 mt-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-text-muted">اسم الموقع</Label>
                  <Input 
                    className="h-10 rounded-lg border-border"
                    value={newLocation.name}
                    onChange={e => setNewLocation({...newLocation, name: e.target.value})}
                    placeholder="مثال: المركز الرئيسي"
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-text-muted">خط العرض (Latitude)</Label>
                    <Input 
                      type="number"
                      step="any"
                      className="h-10 rounded-lg border-border"
                      value={newLocation.latitude || ''}
                      onChange={e => setNewLocation({...newLocation, latitude: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-text-muted">خط الطول (Longitude)</Label>
                    <Input 
                      type="number"
                      step="any"
                      className="h-10 rounded-lg border-border"
                      value={newLocation.longitude || ''}
                      onChange={e => setNewLocation({...newLocation, longitude: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-text-muted">نطاق السماح (أمتار)</Label>
                  <Input 
                    type="number"
                    className="h-10 rounded-lg border-border"
                    value={newLocation.allowed_radius}
                    onChange={e => setNewLocation({...newLocation, allowed_radius: parseInt(e.target.value)})}
                  />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 rounded-lg h-11 mt-2 font-medium">
                  حفظ الموقع
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {activeTab === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locations.length === 0 ? (
            <div className="col-span-full py-20 bg-white dark:bg-slate-900 rounded-[24px] border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
              <MapPin size={48} className="text-slate-200 mb-4" />
              <p className="text-slate-400 dark:text-slate-500 italic">لا توجد مواقع عمل مضافة حالياً</p>
            </div>
          ) : (
            locations.map((loc) => (
              <div 
                key={loc.id} 
                className="group p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md hover:scale-[1.02] flex flex-col gap-4"
              >
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-primary">
                    <MapPin size={24} />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      onClick={() => {
                        setEditingLocation(loc);
                        setIsEditOpen(true);
                      }}
                      variant="ghost" 
                      size="icon" 
                      className="w-8 h-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-400 hover:text-blue-600 rounded-xl"
                    >
                      <Edit2 size={16} />
                    </Button>
                    <Button 
                      onClick={() => {
                        setLocationToDelete(loc);
                        setIsDeleteOpen(true);
                      }}
                      variant="ghost" 
                      size="icon" 
                      className="w-8 h-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-400 hover:text-red-600 rounded-xl"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">{loc.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    الإحداثيات: {loc.latitude || 'N/A'}, {loc.longitude || 'N/A'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    تمت الإضافة: {new Date(loc.created_at).toLocaleDateString('ar-EG')}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50 mt-auto flex items-center justify-between">
                   <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                      <MapPin size={12} />
                      نطاق {loc.allowed_radius} متر
                   </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg">
                    مفتوح
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden h-[700px] flex flex-col md:flex-row relative" dir="rtl">
          {/* Sidebar */}
          <div className="w-full md:w-80 border-l border-slate-100 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <User size={16} />
                قائمة الموظفين
              </h3>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <Input 
                  className="pr-9 h-9 text-xs rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                  placeholder="بحث باسم الموظف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
              {filteredEmployees.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 italic">لا يوجد موظفين حالياً</div>
              ) : (
                filteredEmployees.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => emp.current_lat && emp.current_lng && setSelectedPosition([emp.current_lat, emp.current_lng])}
                    className="w-full text-right p-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs shrink-0">
                        {emp.name ? emp.name[0] : emp.first_name ? emp.first_name[0] : 'U'}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{emp.name || `${emp.first_name} ${emp.last_name}`}</p>
                        <p className="text-[10px] text-slate-500 truncate">{emp.job_title}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 relative h-full min-h-[400px]">
            <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
              <MapController position={selectedPosition} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* Workplace Markers */}
              {locations.map((loc) => loc.latitude && loc.longitude && (
                <Marker 
                  key={`loc-${loc.id}`} 
                  position={[Number(loc.latitude), Number(loc.longitude)]}
                  icon={workplaceIcon}
                >
                  <Popup>
                    <div className="text-right font-sans" dir="rtl">
                      <p className="font-bold">{loc.name}</p>
                      <p className="text-xs text-slate-500">موقع عمل ثابت</p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Employee Markers */}
              {employees.map((emp) => emp.current_lat && emp.current_lng && (
                <Marker 
                  key={`emp-${emp.id}`} 
                  position={[emp.current_lat, emp.current_lng]}
                  icon={createEmployeeIcon(emp)}
                >
                  <Popup>
                    <div className="text-right font-sans" dir="rtl">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-600">
                          {emp.name ? emp.name[0] : emp.first_name ? emp.first_name[0] : 'U'}
                        </div>
                        <p className="font-bold text-sm">{emp.name || `${emp.first_name} ${emp.last_name}`}</p>
                      </div>
                      <p className="text-xs text-slate-500">{emp.job_title}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        آخر تحديث: {emp.last_location_update ? new Date(emp.last_location_update).toLocaleTimeString('ar-EG') : 'غير متوفر'}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Map Overlay Info */}
            <div className="absolute bottom-6 right-6 z-[1000] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-white/20 max-w-[200px]" dir="rtl">
              <h4 className="text-xs font-bold mb-3 border-b pb-2 text-slate-900 dark:text-white">تفاصيل الخريطة</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-300">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <span>مواقع العمل الثابتة ({locations.length})</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-300">
                  <div className="w-3 h-3 bg-blue-500 rounded-full" />
                  <span>الموظفون المتصلون ({employees.length})</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Delete Dialogs remain here */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md rounded-xl border-none shadow-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-text-main">تعديل موقع العمل</DialogTitle>
          </DialogHeader>
          {editingLocation && (
            <form onSubmit={handleUpdateLocation} className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-text-muted">اسم الموقع</Label>
                <Input 
                  className="h-10 rounded-lg border-border"
                  value={editingLocation.name}
                  onChange={e => setEditingLocation({...editingLocation, name: e.target.value})}
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-text-muted">خط العرض</Label>
                    <Input 
                      type="number"
                      step="any"
                      className="h-10 rounded-lg border-border"
                      value={editingLocation.latitude || ''}
                      onChange={e => setEditingLocation({...editingLocation, latitude: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-text-muted">خط الطول</Label>
                    <Input 
                      type="number"
                      step="any"
                      className="h-10 rounded-lg border-border"
                      value={editingLocation.longitude || ''}
                      onChange={e => setEditingLocation({...editingLocation, longitude: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-text-muted">نطاق السماح (أمتار)</Label>
                  <Input 
                    type="number"
                    className="h-10 rounded-lg border-border"
                    value={editingLocation.allowed_radius}
                    onChange={e => setEditingLocation({...editingLocation, allowed_radius: parseInt(e.target.value)})}
                  />
                </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 rounded-lg h-11 mt-2 font-medium">
                تحديث البيانات
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md rounded-xl border-none shadow-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600">تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-right">
            <p className="text-slate-600 dark:text-slate-400">
              هل أنت متأكد من رغبتك في حذف الموقع <span className="font-bold text-slate-900 dark:text-slate-100">{locationToDelete?.name}</span>؟
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>تأكيد الحذف</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
