import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Smartphone, Bell, MapPin, Power, 
  CheckCircle2, ArrowRight
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { subscribeToPushNotifications } from "@/lib/pushNotifications";
import { cn } from "@/lib/utils";

export default function Onboarding() {
  const { driver, user, refreshDriver } = useAuth();
  const navigate = useNavigate();
  
  // State for each step
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  
  const [checkingPwa, setCheckingPwa] = useState(false);
  const [completing, setCompleting] = useState(false);
  
  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  // Check initial statuses
  useEffect(() => {
    // 1. PWA check
    const checkPwa = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone);
      setPwaInstalled(!!isStandalone);
    };
    checkPwa();

    // Listen for display mode changes (if installed while app is open)
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (evt) => {
      setPwaInstalled(evt.matches);
    });

    // 2. Notification check
    if (("Notification" in window) && Notification.permission === "granted") {
      setNotificationsEnabled(true);
    }
  }, []);

  const handleCheckPwa = () => {
    setCheckingPwa(true);
    setTimeout(() => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone);
      if (isStandalone) {
        setPwaInstalled(true);
        toast.success("App installed successfully!");
      } else {
        toast.error("It looks like you are still in the browser. Please follow the installation instructions.");
      }
      setCheckingPwa(false);
    }, 1000);
  };

  const requestNotifications = async () => {
    if (!user) return;
    if (!("Notification" in window)) {
      toast.error("Notifications are not supported in this browser.");
      return;
    }
    
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await subscribeToPushNotifications(user.id);
        setNotificationsEnabled(true);
        toast.success("Notifications enabled!");
      } else {
        toast.error("You can enable notifications later from your browser settings.");
      }
    } catch (err) {
      toast.error("Failed to request notification permission.");
    }
  };

  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported in this browser.");
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationEnabled(true);
        toast.success("Location services enabled!");
      },
      (error) => {
        toast.error("Drivers cannot receive ride requests while location is disabled. Please allow location access in your browser settings.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
  };

  const handleGoOnline = async () => {
    if (!driver) return;
    setCompleting(true);
    try {
      // End any existing active session
      await supabase
        .from("driver_sessions")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("driver_id", driver.id)
        .eq("is_active", true);

      const { error: sessionError } = await supabase
        .from("driver_sessions")
        .insert({ driver_id: driver.id, is_active: true });

      if (sessionError) throw sessionError;

      // Mark onboarding as completed in the database
      const { data: updatedDriver, error: updateError } = await supabase
        .from("drivers")
        .update({ onboarding_completed: true })
        .eq("id", driver.id)
        .select("onboarding_completed")
        .single();

      if (updateError) throw updateError;
      if (!updatedDriver || updatedDriver.onboarding_completed !== true) {
        throw new Error("Onboarding completion not persisted");
      }

      // CRITICAL: Refresh the in-memory driver state so ProtectedRoute
      // sees onboarding_completed = true before we navigate away.
      // Without this, ProtectedRoute bounces us back to /onboarding.
      await refreshDriver();

      toast.success("You are now online and ready to receive rides!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error("Failed to complete setup. Please try again.");
      setCompleting(false);
    }
  };

  const steps = [
    { completed: pwaInstalled },
    { completed: notificationsEnabled },
    { completed: locationEnabled },
  ];
  
  const completedCount = steps.filter(s => s.completed).length;
  const progressPercent = (completedCount / steps.length) * 100;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 pb-24 overflow-y-auto">
      <div className="pt-8 pb-6">
        <h1 className="text-3xl font-display font-bold text-white mb-2">Complete Your Setup</h1>
        <p className="text-muted-foreground text-sm">
          Complete these steps before you can start receiving ride requests.
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-semibold text-white mb-3 tracking-wider uppercase">
          <span>Setup Progress</span>
          <span>{completedCount} / {steps.length} Steps</span>
        </div>
        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {/* Step 1: PWA */}
        <div className={cn(
          "rounded-3xl p-5 border transition-all duration-300",
          pwaInstalled 
            ? "bg-emerald-500/10 border-emerald-500/30" 
            : "bg-[#141414] border-white/5"
        )}>
          <div className="flex items-start gap-4">
            <div className={cn(
              "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0",
              pwaInstalled ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white"
            )}>
              {pwaInstalled ? <CheckCircle2 className="h-6 w-6" /> : <Smartphone className="h-6 w-6" />}
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white mb-1">Install Driver App</h3>
              <p className="text-xs text-white/60 mb-4 leading-relaxed">
                {pwaInstalled 
                  ? "App successfully installed on your device."
                  : "Install Easi Ride on your home screen for the fastest experience."}
              </p>
              
              {!pwaInstalled && (
                <div className="space-y-4">
                  <div className="p-3 bg-black/40 rounded-2xl border border-white/5 text-xs text-white/80 space-y-2">
                    {isIOS ? (
                      <ol className="list-decimal pl-4 space-y-1">
                        <li>Tap <b>Share</b> <ArrowRight className="inline h-3 w-3" /></li>
                        <li>Select <b>"Add to Home Screen"</b></li>
                        <li>Tap <b>Add</b></li>
                      </ol>
                    ) : (
                      <ol className="list-decimal pl-4 space-y-1">
                        <li>Tap the browser menu <b>(⋮)</b></li>
                        <li>Tap <b>"Add to Home screen"</b></li>
                        <li>Tap <b>Install</b></li>
                        <li>Open the app from your home screen</li>
                      </ol>
                    )}
                  </div>
                  
                  <button 
                    onClick={handleCheckPwa}
                    disabled={checkingPwa}
                    className="w-full py-3.5 bg-white text-black text-sm font-bold rounded-2xl hover:bg-white/90 transition-colors disabled:opacity-50"
                  >
                    {checkingPwa ? "Checking..." : "I've Installed It"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Notifications */}
        <div className={cn(
          "rounded-3xl p-5 border transition-all duration-300",
          notificationsEnabled 
            ? "bg-emerald-500/10 border-emerald-500/30" 
            : "bg-[#141414] border-white/5"
        )}>
          <div className="flex items-start gap-4">
            <div className={cn(
              "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0",
              notificationsEnabled ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white"
            )}>
              {notificationsEnabled ? <CheckCircle2 className="h-6 w-6" /> : <Bell className="h-6 w-6" />}
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white mb-1">Enable Notifications</h3>
              <p className="text-xs text-white/60 mb-4 leading-relaxed">
                {notificationsEnabled
                  ? "Notifications are enabled."
                  : "Notifications alert you instantly when a new passenger requests a ride."}
              </p>
              
              {!notificationsEnabled && (
                <button 
                  onClick={requestNotifications}
                  disabled={!pwaInstalled} // Enforce order
                  className="w-full py-3.5 bg-white text-black text-sm font-bold rounded-2xl hover:bg-white/90 transition-colors disabled:opacity-30 disabled:hover:bg-white"
                >
                  Enable Notifications
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Location */}
        <div className={cn(
          "rounded-3xl p-5 border transition-all duration-300",
          locationEnabled 
            ? "bg-emerald-500/10 border-emerald-500/30" 
            : "bg-[#141414] border-white/5"
        )}>
          <div className="flex items-start gap-4">
            <div className={cn(
              "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0",
              locationEnabled ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white"
            )}>
              {locationEnabled ? <CheckCircle2 className="h-6 w-6" /> : <MapPin className="h-6 w-6" />}
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white mb-1">Enable Location</h3>
              <p className="text-xs text-white/60 mb-4 leading-relaxed">
                {locationEnabled
                  ? "Location services are active."
                  : "Easi Ride needs your live location so nearby passengers can find you."}
              </p>
              
              {!locationEnabled && (
                <button 
                  onClick={requestLocation}
                  disabled={!notificationsEnabled}
                  className="w-full py-3.5 bg-white text-black text-sm font-bold rounded-2xl hover:bg-white/90 transition-colors disabled:opacity-30 disabled:hover:bg-white"
                >
                  Enable Location
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Step 4: Go Online */}
        <div className={cn(
          "rounded-3xl p-5 border transition-all duration-300 mt-8",
          (pwaInstalled && notificationsEnabled && locationEnabled)
            ? "bg-emerald-500 border-emerald-400" 
            : "bg-[#141414] border-white/5 opacity-50"
        )}>
          <div className="flex flex-col items-center text-center">
            <div className={cn(
              "h-16 w-16 rounded-full flex items-center justify-center mb-4 transition-colors",
              (pwaInstalled && notificationsEnabled && locationEnabled)
                ? "bg-white/20 text-white"
                : "bg-white/5 text-white/40"
            )}>
              <Power className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-display font-bold text-white mb-2">Go Online</h3>
            <p className={cn(
              "text-xs mb-6",
              (pwaInstalled && notificationsEnabled && locationEnabled) ? "text-white/90" : "text-white/40"
            )}>
              You are now ready to receive ride requests.
            </p>
            
            <button 
              onClick={handleGoOnline}
              disabled={!(pwaInstalled && notificationsEnabled && locationEnabled) || completing}
              className="w-full py-4 bg-white text-black text-base font-display font-bold rounded-2xl hover:bg-white/90 transition-all shadow-lg shadow-white/20 disabled:shadow-none disabled:opacity-0 disabled:pointer-events-none"
            >
              {completing ? "Going Online..." : "Start Driving"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
