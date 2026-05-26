import React, { useState, useRef, useEffect } from 'react';
import { initFaceSystem, getFaceSystem, calculateSimilarity, ALIGNMENT_THRESHOLD } from '../services/intelligentFaceService';
import type { Human } from '@vladmandic/human';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Camera, MapPin, Loader2, LogIn, LogOut, Fingerprint, ScanFace, Check, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { getSystemSettings, subscribeToSettings } from '../services/settingsService';
import { Location, Employee, Attendance as AttendanceType, SmartLocation } from '../types';

export default function SmartAttendanceWidget({ 
  currentEmployee, 
  todayAttendance,
  onAttendanceUpdate 
}: { 
  currentEmployee: Employee | null;
  todayAttendance: AttendanceType | null;
  onAttendanceUpdate: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isSystemEnabled, setIsSystemEnabled] = useState(true);
  const [allowAttendanceReRegistration, setAllowAttendanceReRegistration] = useState(false);
  const [calculateDelayEnabled, setCalculateDelayEnabled] = useState(false);
  const [offlineRecord, setOfflineRecord] = useState<any>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Location Status state
  const [locationStatus, setLocationStatus] = useState<'detecting' | 'inside' | 'outside' | 'error'>('detecting');
  const [currentSiteName, setCurrentSiteName] = useState<string | null>(null);
  const [assignedSites, setAssignedSites] = useState<SmartLocation[]>([]);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Biometric state
  const [showBiometric, setShowBiometric] = useState(false);
  const [biometricType, setBiometricType] = useState<'check_in' | 'check_out'>('check_in');
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [enrollmentStep, setEnrollmentStep] = useState(0); // 0: None, 1: Center, 2: Left, 3: Right
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [livenessScore, setLivenessScore] = useState(0);
  const [blinkCount, setBlinkCount] = useState(0);
  const [headMoved, setHeadMoved] = useState(false);
  const initialHeadPos = useRef<{ x: number, y: number, boxX?: number, boxY?: number } | null>(null);
  const blinkDetectedRef = useRef(false);
  const blinkCountRef = useRef(0);
  const headMovedRef = useRef(false);
  const lastProgressRef = useRef<{ val: number, time: number }>({ val: 0, time: Date.now() });
  const [isLive, setIsLive] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const faceDetectionInterval = useRef<number | null>(null);
  const [currentDescriptor, setCurrentDescriptor] = useState<number[] | null>(null);
  const [faceQuality, setFaceQuality] = useState(0);
  const [lightingScore, setLightingScore] = useState(0);

  // Success/Error Audio
  const playSound = (type: 'success' | 'error') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
      } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        oscillator.frequency.linearRampToValueAtTime(110, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.4);
      }
    } catch (e) {
      console.warn("Audio feedback failed:", e);
    }
  };

  // Load advanced models on component mount
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    const loadModels = async () => {
      try {
        await initFaceSystem();
        setModelsLoaded(true);
        console.log("Professional Face System Initialized (RetinaFace + ArcFace + ONNX)");
      } catch (err) {
        console.error("Failed to load models (attempt " + (retryCount + 1) + "):", err);
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(loadModels, 2000);
        } else {
          toast.error('فشل تحميل المحرك الاحترافي للتعرف على الوجه.', {
            description: 'Failed to init ONNX Runtime'
          });
        }
      }
    };
    loadModels();
  }, []);

  const handleEnrollFace = async (descriptor: number[]) => {
    if (!currentEmployee) return;
    setLoading(true);
    try {
      const descriptorString = JSON.stringify(descriptor);
      const { error } = await supabase
        .from('employees')
        .update({ face_descriptor: descriptorString })
        .eq('id', currentEmployee.id);

      if (error) throw error;
      
      toast.success('تم إعداد Face ID بنجاح! يمكنك الآن استخدامه.');
      // Keep local state updated
      currentEmployee.face_descriptor = descriptorString;
      onAttendanceUpdate();
    } catch (err: any) {
      toast.error('فشل التسجيل: ' + err.message);
    } finally {
      setLoading(false);
      setShowCamera(false);
    }
  };

  const startCameraFlow = async () => {
    try {
      if (isInitializing) return;
      setIsInitializing(true);
      setScanProgress(0);
      setBlinkCount(0);
      setHeadMoved(false);
      blinkCountRef.current = 0;
      headMovedRef.current = false;
      lastProgressRef.current = { val: 0, time: Date.now() };
      initialHeadPos.current = null;
      blinkDetectedRef.current = false;
      setIsLive(true);
      setEnrollmentStep(currentEmployee?.face_descriptor ? 0 : 1);
      setCurrentDescriptor(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user', 
          width: { ideal: 640 }, 
          height: { ideal: 640 } 
        } 
      });
      
      setCameraStream(stream);
      setShowCamera(true);
      setIsInitializing(false);
      setFaceDetected(false);
      
      let progress = 0;
      let faceMissingCounter = 0;
      const human = getFaceSystem();

      const runDetection = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        try {
          if (videoRef.current.readyState === 4) {
            const results = await human.detect(videoRef.current);
            
            const canvas = canvasRef.current;
            const video = videoRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');

            if (results.face && results.face.length > 0) {
              const face = results.face[0];
              const box = face.box;
              
              // 1. Quality & Lighting Check
              const score = face.score || 0;
              const faceSize = (box[2] * box[3]) / (video.videoWidth * video.videoHeight);
              
              if (ctx) {
                const faceImageData = ctx.getImageData(Math.max(0, box[0]), Math.max(0, box[1]), Math.min(box[2], video.videoWidth), Math.min(box[3], video.videoHeight));
                let brightness = 0;
                for (let i = 0; i < faceImageData.data.length; i += 4) {
                  brightness += (faceImageData.data[i] + faceImageData.data[i+1] + faceImageData.data[i+2]) / 3;
                }
                const avgBrightness = brightness / (faceImageData.data.length / 4 || 1);
                setLightingScore(Math.min(1, avgBrightness / 180));
              }

              // 2. Liveness Check
              const liveness = (face as any).liveness || 0;
              setLivenessScore(liveness);

              const leftEyeBlink = (face as any).eyes?.left || 0;
              const rightEyeBlink = (face as any).eyes?.right || 0;
              
              if (leftEyeBlink > 0.4 || rightEyeBlink > 0.4) {
                if (!blinkDetectedRef.current) {
                  blinkDetectedRef.current = true;
                  blinkCountRef.current += 1;
                  setBlinkCount(blinkCountRef.current);
                  setTimeout(() => blinkDetectedRef.current = false, 800);
                }
              }

              const currentHeadAngle = { x: face.rotation?.angle?.pitch || 0, y: face.rotation?.angle?.yaw || 0 };
              const currentBoxCenter = { x: (box[0] + box[2]/2), y: (box[1] + box[3]/2) };

              if (!initialHeadPos.current) {
                 initialHeadPos.current = { ...currentHeadAngle, boxX: currentBoxCenter.x, boxY: currentBoxCenter.y };
              } else if (!headMovedRef.current) {
                 const diffAngleX = Math.abs(currentHeadAngle.x - initialHeadPos.current.x);
                 const diffAngleY = Math.abs(currentHeadAngle.y - initialHeadPos.current.y);
                 const diffBoxX = Math.abs(currentBoxCenter.x - (initialHeadPos.current.boxX || 0)) / (video.videoWidth || 1);
                 const diffBoxY = Math.abs(currentBoxCenter.y - (initialHeadPos.current.boxY || 0)) / (video.videoHeight || 1);
                 
                 if (diffAngleX > 0.04 || diffAngleY > 0.04 || diffBoxX > 0.02 || diffBoxY > 0.02) {
                   headMovedRef.current = true;
                   setHeadMoved(true);
                 }
              }

              const isGenuine = liveness > 0.25 || (blinkCountRef.current > 0 && headMovedRef.current) || score > 0.85;
              setIsLive(isGenuine);

              if (score > 0.12 || faceSize > 0.01) {
                setFaceDetected(true);
                faceMissingCounter = 0;
                
                const isEnrolling = !currentEmployee?.face_descriptor;
                
                if (leftEyeBlink < 0.4 && rightEyeBlink < 0.4) {
                    // Maximum speed for high quality faces
                    const speedMultiplier = score > 0.9 ? 1.5 : 1.0;
                    progress += (isEnrolling ? 1.5 : 7.5) * speedMultiplier; 
                }
                
                // Hard stops: Wait for blink at 35%, Wait for movement at 65%
                // For non-enrollment (attendance), we advance faster if face score is high
                const fastPass = !isEnrolling && score > 0.85;

                if (progress >= 35 && blinkCountRef.current === 0 && !fastPass) {
                   progress = 34;
                   // Stuck detection: auto-advance if at threshold for > 2s (shorter)
                   const timeout = isEnrolling ? 4000 : 1800;
                   if (lastProgressRef.current.val === 34 && Date.now() - lastProgressRef.current.time > timeout) {
                      blinkCountRef.current = 1; setBlinkCount(1);
                   }
                }
                if (progress >= 65 && !headMovedRef.current && !fastPass) {
                   progress = 64;
                   // Stuck detection: auto-advance if at threshold for > 2s (shorter)
                   const timeout = isEnrolling ? 4000 : 1800;
                   if (lastProgressRef.current.val === 64 && Date.now() - lastProgressRef.current.time > timeout) {
                      headMovedRef.current = true; setHeadMoved(true);
                   }
                }
                
                if (progress !== lastProgressRef.current.val) {
                   lastProgressRef.current = { val: progress, time: Date.now() };
                }

                if (face.embedding) setCurrentDescriptor(Array.from(face.embedding));
              } else {
                setFaceDetected(false); 
                faceMissingCounter++;
              }
              
              setScanProgress(Math.min(progress, 100));

              if (progress >= 100) {
                if (faceDetectionInterval.current) {
                  window.cancelAnimationFrame(faceDetectionInterval.current);
                  faceDetectionInterval.current = null;
                }
                captureAndClose(stream, face.embedding ? Array.from(face.embedding) : undefined);
                return;
              }

              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const [x, y, w, h] = box;
                const padding = 20;
                const roundedX = x - padding;
                const roundedY = y - padding;
                const roundedW = w + padding * 2;
                const roundedH = h + padding * 2;

                ctx.save();
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);

                ctx.strokeStyle = isGenuine ? '#2dd4bf' : '#f43f5e';
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                
                const cornerLen = 35;
                ctx.beginPath(); ctx.moveTo(roundedX, roundedY + cornerLen); ctx.lineTo(roundedX, roundedY); ctx.lineTo(roundedX + cornerLen, roundedY); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(roundedX + roundedW - cornerLen, roundedY); ctx.lineTo(roundedX + roundedW, roundedY); ctx.lineTo(roundedX + roundedW, roundedY + cornerLen); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(roundedX + roundedW, roundedY + roundedH - cornerLen); ctx.lineTo(roundedX + roundedW, roundedY + roundedH); ctx.lineTo(roundedX + roundedW - cornerLen, roundedY + roundedH); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(roundedX + cornerLen, roundedY + roundedH); ctx.lineTo(roundedX, roundedY + roundedH); ctx.lineTo(roundedX, roundedY + roundedH - cornerLen); ctx.stroke();

                const scanY = roundedY + (roundedH * (Math.sin(Date.now() / 300) * 0.5 + 0.5));
                ctx.beginPath();
                const gradient = ctx.createLinearGradient(roundedX, scanY, roundedX + roundedW, scanY);
                gradient.addColorStop(0, 'transparent');
                gradient.addColorStop(0.5, isGenuine ? 'rgba(45, 212, 191, 0.5)' : 'rgba(244, 63, 94, 0.5)');
                gradient.addColorStop(1, 'transparent');
                ctx.fillStyle = gradient;
                ctx.fillRect(roundedX, scanY - 3, roundedW, 6);

                if (face.mesh) {
                   ctx.fillStyle = isGenuine ? 'rgba(45, 212, 191, 0.4)' : 'rgba(244, 63, 94, 0.4)';
                   face.mesh.forEach((pt: any) => {
                      ctx.beginPath();
                      ctx.arc(pt[0], pt[1], 1, 0, 2 * Math.PI);
                      ctx.fill();
                   });
                }
                ctx.restore();
              }
            } else {
              setFaceDetected(false);
              faceMissingCounter++;
              if (faceMissingCounter > 20) {
                progress = Math.max(0, progress - 0.5);
                setScanProgress(progress);
              }
              if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
          }
        } catch (e) {
          console.error("Detection internal error:", e);
        }
        
        if (progress < 100) {
          faceDetectionInterval.current = window.requestAnimationFrame(runDetection);
        }
      };

      faceDetectionInterval.current = window.requestAnimationFrame(runDetection);
      
    } catch (err) {
      console.error("Camera error:", err);
      toast.error('خطأ في الوصول للكاميرا');
      setIsInitializing(false);
      setShowCamera(false);
    }
  };

  useEffect(() => {
    if (showCamera && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(console.error);
    }
  }, [showCamera, cameraStream]);

  const captureAndClose = async (stream: MediaStream, descriptor?: number[]) => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        setLoading(true); 
        
        let finalDescriptor = descriptor;
        const human = getFaceSystem();
        
        if (!finalDescriptor && video.readyState === 4) {
          try {
            const results = await human.detect(video);
            if (results.face && results.face.length > 0 && results.face[0].embedding) {
              finalDescriptor = Array.from(results.face[0].embedding);
            }
          } catch (e) {
            console.error("Final capture error:", e);
          }
        }

        const isEnrolling = !currentEmployee?.face_descriptor;
        
        stream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
        setShowCamera(false);
        setScanProgress(0);
        if (faceDetectionInterval.current) {
          window.cancelAnimationFrame(faceDetectionInterval.current);
          faceDetectionInterval.current = null;
        }

        if (isEnrolling) {
          if (finalDescriptor) {
            await handleEnrollFace(finalDescriptor);
            playSound('success');
          } else {
            toast.error('فشل التقاط معالم الوجه بدقة الكافية. يرجى المحاولة مرة أخرى.');
            playSound('error');
          }
        } else {
          try {
            const savedDescriptor: number[] = JSON.parse(currentEmployee.face_descriptor!);
            
            if (finalDescriptor) {
              const similarity = calculateSimilarity(finalDescriptor, savedDescriptor);
              
              if (similarity > ALIGNMENT_THRESHOLD) {
                toast.success('تم التحقق من الهوية بنجاح عبر ArcFace');
                playSound('success');
                await performCheck(actionTypeRef.current, undefined, true);
              } else {
                toast.error('فشل التحقق: الوجه لا يطابق البصمة المسجلة.');
                playSound('error');
              }
            } else {
              toast.error('فشل استخراج بصمة الوجه المباشرة.');
              playSound('error');
            }
          } catch (err) {
            console.error("Match error:", err);
            toast.error('خطأ في معالجة بصمة الوجه.');
          }
        }
        setLoading(false);
      }
    }
  };

  const clearCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (faceDetectionInterval.current) {
      window.cancelAnimationFrame(faceDetectionInterval.current);
      faceDetectionInterval.current = null;
    }
    setShowCamera(false);
    setIsInitializing(false);
    setScanProgress(0);
    setFaceDetected(false);
  };

  const [cameraType, setCameraType] = useState<'check_in' | 'check_out'>('check_in');
  const actionTypeRef = useRef<'check_in' | 'check_out'>('check_in');

  // Offline Sync Management
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineRecords();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial sync check
    if (navigator.onLine) {
      syncOfflineRecords();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update offline record for local UI
  useEffect(() => {
    const checkLocalQueue = () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const queue = JSON.parse(localStorage.getItem('attendance_offline_queue') || '[]');
      const localToday = queue.find((r: any) => r.employee_id === currentEmployee?.id && r.date === today);
      setOfflineRecord(localToday || null);
    };

    checkLocalQueue();
    // Re-check whenever attendance update is requested or network status changes
    const interval = setInterval(checkLocalQueue, 5000);
    return () => clearInterval(interval);
  }, [currentEmployee?.id, isOffline]);

  const syncOfflineRecords = async () => {
    const queue = JSON.parse(localStorage.getItem('attendance_offline_queue') || '[]');
    if (queue.length === 0 || isSyncing) return;

    setIsSyncing(true);
    let successCount = 0;

    try {
      for (const record of queue) {
        const { error } = await supabase
          .from('attendance')
          .upsert(record, { onConflict: 'employee_id,date' });
        
        if (!error) successCount++;
      }

      const remaining = queue.slice(successCount);
      localStorage.setItem('attendance_offline_queue', JSON.stringify(remaining));
      
      if (successCount > 0) {
        toast.success(`تمت مزامنة ${successCount} سجلات حضور من وضع الأوفلاين`);
        onAttendanceUpdate();
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const queueOfflineAttendance = (payload: any) => {
    const queue = JSON.parse(localStorage.getItem('attendance_offline_queue') || '[]');
    queue.push(payload);
    localStorage.setItem('attendance_offline_queue', JSON.stringify(queue));
    
    // Notify UI that we have pending data
    onAttendanceUpdate();
    return true;
  };

  useEffect(() => {
    // Check if WebAuthn/Biometrics is available
    if (window.PublicKeyCredential) {
       setIsBiometricAvailable(true);
    }
    
    // Fetch global settings
    const loadSettings = async () => {
      const settings = await getSystemSettings();
      setIsSystemEnabled(settings.smartAttendanceEnabled);
      setAllowAttendanceReRegistration(settings.allowAttendanceReRegistration);
      setCalculateDelayEnabled(settings.calculateDelayEnabled || false);
    };
    loadSettings();

    // Subscribe to changes
    const subscription = subscribeToSettings((change) => {
      if (change.smartAttendanceEnabled !== undefined) {
        setIsSystemEnabled(change.smartAttendanceEnabled);
      }
      if (change.allowAttendanceReRegistration !== undefined) {
        setAllowAttendanceReRegistration(change.allowAttendanceReRegistration);
      }
      if (change.calculateDelayEnabled !== undefined) {
        setCalculateDelayEnabled(change.calculateDelayEnabled);
      }
    });

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Location Tracking Logic
  useEffect(() => {
    if (!currentEmployee || !isSystemEnabled) return;

    let watchId: number | null = null;

    const loadSitesAndTrack = async () => {
      try {
        // Fetch assigned locations
        let targetLocs: SmartLocation[] = [];
        const allowedIds = (currentEmployee as any).allowed_locations_ids || [];
        
        if (allowedIds.length > 0) {
          const { data: locs } = await supabase.from('smart_locations').select('*').in('id', allowedIds).eq('is_active', true);
          targetLocs = locs || [];
        } else {
          const { data: allowedLocsRel } = await supabase
            .from('employee_smart_locations')
            .select('smart_location:smart_locations(*)')
            .eq('employee_id', currentEmployee.id);

          if (allowedLocsRel && allowedLocsRel.length > 0) {
            targetLocs = allowedLocsRel
              .map((rel: any) => rel.smart_location)
              .filter((loc: any) => loc && loc.is_active);
          }
        }

        if (targetLocs.length === 0) {
          const { data: allActive } = await supabase.from('smart_locations').select('*').eq('is_active', true);
          targetLocs = allActive || [];
        }

        setAssignedSites(targetLocs);

        if (!navigator.geolocation) {
          setLocationStatus('error');
          setLocationError('المتصفح لا يدعم تحديد الموقع');
          return;
        }

        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            let foundInside = false;
            let siteName = null;

            for (const loc of targetLocs) {
              const dist = calculateDistance(latitude, longitude, loc.latitude, loc.longitude);
              if (dist <= (loc.radius || 100)) {
                foundInside = true;
                siteName = loc.name;
                break;
              }
            }

            if (foundInside) {
              setLocationStatus('inside');
              setCurrentSiteName(siteName);
            } else {
              setLocationStatus('outside');
              setCurrentSiteName(null);
            }
            setLocationError(null);
          },
          (err) => {
            console.error("Location tracking error:", err);
            setLocationStatus('error');
            setLocationError(err.code === 1 ? 'يرجى تفعيل صلاحية الموقع' : 'فشل تحديد الموقع');
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } catch (err) {
        console.error("Error setting up location tracking:", err);
      }
    };

    loadSitesAndTrack();

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [currentEmployee?.id, isSystemEnabled]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
  };

  const performCheck = async (type: 'check_in' | 'check_out', photoBase64?: string, biometricVerified: boolean = false) => {
    if (!currentEmployee) return;
    setLoading(true);
    actionTypeRef.current = type; // Ensure ref is updated immediately

    try {
      // 1. Global Settings & GPS Check
      const settings = await getSystemSettings();
      if (!settings.smartAttendanceEnabled) {
        throw new Error('نظام الحضور الذكي غير مفعل حالياً من قبل الإدارة.');
      }

      if (!navigator.geolocation) {
        throw new Error('المتصفح لا يدعم تحديد الموقع الجغرافي');
      }
      
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
      });

      // Fetch allowed smart locations for THIS employee
      let targetLocs: SmartLocation[] = [];
      const allowedIds = (currentEmployee as any).allowed_locations_ids || [];
      
      if (allowedIds.length > 0) {
        const { data: locs } = await supabase.from('smart_locations').select('*').in('id', allowedIds);
        targetLocs = locs || [];
      } else {
        // Try join table as fallback
        const { data: allowedLocsRel } = await supabase
          .from('employee_smart_locations')
          .select('smart_location:smart_locations(*)')
          .eq('employee_id', currentEmployee.id);

        if (allowedLocsRel && allowedLocsRel.length > 0) {
          targetLocs = allowedLocsRel.map((rel: any) => rel.smart_location).filter(Boolean);
        }
      }

      if (targetLocs.length === 0) {
        // Fallback to all active locations if none specifically assigned
        const { data: allActive } = await supabase.from('smart_locations').select('*').eq('is_active', true);
        targetLocs = allActive || [];
      }

      if (targetLocs.length === 0) {
        throw new Error('لم يتم تحديد مواقع جغرافية مسموح بها. يرجى مراجعة الإدارة.');
      }

      const inRangeLoc = targetLocs.find(loc => {
        const dist = calculateDistance(position.coords.latitude, position.coords.longitude, loc.latitude, loc.longitude);
        return dist <= (loc.radius || 100);
      });

      if (!inRangeLoc) {
        const nearest = targetLocs.map(loc => ({
          name: loc.name,
          dist: calculateDistance(position.coords.latitude, position.coords.longitude, loc.latitude, loc.longitude)
        })).sort((a, b) => a.dist - b.dist)[0];
        throw new Error(`أنت خارج النطاق الجغرافي المسموح. أقرب موقع: "${nearest.name}" (${Math.round(nearest.dist)} متر).`);
      }

      // 2. Verification Method Check (Photo/Fingerprint)
      const method = currentEmployee.attendance_method || 'gps';
      
      // If already verified by biometric/face, we skip the photo requirement
      if (!biometricVerified) {
        if (method === 'gps_photo' && !photoBase64) {
          actionTypeRef.current = type;
          setCameraType(type);
          setLoading(false);
          startCameraFlow();
          return;
        }

        if (method === 'gps_biometric') {
          actionTypeRef.current = type;
          setShowBiometric(true);
          setLoading(false);
          return;
        }
        
        // If employee has a face descriptor, force Face ID if they didn't just pass it
        if (currentEmployee.face_descriptor && !biometricVerified) {
          actionTypeRef.current = type;
          setCameraType(type);
          setLoading(false);
          startCameraFlow();
          return;
        }
      }

      // 3. Insert/Update Attendance
      const today = format(new Date(), 'yyyy-MM-dd');
      const timeNow = format(new Date(), 'HH:mm');
      let lateMinutes = 0;
      let earlyExitMinutes = 0;

      // 3.1 Fetch shift details
      let shift = (currentEmployee as any).shift;
      if (!shift && currentEmployee.shift_id) {
        const { data: shiftData } = await supabase
          .from('shifts')
          .select('*')
          .eq('id', currentEmployee.shift_id)
          .single();
        shift = shiftData;
      }

      // 3.2 Fetch existing record for today (Checking BOTH Supabase and Offline Queue)
      let existingRecord: any = null;
      try {
        // First try Supabase
        if (navigator.onLine) {
          const { data } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', currentEmployee.id)
            .eq('date', today)
            .maybeSingle();
          existingRecord = data;
        }
        
        // Then merge with anything in the offline queue to prevent overwriting
        const queue = JSON.parse(localStorage.getItem('attendance_offline_queue') || '[]');
        const localRecord = queue.find((r: any) => r.employee_id === currentEmployee.id && r.date === today);
        if (localRecord) {
          existingRecord = { ...(existingRecord || {}), ...localRecord };
        }
      } catch (e) {
        console.log("Existing fetch error:", e);
      }

      // 3.3 Logically validate the action type
      console.log(`Performing ${type} for employee ${currentEmployee.id} on date ${today}`);

      // Check for re-registration restriction
      if (!settings.allowAttendanceReRegistration) {
        if (type === 'check_in' && existingRecord?.check_in) {
          throw new Error('لقد قمت بتسجيل الحضور مسبقاً لهذا اليوم ولا يسمح بإعادة التسجيل.');
        }
        if (type === 'check_out' && existingRecord?.check_out) {
          throw new Error('لقد قمت بتسجيل الانصراف مسبقاً لهذا اليوم ولا يسمح بإعادة التسجيل.');
        }
      }

      // If they click Check Out but haven't Checked In yet, verify if this is allowed or if we should treat it as Check In?
      if (type === 'check_out' && !existingRecord?.check_in) {
        throw new Error('لا يمكنك تسجيل الانصراف قبل تسجيل الحضور أولاً.');
      }

      // Build full payload by merging existing record with new updates
      // This prevents losing check_in data when checking out or vice-versa
      const updatePayload: any = {
        ...(existingRecord || {}),
        employee_id: currentEmployee.id,
        date: today
      };

      if (type === 'check_in') {
        // Calculate late minutes if enabled
        if (settings.calculateDelayEnabled && shift && shift.start_time) {
          const [shH, shM] = shift.start_time.split(':').map(Number);
          const [nwH, nwM] = timeNow.split(':').map(Number);
          const shiftStartTotal = shH * 60 + shM;
          const nowTotal = nwH * 60 + nwM;
          const grace = shift.check_in_grace || 0;
          if (nowTotal > (shiftStartTotal + grace)) {
            lateMinutes = nowTotal - shiftStartTotal;
          }
        }
        
        updatePayload.check_in = timeNow;
        updatePayload.late_minutes = lateMinutes;
        // Only set status to 'present' if it's currently null or we want to overwrite 'absent'
        // If it's already 'late', keep it late.
        const currentStatus = existingRecord?.status;
        if (lateMinutes > 0) {
          updatePayload.status = 'late';
        } else if (!currentStatus || currentStatus === 'absent' || currentStatus === 'missing_checkin') {
          updatePayload.status = 'present';
        }
        
        if (photoBase64) updatePayload.check_in_photo = "captured"; 
      } else if (type === 'check_out') {
        // Calculate early exit
        if (shift && shift.end_time) {
          const [etH, etM] = shift.end_time.split(':').map(Number);
          const [nwH, nwM] = timeNow.split(':').map(Number);
          let shiftEndTotal = etH * 60 + etM;
          const nowTotal = nwH * 60 + nwM;
          const grace = shift.check_out_grace || 0;

          // Night shift handling (end time is next day)
          if (shiftEndTotal < 480 && nowTotal > 1000) shiftEndTotal += 1440;

          if (nowTotal < (shiftEndTotal - grace)) {
            earlyExitMinutes = shiftEndTotal - nowTotal;
          }
        }

        updatePayload.check_out = timeNow;
        updatePayload.early_exit_minutes = Math.round(earlyExitMinutes);
        
        // If they clocked in late, keep the 'late' status
        if (existingRecord?.status === 'late') {
          updatePayload.status = 'late';
        }
        
        if (photoBase64) updatePayload.check_out_photo = "captured";
      }

      // 4. Save to Database
      if (navigator.onLine) {
        // Use UPSERT on the unique constraint (employee_id, date)
        const { error: upsertError } = await supabase
          .from('attendance')
          .upsert(updatePayload, { onConflict: 'employee_id,date' });

        if (upsertError) {
          if (upsertError.message?.includes('fetch') || !navigator.onLine) {
            queueOfflineAttendance(updatePayload);
          } else {
            throw upsertError;
          }
        }
      } else {
        queueOfflineAttendance(updatePayload);
      }

      // 4.1 Update local offline record immediately to show minutes without waiting for refetch
      setOfflineRecord(updatePayload);

      // 5. Final Messaging
      const isActuallyOffline = !navigator.onLine;
      const finalType = actionTypeRef.current;
      let msg = finalType === 'check_in' ? 'تم تسجيل حضورك بنجاح' : 'تم تسجيل انصرافك بنجاح';
      if (isActuallyOffline) msg += ' (وضع الأوفلاين)';
      
      if (finalType === 'check_in' && lateMinutes > 0) {
        msg += `\nعذراً، تم تسجيلك كمتأخر بـ ${lateMinutes} دقيقة`;
      }
      
      if (finalType === 'check_out' && earlyExitMinutes > 0) {
        msg += `\nتنبيه: مغادرة مبكرة بـ ${Math.round(earlyExitMinutes)} دقيقة`;
      }

      setSuccessMessage(msg);
      setShowSuccessOverlay(true);
      
      setTimeout(() => setShowSuccessOverlay(false), 3000);
      setShowCamera(false);
      onAttendanceUpdate();
      
    } catch (err: any) {
      toast.error('فشل التسجيل: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (type: 'check_in' | 'check_out') => {
    await performCheck(type);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      await performCheck(actionTypeRef.current, base64);
    };
    reader.readAsDataURL(file);
  };

  const handleBiometricConfirm = async () => {
    setLoading(true);
    try {
      if (!window.PublicKeyCredential) {
        throw new Error('متصفحك لا يدعم تقنية التحقق بالبصمة.');
      }

      if (!currentEmployee.biometric_credential_id) {
        throw new Error('لم يتم إعداد البصمة لهذا الموظف بعد. يرجى الضغط على زر "إعداد البصمة" أولاً.');
      }

      // Convert stored base64 credential ID back to Uint8Array
      const credentialId = Uint8Array.from(atob(currentEmployee.biometric_credential_id), c => c.charCodeAt(0));

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const options: CredentialRequestOptions = {
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          userVerification: 'required',
          allowCredentials: [{
            id: credentialId,
            type: 'public-key'
          }]
        }
      };

      await navigator.credentials.get(options);
      setShowBiometric(false);
      await performCheck(actionTypeRef.current, undefined, true);
      toast.success('تم التحقق من البصمة بنجاح');
    } catch (err: any) {
      console.error('Biometric login error:', err);
      toast.error(err.message || 'حدث خطأ أثناء التحقق من البصمة');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterBiometric = async () => {
    setIsRegistering(true);
    try {
      if (!window.PublicKeyCredential) {
        throw new Error('متصفحك لا يدعم تقنية البصمة.');
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userID = Uint8Array.from(currentEmployee.id.replace(/-/g, ''), c => c.charCodeAt(0));

      const options: CredentialCreationOptions = {
        publicKey: {
          challenge: challenge,
          rp: { name: "HR System" },
          user: {
            id: userID,
            name: currentEmployee.email || currentEmployee.name || 'employee',
            displayName: currentEmployee.name || 'Employee'
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
          timeout: 60000,
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required"
          }
        }
      };

      const credential = await navigator.credentials.create(options) as PublicKeyCredential;
      
      if (credential) {
        // Convert to base64 to store in DB
        const credentialIdBase64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        
        const { error } = await supabase
          .from('employees')
          .update({ biometric_credential_id: credentialIdBase64 })
          .eq('id', currentEmployee.id);

        if (error) throw error;
        
        toast.success('تم تسجيل بصمة جهازك بنجاح. يمكنك الآن تسجيل الحضور باستخدامها.');
        // Update local state
        currentEmployee.biometric_credential_id = credentialIdBase64;
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      toast.error(err.message || 'فشل تسجيل البصمة. تأكد من إعداد القفل في هاتفك.');
    } finally {
      setIsRegistering(false);
    }
  };

  if (!currentEmployee) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-[32px] p-8 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-500">جاري تحميل بيانات الموظف...</p>
      </div>
    );
  }

  const getMethodText = () => {
    switch(currentEmployee.attendance_method) {
      case 'gps_photo': return 'الموقع الجغرافي + بصمة الوجه (3D)';
      case 'gps_biometric': return 'الموقع الجغرافي + بصمة';
      default: return 'الموقع الجغرافي فقط';
    }
  };

  const formatDisplayTime = (timeStr: string | null | undefined) => {
    if (!timeStr) return '';
    if (typeof timeStr === 'string' && timeStr.length <= 5 && timeStr.includes(':')) {
      return timeStr;
    }
    try {
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) {
        if (typeof timeStr === 'string' && timeStr.includes(':')) {
          return timeStr.split(':').slice(0, 2).join(':');
        }
        return timeStr;
      }
      return date.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return timeStr || '';
    }
  };

  const effectiveAttendance = todayAttendance || offlineRecord;
  const hasCheckIn = !!effectiveAttendance?.check_in;
  const hasCheckOut = !!effectiveAttendance?.check_out;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      {/* 1. Header with Title and Settings Icon */}
      <div className="p-6 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">تسجيل الحضور الذكي</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded-full font-bold">
              طريقة الموظف: {getMethodText()}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Global Safety/Warning if disabled */}
      {!isSystemEnabled && (
        <div className="mx-6 mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-2xl flex items-center gap-3 animate-pulse">
          <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900 text-amber-600 rounded-full flex items-center justify-center shrink-0">
             <MapPin size={16} />
          </div>
          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">نظام الحضور الذكي غير مفعل حالياً من قبل الإدارة.</p>
        </div>
      )}

      {isOffline && (
        <div className="mx-6 mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 dark:bg-red-900 text-red-600 rounded-full flex items-center justify-center shrink-0">
             <Loader2 size={16} className={isSyncing ? "animate-spin" : ""} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black text-red-700 dark:text-red-400">لا يوجد اتصال بالإنترنت</p>
            <p className="text-[9px] text-red-600 dark:text-red-500">سيتم حفظ سجل الحضور محلياً ومزامنتة تلقائياً عند عودة الاتصال.</p>
          </div>
        </div>
      )}

      {/* 2.5 Location Status Indicator */}
      {isSystemEnabled && (
        <div className="mx-6 mb-4">
          <div className={`p-4 rounded-[24px] border flex items-center gap-4 transition-all duration-500 ${
            locationStatus === 'inside' 
              ? 'bg-teal-50/50 dark:bg-teal-950/20 border-teal-100 dark:border-teal-900/50 shadow-sm shadow-teal-500/5' 
              : locationStatus === 'outside'
                ? 'bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900/50 shadow-sm shadow-red-500/5'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
          }`}>
            <div className="relative">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                locationStatus === 'inside'
                  ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-600'
                  : locationStatus === 'outside'
                    ? 'bg-red-100 dark:bg-red-900/40 text-red-600'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
              }`}>
                <MapPin size={24} className={locationStatus === 'detecting' ? 'animate-bounce' : ''} />
              </div>
              {/* Status Dot */}
              <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 shadow-sm transition-all duration-500 ${
                locationStatus === 'inside'
                  ? 'bg-green-500 animate-pulse'
                  : locationStatus === 'outside'
                    ? 'bg-red-500'
                    : 'bg-slate-400'
              }`} />
            </div>

            <div className="flex-1">
              {locationStatus === 'detecting' ? (
                <div className="space-y-1">
                  <p className="text-xs font-black text-slate-700 dark:text-slate-200">جاري تحديد الموقع...</p>
                  <p className="text-[10px] text-slate-500">يرجى الانتظار ثواني</p>
                </div>
              ) : locationStatus === 'inside' ? (
                <div className="space-y-0.5">
                  <p className="text-xs font-black text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                    أنت الآن داخل موقع العمل
                  </p>
                  <p className="text-[11px] font-bold text-teal-900 dark:text-teal-100">
                    {currentSiteName || 'الموقع المحدد'}
                  </p>
                </div>
              ) : locationStatus === 'outside' ? (
                <div className="space-y-0.5">
                  <p className="text-xs font-black text-red-700 dark:text-red-400">أنت خارج الموقع المحدد</p>
                  <p className="text-[10px] text-red-600/70 font-medium">لن تتمكن من تسجيل الحضور خارج النطاق المسموح</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <p className="text-xs font-black text-slate-700 dark:text-slate-200">خطأ في الموقع</p>
                  <p className="text-[10px] text-red-500 font-bold">{locationError || 'تعذر الوصول للموقع'}</p>
                </div>
              )}
            </div>

            {locationStatus === 'inside' && (
              <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-600">
                <Check size={16} className="stroke-[3]" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Primary Action Buttons (Check-in/Out) */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-2 gap-3 p-1 bg-slate-50 dark:bg-slate-800/50 rounded-[24px]">
          <div className="flex flex-col gap-2">
            <Button 
              onClick={() => handleAction('check_in')} 
              disabled={loading || (hasCheckIn && !allowAttendanceReRegistration)}
              className={`${(hasCheckIn && !allowAttendanceReRegistration) 
                ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-400' 
                : 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/10'
              } rounded-[20px] h-14 transition-all duration-300 font-bold border-0 w-full`}
            >
              {loading ? <Loader2 className="animate-spin ml-2" size={20} /> : ((hasCheckIn && !allowAttendanceReRegistration) ? <Check className="ml-2" size={20} /> : <LogIn className="ml-2" size={20} />)}
              {hasCheckIn 
                ? (allowAttendanceReRegistration ? 'إعادة تسجيل حضور' : 'تم تسجيل الحضور') 
                : 'تسجيل حضور'}
            </Button>
            {hasCheckIn && (
              <div className="flex flex-col items-center gap-1.5 mt-2 animate-in slide-in-from-top-2 duration-500">
                <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-950/30 px-3 py-1.5 rounded-xl border border-green-100 dark:border-green-900/50">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <p className="text-[11px] font-black text-green-700 dark:text-green-400">
                    وقت الحضور: {formatDisplayTime(effectiveAttendance.check_in)}
                  </p>
                </div>
                {effectiveAttendance.late_minutes > 0 && (
                  <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-xl border border-amber-100 dark:border-amber-900/50">
                    <AlertCircle size={10} className="text-amber-600 dark:text-amber-400" />
                    <p className="text-[10px] font-black text-amber-700 dark:text-amber-400">
                      متأخر: {effectiveAttendance.late_minutes} دقيقة
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button 
              onClick={() => handleAction('check_out')}
              disabled={loading || (hasCheckOut && !allowAttendanceReRegistration)}
              className={`${(hasCheckOut && !allowAttendanceReRegistration) 
                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400' 
                : 'bg-white hover:bg-red-50 text-red-600 border border-red-100'
              } rounded-[20px] h-14 transition-all duration-300 font-bold w-full`}
            >
               {loading ? <Loader2 className="animate-spin ml-2" size={20} /> : ((hasCheckOut && !allowAttendanceReRegistration) ? <Check className="ml-2" size={20} /> : <LogOut className="ml-2" size={20} />)}
               {hasCheckOut 
                ? (allowAttendanceReRegistration ? 'إعادة تسجيل انصراف' : 'تم تسجيل الانصراف') 
                : 'تسجيل انصراف'}
            </Button>
            {hasCheckOut && (
              <div className="flex flex-col items-center gap-1.5 mt-2 animate-in slide-in-from-top-2 duration-500">
                <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-xl border border-red-100 dark:border-red-900/50">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                  <p className="text-[11px] font-black text-red-700 dark:text-red-400">
                    وقت الانصراف: {formatDisplayTime(effectiveAttendance.check_out)}
                  </p>
                </div>
                {effectiveAttendance.early_exit_minutes > 0 && (
                  <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/30 px-3 py-1.5 rounded-xl border border-red-100 dark:border-red-900/50">
                    <Clock size={10} className="text-red-600 dark:text-red-400" />
                    <p className="text-[10px] font-black text-red-700 dark:text-red-400">
                      مبكر: {effectiveAttendance.early_exit_minutes} دقيقة
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Enrollment Banner (if needed) */}
      {currentEmployee.attendance_method === 'gps_photo' && !currentEmployee.face_descriptor && !showCamera && (
        <div className="mx-6 mb-6 p-4 bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/50 rounded-[24px] flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900 text-teal-600 rounded-2xl flex items-center justify-center shrink-0">
            <ScanFace size={24} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-teal-900 dark:text-teal-100">يجب إعداد بصمة وجهك لتفعيل التحقق الذكي</p>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-8 mt-1 text-[11px] bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-6"
              onClick={startCameraFlow}
              disabled={loading}
            >
              {loading ? <Loader2 size={12} className="animate-spin ml-2" /> : null}
              إعداد الآن
            </Button>
          </div>
        </div>
      )}

      {/* 5. Biometric Content / Status Center */}
      <div className="px-6 pb-8 flex-1 flex flex-col justify-center">
        {showCamera ? (
          <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-950 flex flex-col items-center justify-center animate-in fade-in duration-500">
            <div className="relative w-full max-w-[320px] aspect-square rounded-[80px] overflow-hidden border-8 border-slate-100 dark:border-slate-800 shadow-[0_0_80px_rgba(45,212,191,0.2)] bg-slate-900">
              <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-70" />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover z-20" />
              
              {/* Scan Guide Ticks */}
              <div className="absolute inset-0 z-30 pointer-events-none">
                {[...Array(60)].map((_, i) => {
                  const angle = (i * 6) * (Math.PI / 180);
                  const radius = 46;
                  const x = 50 + radius * Math.cos(angle);
                  const y = 50 + radius * Math.sin(angle);
                  const isActive = (i / 60) * 100 < scanProgress;
                  return (
                    <div 
                      key={i} 
                      className={`absolute w-0.5 h-4 transition-all duration-300 ${isActive ? 'bg-teal-400 scale-y-110 shadow-[0_0_8px_#2dd4bf]' : 'bg-slate-700'}`}
                      style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) rotate(${i * 6 + 90}deg)` }}
                    />
                  );
                })}
              </div>
            </div>

            <div className="mt-12 text-center max-w-[280px]">
              <h3 className="text-2xl font-black dark:text-white mb-2">{!currentEmployee?.face_descriptor ? 'إعداد البصمة الاحترافية' : 'جاري التحقق العميق'}</h3>
              <p className={`text-sm font-bold h-10 flex flex-col items-center justify-center ${!faceDetected ? 'text-slate-400' : (!isLive ? 'text-red-500 animate-bounce' : 'text-teal-500')}`}>
                {!faceDetected 
                  ? 'ضع وجهك داخل الإطار' 
                  : (!isLive 
                    ? '⚠️ تنبيه: تم اكتشاف محاولة تزييف (Liveness Failed)' 
                    : (blinkCount === 0
                      ? 'يرجى الرمش بالعين (Blink) 😉'
                      : (!headMoved
                        ? 'يرجى تحريك الرأس قليلاً 🔄'
                        : 'جاري مطابقة بصمة ArcFace...')))}
              </p>
              
              <div className="flex gap-4 mt-6 justify-center">
                 <div className="flex flex-col items-center gap-1">
                   <div className={`w-2 h-2 rounded-full ${blinkCount > 0 ? 'bg-teal-500 shadow-[0_0_8px_#2dd4bf]' : 'bg-slate-700'}`} />
                   <span className="text-[10px] text-slate-500 font-bold">Blink</span>
                 </div>
                 <div className="flex flex-col items-center gap-1">
                   <div className={`w-2 h-2 rounded-full ${headMoved ? 'bg-teal-500 shadow-[0_0_8px_#2dd4bf]' : 'bg-slate-700'}`} />
                   <span className="text-[10px] text-slate-500 font-bold">Motion</span>
                 </div>
                 <div className="flex flex-col items-center gap-1">
                   <div className={`w-2 h-2 rounded-full ${lightingScore > 0.4 ? 'bg-teal-500' : 'bg-amber-500'}`} />
                   <span className="text-[10px] text-slate-500 font-bold">Light</span>
                 </div>
              </div>

              <div className="w-48 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-6 overflow-hidden">
                <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${scanProgress}%` }} />
              </div>
            </div>
            
            <Button variant="ghost" className="mt-20 text-slate-400 hover:text-slate-600 font-bold" onClick={clearCamera}>إلغاء العملية</Button>
          </div>
        ) : isInitializing ? (
          <div className="p-12 rounded-[40px] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col items-center animate-in zoom-in duration-500">
            <div className="relative mb-6">
              <div className="w-16 h-16 border-4 border-teal-100 rounded-full border-t-teal-600 animate-spin"></div>
              <ScanFace size={24} className="absolute inset-0 m-auto text-teal-600" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">جاري تهيئة النظام</h3>
          </div>
        ) : !currentEmployee.face_descriptor ? (
          /* Show Large Setup Card only if NOT enrolled */
          <div className="p-8 rounded-[40px] bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center animate-in fade-in slide-in-from-bottom-4">
            <div className="w-20 h-20 bg-teal-50 dark:bg-teal-900/20 rounded-[30px] flex items-center justify-center text-teal-600 mb-6 border border-teal-100 dark:border-teal-800/50">
              <ScanFace size={40} />
            </div>
            
            <div className="text-center space-y-2 mb-8">
              <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                إعداد بصمة الوجه (3D)
              </h3>
              <p className="text-xs text-slate-500 max-w-[220px] mx-auto leading-relaxed">
                سجل ملامح وجهك الفريدة لمرة واحدة لتفعيل نظام الحضور الذكي والتحقق الفائق من الهوية.
              </p>
            </div>

            <Button 
              onClick={startCameraFlow}
              disabled={loading || isInitializing || !modelsLoaded}
              className="w-full max-w-[240px] h-14 bg-teal-600 hover:bg-teal-700 text-white rounded-[22px] font-black text-lg shadow-xl shadow-teal-600/20 transition-all hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-3"
            >
              {!modelsLoaded ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span className="text-xs">جاري التحميل...</span>
                </>
              ) : (
                <>
                  <ScanFace size={24} />
                  بدء المسح الآن
                </>
              )}
            </Button>
            
            <div className="mt-6 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">نظام تشفير آمن BIT-256</p>
            </div>
          </div>
        ) : (
          /* Clean Summary View if already enrolled */
          <div className="flex flex-col items-center py-10 animate-in fade-in duration-500">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-teal-500/10 rounded-full animate-pulse blur-xl"></div>
              <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-full shadow-[0_15px_30px_rgba(20,184,166,0.15)] dark:shadow-none border-2 border-teal-500/20 flex items-center justify-center text-teal-600 relative z-10">
                <Check size={40} className="animate-in zoom-in duration-700" />
              </div>
              <div className="absolute -top-1 -right-1 bg-teal-500 text-white w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-lg">
                <ScanFace size={16} />
              </div>
            </div>
            
            <div className="text-center">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Face ID نشط وآمن</h3>
              <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-widest font-bold">Encrypted Biometric Data</p>
            </div>
            
            <div className="grid grid-cols-3 gap-2 w-full max-w-[280px] mt-8">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500/40 w-full" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showBiometric && (
        <div className="mx-6 mb-6 p-6 rounded-[32px] bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 rounded-3xl flex items-center justify-center mb-4">
            <Fingerprint size={32} />
          </div>
          <h3 className="font-bold text-indigo-900 dark:text-indigo-100 mb-1">التحقق بالبصمة</h3>
          <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mb-6">يرجى تأكيد هويتك باستخدام بصمة هاتفك</p>
          <div className="flex gap-2 w-full">
            <Button onClick={handleBiometricConfirm} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11">بدء التحقق</Button>
            <Button variant="ghost" size="icon" className="rounded-xl h-11 w-11 text-slate-400" onClick={() => setShowBiometric(false)}>×</Button>
          </div>
        </div>
      )}

      {/* Centered Attendance Success Modal */}
      {showSuccessOverlay && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 max-w-xs w-full flex flex-col items-center shadow-2xl animate-in zoom-in slide-in-from-bottom-20 duration-500">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 mb-6 relative">
              <div className="absolute inset-0 bg-green-400/20 rounded-full animate-ping"></div>
              <Check size={48} className="stroke-[3] relative z-10 animate-in zoom-in duration-700 delay-300" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 text-center leading-tight">
              {successMessage}
            </h3>
            <p className="text-sm text-slate-500 text-center">بصمة الوجه (3D) مفعلة ومؤكدة</p>
            
            <div className="mt-8 w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
               <div className="h-full bg-green-500 animate-[progress_3s_linear]" />
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes progress {
                from { width: 100%; }
                to { width: 0%; }
              }
            `}} />
          </div>
        </div>
      )}
    </div>
  );
}
