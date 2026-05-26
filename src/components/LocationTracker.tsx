import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface LocationTrackerProps {
  employeeId: string | null;
  enabled: boolean;
}

export default function LocationTracker({ employeeId, enabled }: LocationTrackerProps) {
  const watchId = useRef<number | null>(null);
  const lastUpdate = useRef<number>(0);
  const UPDATE_INTERVAL = 30000; // 30 seconds

  useEffect(() => {
    if (!enabled || !employeeId) {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      console.error('Geolocation is not supported by your browser');
      return;
    }

    const startTracking = () => {
      watchId.current = navigator.geolocation.watchPosition(
        async (position) => {
          const now = Date.now();
          // Minimal interval to avoid flooding the database
          if (now - lastUpdate.current < UPDATE_INTERVAL) return;

          const { latitude, longitude } = position.coords;
          
          try {
            const { error } = await supabase
              .from('employees')
              .update({
                current_lat: latitude,
                current_lng: longitude,
                last_location_update: new Date().toISOString()
              })
              .eq('id', employeeId);

            if (error) {
              console.error('Error updating location:', error);
            } else {
              lastUpdate.current = now;
              console.log('Location updated successfully');
            }
          } catch (err) {
            console.error('Exception updating location:', err);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          if (error.code === error.PERMISSION_DENIED) {
            toast.error('يرجى تفعيل صلاحية الموقع لتتبع الحضور وموقع العمل.');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    };

    startTracking();

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [employeeId, enabled]);

  return null;
}
