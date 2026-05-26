import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '../lib/supabase';
import { SmartLocation } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trash2, MapPin, Search, Loader2, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

// Fix for default marker icons in Leaflet using stable CDN links
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function LocationMarker({ position, setPosition }: { position: L.LatLng | null, setPosition: (pos: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    // We run it multiple times to ensure it catches the container after animation
    const timer1 = setTimeout(() => map.invalidateSize(), 150);
    const timer2 = setTimeout(() => map.invalidateSize(), 500);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [map]);
  return null;
}

function ChangeView({ center }: { center: L.LatLng }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

export default function SmartLocationManager() {
  const [locations, setLocations] = useState<SmartLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newPos, setNewPos] = useState<L.LatLng | null>(null);
  const [newRadius, setNewRadius] = useState(100);

  const [editingLoc, setEditingLoc] = useState<SmartLocation | null>(null);
  const [editName, setEditName] = useState('');
  const [editPos, setEditPos] = useState<L.LatLng | null>(null);
  const [editRadius, setEditRadius] = useState(100);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('smart_locations').select('*').order('created_at', { ascending: false });
    if (error) {
      toast.error('خطأ في تحميل المواقع');
    } else {
      setLocations(data || []);
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newName || !newPos) {
      toast.error('يرجى تحديد اسم الموقع واختياره على الخريطة');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('smart_locations').insert([
      {
        name: newName,
        latitude: newPos.lat,
        longitude: newPos.lng,
        radius: newRadius,
        is_active: true
      }
    ]);

    if (error) {
      toast.error('خطأ في الحفظ: ' + error.message);
    } else {
      toast.success('تم إضافة الموقع بنجاح');
      setIsAddOpen(false);
      setNewName('');
      setNewPos(null);
      fetchLocations();
    }
    setSaving(false);
  };

  const handleEditInit = (loc: SmartLocation) => {
    setEditingLoc(loc);
    setEditName(loc.name);
    setEditPos(L.latLng(loc.latitude, loc.longitude));
    setEditRadius(loc.radius);
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingLoc || !editName || !editPos) {
      toast.error('يرجى التأكد من تعبئة جميع البيانات');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('smart_locations')
      .update({
        name: editName,
        latitude: editPos.lat,
        longitude: editPos.lng,
        radius: editRadius
      })
      .eq('id', editingLoc.id);

    if (error) {
      toast.error('خطأ في التعديل: ' + error.message);
    } else {
      toast.success('تم تحديث الموقع بنجاح');
      setIsEditOpen(false);
      fetchLocations();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('smart_locations').delete().eq('id', id);
    if (error) {
      toast.error('حدث خطأ أثناء الحذف');
    } else {
      toast.success('تم حذف الموقع');
      fetchLocations();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">نطاقات الحضور المسموحة</h3>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger 
            render={
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white gap-2 rounded-xl">
                <Plus size={16} />
                إضافة موقع جديد
              </Button>
            }
          />
          <DialogContent className="sm:max-w-[700px] rounded-[24px] border-none shadow-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">إضافة موقع جغرافي جديد</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>اسم الموقع (مثال: المكتب الرئيسي)</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    type="button"
                    onClick={() => {
                      if (!navigator.geolocation) {
                        toast.error('المتصفح لا يدعم تحديد الموقع');
                        return;
                      }
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          const coords = L.latLng(pos.coords.latitude, pos.coords.longitude);
                          setNewPos(coords);
                          toast.success('تم تحديد موقعك الحالي بنجاح');
                        },
                        (err) => toast.error('فشل تحديد الموقع: ' + err.message),
                        { enableHighAccuracy: true }
                      );
                    }}
                    className="h-8 text-[11px] gap-1.5 rounded-lg border-teal-200 text-teal-700 hover:bg-teal-50"
                  >
                    <MapPin size={14} />
                    تحديد موقعي الراهن
                  </Button>
                </div>
                <Input 
                  value={newName || ''} 
                  onChange={e => setNewName(e.target.value)}
                  placeholder="ادخل اسم الموقع"
                  className="rounded-xl"
                />
              </div>
              
              <div className="space-y-2">
                <Label>النطاق الجغرافي المسموح (بالأمتار)</Label>
                <div className="flex gap-4 items-center">
                  <Input 
                    type="number"
                    value={newRadius} 
                    onChange={e => setNewRadius(Number(e.target.value))}
                    className="rounded-xl w-32"
                  />
                  <span className="text-xs text-slate-500">سيتمكن الموظف من تسجيل الحضور ضمن هذا المحيط فقط.</span>
                </div>
              </div>

              <div className="h-[350px] w-full rounded-2xl overflow-hidden border border-slate-200 relative bg-slate-100">
                {isAddOpen && (
                  <MapContainer 
                    key={isAddOpen ? 'active-map' : 'hidden-map'}
                    center={[33.3152, 44.3661]} 
                    zoom={13} 
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {newPos && <ChangeView center={newPos} />}
                    <LocationMarker position={newPos} setPosition={setNewPos} />
                    {newPos && (
                      <Circle center={newPos} radius={newRadius} pathOptions={{ color: 'teal' }} />
                    )}
                    <MapResizer />
                  </MapContainer>
                )}
                <div className="absolute top-2 right-2 z-[1000] bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md text-[10px] font-bold">
                  انقر على الخريطة لتحديد الموقع
                </div>
              </div>

              <Button 
                onClick={handleAdd} 
                disabled={saving}
                className="w-full bg-teal-600 hover:bg-teal-700 rounded-xl h-11 text-white font-bold"
              >
                {saving ? <Loader2 className="animate-spin ml-2" size={18} /> : null}
                حفظ الموقع الجديد
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[700px] rounded-[24px] border-none shadow-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">تعديل الموقع الجغرافي</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>اسم الموقع</Label>
                <Button 
                  variant="outline" 
                  size="sm" 
                  type="button"
                  onClick={() => {
                    if (!navigator.geolocation) {
                      toast.error('المتصفح لا يدعم تحديد الموقع');
                      return;
                    }
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        const coords = L.latLng(pos.coords.latitude, pos.coords.longitude);
                        setEditPos(coords);
                        toast.success('تم تحديد موقعك الحالي بنجاح');
                      },
                      (err) => toast.error('فشل تحديد الموقع: ' + err.message),
                      { enableHighAccuracy: true }
                    );
                  }}
                  className="h-8 text-[11px] gap-1.5 rounded-lg border-teal-200 text-teal-700 hover:bg-teal-50"
                >
                  <MapPin size={14} />
                  تحديد موقعي الراهن
                </Button>
              </div>
              <Input 
                value={editName || ''} 
                onChange={e => setEditName(e.target.value)}
                placeholder="ادخل اسم الموقع"
                className="rounded-xl"
              />
            </div>
            
            <div className="space-y-2">
              <Label>النطاق الجغرافي المسموح (بالأمتار)</Label>
              <div className="flex gap-4 items-center">
                <Input 
                  type="number"
                  value={editRadius} 
                  onChange={e => setEditRadius(Number(e.target.value))}
                  className="rounded-xl w-32"
                />
                <span className="text-xs text-slate-500">تغيير قطر الرقعة الجغرافية المسموح بها.</span>
              </div>
            </div>

            <div className="h-[350px] w-full rounded-2xl overflow-hidden border border-slate-200 relative bg-slate-100">
              {isEditOpen && (
                <MapContainer 
                  center={[editingLoc?.latitude || 33.3152, editingLoc?.longitude || 44.3661]} 
                  zoom={15} 
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {editPos && <ChangeView center={editPos} />}
                  <LocationMarker position={editPos} setPosition={setEditPos} />
                  {editPos && (
                    <Circle center={editPos} radius={editRadius} pathOptions={{ color: 'teal' }} />
                  )}
                  <MapResizer />
                </MapContainer>
              )}
              <div className="absolute top-2 right-2 z-[1000] bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md text-[10px] font-bold">
                انقر على الخريطة لتعديل الإحداثيات
              </div>
            </div>

            <Button 
              onClick={handleUpdate} 
              disabled={saving}
              className="w-full bg-teal-600 hover:bg-teal-700 rounded-xl h-11 text-white font-bold"
            >
              {saving ? <Loader2 className="animate-spin ml-2" size={18} /> : null}
              تحديث البيانات والرقعة
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-3">
        {loading ? (
          <div className="py-8 text-center"><Loader2 className="animate-spin mx-auto text-teal-500" /></div>
        ) : locations.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs border border-dashed rounded-2xl">لا توجد مواقع مضافة حالياً</div>
        ) : (
          locations.map(loc => (
            <div key={loc.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-[18px] border border-slate-100 dark:border-slate-800/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/40 rounded-xl flex items-center justify-center text-teal-600">
                  <MapPin size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold">{loc.name}</h4>
                  <p className="text-[10px] text-slate-500">
                    النطاق المسموح: {loc.radius} متر
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleEditInit(loc)}
                  className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                >
                  <Pencil size={16} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleDelete(loc.id)}
                  className="text-red-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
