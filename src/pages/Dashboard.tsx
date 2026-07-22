import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Power, Wifi, WifiOff, Car, Bell, X, TrendingUp, Smartphone, Monitor, MapPin, CheckCircle2, Loader2, Share2, Plus, Clock, Navigation, AlertTriangle } from "lucide-react";
import * as Drawer from "vaul";
import { toast } from "sonner";
import { cn, formatTime, formatNLe } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useRideRequest, IncomingRide } from "@/hooks/useRideRequest";
import { useGeolocation } from "@/hooks/useGeolocation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { subscribeToPushNotifications, getExistingPushSubscription } from "@/lib/pushNotifications";

export default function Dashboard() {
  const { user, driver, refreshDriver } = useAuth();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toISOString());
  const [pushState, setPushState] = useState<"loading" | "prompt" | "enabled" | "unsupported">("loading");
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [todayRides, setTodayRides] = useState(0);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showIosPwaGuide, setShowIosPwaGuide] = useState(false);

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  const { startWatching, stopWatching } = useGeolocation(null);
  const { incomingRide, incomingRides, pendingCount, acceptRide, declineRide } = useRideRequest({
    enabled: isOnline,
  });

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date().toISOString()), 30000);
    return () => clearInterval(id);
  }, []);

  // Check for active session on mount
  useEffect(() => {
    if (!driver) return;
    supabase
      .from("driver_sessions")
      .select("id")
      .eq("driver_id", driver.id)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSessionId(data.id);
          setIsOnline(true);
          startWatching();
        }
      });
  }, [driver, startWatching]);

  const activeRideCheckedRef = useRef(false);

  // Redirect to active ride once on load (not on every dashboard visit)
  useEffect(() => {
    if (!driver || activeRideCheckedRef.current) return;
    activeRideCheckedRef.current = true;
    supabase
      .from("rides")
      .select("id, status, updated_at")
      .eq("driver_id", driver.id)
      .in("status", ["driver_assigned", "driver_arrived", "in_progress"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          navigate(`/ride/${data.id}`, { replace: true });
        }
      });
  }, [driver, navigate]);

  // Check PWA installation
  useEffect(() => {
    const checkPwa = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as any).standalone);
      setIsPwaInstalled(!!isStandalone);
    };
    checkPwa();

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Check onboarding status
  useEffect(() => {
    if (!driver) return;
    if (driver.onboarding_completed === false && !localStorage.getItem("easiride_onboarding_done")) {
      setShowOnboarding(true);
    }
  }, [driver]);

  // Check location permission
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.permissions?.query({ name: 'geolocation' }).then((result) => {
      setLocationEnabled(result.state === 'granted');
    }).catch(() => {});
  }, []);

  // Fetch earnings data
  useEffect(() => {
    if (!driver) return;
    const fetchEarnings = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data } = await supabase
        .from("rides")
        .select("fare_amount, created_at")
        .eq("driver_id", driver.id)
        .eq("status", "completed")
        .gte("created_at", today.toISOString());

      if (data) {
        const earnings = data.reduce((sum, ride) => {
          if (!ride.fare_amount) return sum;
          return sum + Math.floor(ride.fare_amount * 0.8);
        }, 0);
        setTotalEarnings(earnings);
        setTodayRides(data.length);
      }
    };
    fetchEarnings();
  }, [driver]);

  const goOnline = useCallback(async () => {
    if (!driver) return;
    setToggling(true);
    try {
      // Close any stale active sessions first
      await supabase
        .from("driver_sessions")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("driver_id", driver.id)
        .eq("is_active", true);

      const { data, error } = await supabase
        .from("driver_sessions")
        .insert({ driver_id: driver.id, is_active: true })
        .select("id")
        .single();

      if (error) throw error;

      setSessionId(data.id);
      setIsOnline(true);
      startWatching();
      toast.success("You're online! Waiting for ride requests.");
    } catch {
      toast.error("Failed to go online. Try again.");
    } finally {
      setToggling(false);
    }
  }, [driver, startWatching]);

  const goOffline = useCallback(async () => {
    if (!sessionId) return;
    setToggling(true);
    try {
      await supabase
        .from("driver_sessions")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("id", sessionId);

      setSessionId(null);
      setIsOnline(false);
      stopWatching();
      toast("You're offline.");
    } catch {
      toast.error("Failed to go offline. Try again.");
    } finally {
      setToggling(false);
    }
  }, [sessionId, stopWatching]);

  const handleToggle = () => {
    if (isOnline) {
      goOffline();
    } else {
      goOnline();
    }
  };

  const handleAcceptRide = useCallback(async (ride: IncomingRide) => {
    const ok = await acceptRide(ride.id, ride.invitation_id, ride.user_id);
    if (ok) {
      toast.success("Ride accepted! Head to the pickup.");
      navigate(`/ride/${ride.id}`);
    } else {
      toast.error("Failed to accept ride.");
    }
  }, [acceptRide, navigate]);

  const handleDeclineRide = useCallback(async (ride: IncomingRide) => {
    const ok = await declineRide(ride.id);
    if (ok) {
      toast("Ride declined.");
    } else {
      toast.error("Failed to decline ride.");
    }
  }, [declineRide]);

  // Check push notification state
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("unsupported");
      return;
    }
    if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) {
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushState("unsupported");
      return;
    }
    getExistingPushSubscription().then((sub) => {
      setPushState(sub ? "enabled" : "prompt");
    });
  }, []);

  const enableNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      await subscribeToPushNotifications(user.id);
      setPushState("enabled");
      toast.success("Push notifications enabled");
    } catch {
      toast.error("Could not enable notifications. Check your browser settings.");
    }
  };

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsPwaInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      toast.info("Please use your browser's 'Add to Home Screen' option to install the app.");
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationEnabled(true);
        toast.success("Location enabled!");
      },
      () => {
        toast.error("Please allow location access in your browser settings.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
  };

  const completeOnboarding = async () => {
    if (!driver) return;
    try {
      const { error } = await supabase
        .from("drivers")
        .update({ onboarding_completed: true })
        .eq("id", driver.id);

      if (error) throw error;
      await refreshDriver();
      localStorage.setItem("easiride_onboarding_done", "1");
      setShowOnboarding(false);
      toast.success("Setup complete!");
    } catch {
      toast.error("Failed to save setup status.");
    }
  };

  const firstName = driver?.full_name?.split(" ")[0] ?? "Driver";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Incoming Requests Queue */}
      {incomingRides.length > 0 && (
        <div className="px-5 pt-2 mb-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-semibold">Incoming Requests</h2>
            <Badge variant="destructive" className="text-[10px]">{pendingCount} pending</Badge>
          </div>
          <div className="space-y-3">
            {incomingRides.map((ride, idx) => (
              <RequestCard
                key={ride.id}
                ride={ride}
                queuePosition={idx + 1}
                queueTotal={pendingCount}
                onAccept={() => handleAcceptRide(ride)}
                onDecline={() => handleDeclineRide(ride)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-5 pt-14 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {greeting}
            </p>
            <h1 className="text-2xl font-display font-bold text-foreground mt-0.5">
              {firstName}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Online indicator dot */}
            {isOnline && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            )}
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors",
                isOnline
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-hairline bg-secondary text-muted-foreground"
              )}
            >
              {isOnline ? (
                <Wifi className="h-4 w-4" />
              ) : (
                <WifiOff className="h-4 w-4" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-5 space-y-5">
        {/* Earnings Overview Card */}
        {(totalEarnings > 0 || todayRides > 0) && (
          <div className="glass-card rounded-3xl p-5 shadow-soft bg-emerald-500/5 border-emerald-500/20">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20">
                <TrendingUp className="h-6 w-6 text-emerald-400" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-[0.15em] text-emerald-400/80 mb-0.5">
                  Today's Earnings
                </p>
                <p className="text-2xl font-display font-bold text-emerald-400">
                  {formatNLe(totalEarnings)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {todayRides} ride{todayRides !== 1 ? 's' : ''} completed
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PWA Install Reminder */}
        {!isPwaInstalled && (
          <div className="glass-card rounded-3xl p-5 border border-primary/20 bg-primary/5 shadow-soft">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-foreground">Install Easi Ride</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  Install Easi Ride to receive faster ride alerts and a better experience.
                </p>
                <button
                  onClick={handleInstallPwa}
                  className="w-full rounded-2xl bg-foreground py-3 text-sm font-bold text-background hover:bg-foreground/90 transition-colors"
                >
                  Install
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Push notification enable banner */}
        {pushState === "prompt" && (
          <div className="glass-card rounded-3xl p-5 border border-primary/20 bg-primary/5 shadow-soft">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Bell className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-foreground">Enable Notifications</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  You may miss ride requests if notifications are disabled.
                </p>
                <button
                  onClick={enableNotifications}
                  className="w-full rounded-2xl bg-foreground py-3 text-sm font-bold text-background hover:bg-foreground/90 transition-colors"
                >
                  Enable
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GO ONLINE / OFFLINE toggle */}
        <div className="glass-card rounded-3xl p-6 shadow-elevated">
          <div className="flex flex-col items-center text-center">
            {/* Status pill */}
            <div
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6 transition-all duration-300",
                isOnline
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-hairline bg-secondary"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isOnline ? "bg-emerald-500" : "bg-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-xs font-semibold uppercase tracking-[0.15em]",
                  isOnline ? "text-emerald-400" : "text-muted-foreground"
                )}
              >
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>

            {/* Big toggle button */}
            <button
              id="btn-toggle-online"
              onClick={handleToggle}
              disabled={toggling}
              className={cn(
                "relative flex h-36 w-36 items-center justify-center rounded-full transition-all duration-500 shadow-elevated",
                isOnline
                  ? "bg-emerald-500 shadow-[0_0_60px_rgba(52,211,153,0.35)]"
                  : "bg-secondary border border-hairline",
                toggling && "opacity-70 cursor-not-allowed"
              )}
            >
              {/* Outer ring */}
              {isOnline && (
                <span className="absolute inset-0 rounded-full animate-ping-slow bg-emerald-500/20" />
              )}
              <div className="flex flex-col items-center gap-1">
                <Power
                  className={cn(
                    "h-10 w-10 transition-all duration-300",
                    isOnline ? "text-white" : "text-muted-foreground"
                  )}
                  strokeWidth={1.5}
                />
                <span
                  className={cn(
                    "text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300",
                    isOnline ? "text-white" : "text-muted-foreground"
                  )}
                >
                  {toggling ? "..." : isOnline ? "GO OFFLINE" : "GO ONLINE"}
                </span>
              </div>
            </button>

            <p className="text-xs text-muted-foreground mt-6 max-w-[200px] leading-relaxed">
              {isOnline
                ? "You are visible to students. New rides will appear automatically."
                : "Tap to start receiving ride requests from students."}
            </p>
          </div>
        </div>

        {/* Vehicle info card */}
        {driver && (
          <div className="glass-card rounded-3xl p-5 shadow-soft">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
                <Car className="h-6 w-6 text-primary" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Your Vehicle
                </p>
                <p className="text-base font-semibold text-foreground mt-0.5 truncate">
                  {driver.vehicle}
                </p>
                {driver.plate_number && (
                  <p className="text-xs text-muted-foreground font-mono">
                    {driver.plate_number}
                  </p>
                )}
              </div>
              <Badge
                variant={
                  driver.status === "active" ? "success" : "outline"
                }
                className="flex-shrink-0 uppercase text-[9px] tracking-wider"
              >
                {driver.status}
              </Badge>
            </div>
          </div>
        )}

        {/* Waiting state when online */}
        {isOnline && incomingRides.length === 0 && (
          <div className="glass-card rounded-3xl p-6 shadow-soft text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-primary animate-pulse-slow" />
                </div>
              </div>
              <p className="text-sm font-medium text-foreground">
                Waiting for ride requests
              </p>
              <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
                Stay connected. New requests will appear here as cards.
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {formatTime(currentTime)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Onboarding setup drawer */}
      <Drawer.Root open={showOnboarding} onOpenChange={setShowOnboarding} dismissible={true}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl bg-[#1A1A1A] border-t border-hairline outline-none max-h-[85dvh] overflow-hidden">
            <div className="mx-auto mt-3 mb-2 h-1.5 w-12 rounded-full bg-border flex-shrink-0" />
            <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-4 min-h-0">
              {/* Header */}
              <div className="flex items-center justify-between pt-2">
                <h2 className="text-lg font-display font-bold text-white">Complete Setup</h2>
                <button onClick={() => setShowOnboarding(false)} className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
              <p className="text-xs text-white/60 -mt-2">
                Complete these steps for the best experience. You can always do this later.
              </p>

              {/* Step 1: PWA */}
              <div className={cn("rounded-2xl p-4 border transition-colors", isPwaInstalled ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/10")}>
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", isPwaInstalled ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white")}>
                    {isPwaInstalled ? <CheckCircle2 className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">Install App</p>
                    <p className="text-xs text-white/60">Install Easi Ride on your device</p>
                  </div>
                  {!isPwaInstalled && !isIOS && (
                    <button onClick={handleInstallPwa} className="shrink-0 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black">
                      Install
                    </button>
                  )}
                  {!isPwaInstalled && isIOS && !showIosPwaGuide && (
                    <button onClick={() => setShowIosPwaGuide(true)} className="shrink-0 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black">
                      Install
                    </button>
                  )}
                </div>
                {!isPwaInstalled && isIOS && showIosPwaGuide && (
                  <div className="mt-3 p-3 bg-black/40 rounded-xl border border-white/10 text-xs text-white/80 space-y-3">
                    <ol className="list-decimal pl-4 space-y-2.5">
                      <li>Tap the <b>Share icon</b> <Share2 className="inline h-3.5 w-3.5" /> at the bottom of Safari</li>
                      <li>Scroll down and tap <b>"Add to Home Screen"</b> <Plus className="inline h-3.5 w-3.5" /></li>
                      <li>Tap <b>"Add"</b> in the top-right corner</li>
                      <li>Open Easi Ride from your <b>home screen</b></li>
                    </ol>
                    <div className="flex gap-2">
                      <button onClick={handleInstallPwa} className="flex-1 py-2.5 bg-white text-black text-xs font-bold rounded-xl hover:bg-white/90 transition-colors">
                        I've Installed It
                      </button>
                      <button onClick={() => setShowIosPwaGuide(false)} className="py-2.5 px-4 text-white/60 text-xs rounded-xl hover:bg-white/10 transition-colors">
                        Hide
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Notifications */}
              <div className={cn("rounded-2xl p-4 border transition-colors", pushState === "enabled" ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/10")}>
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", pushState === "enabled" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white")}>
                    {pushState === "enabled" ? <CheckCircle2 className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">Notifications</p>
                    <p className="text-xs text-white/60">Get instant ride request alerts</p>
                  </div>
                  {pushState === "prompt" && (
                    <button onClick={enableNotifications} className="shrink-0 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black">
                      Enable
                    </button>
                  )}
                </div>
              </div>

              {/* Step 3: Location */}
              <div className={cn("rounded-2xl p-4 border transition-colors", locationEnabled ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/10")}>
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", locationEnabled ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white")}>
                    {locationEnabled ? <CheckCircle2 className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">Location</p>
                    <p className="text-xs text-white/60">Let nearby students find you</p>
                  </div>
                  {!locationEnabled && (
                    <button onClick={requestLocation} className="shrink-0 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black">
                      Enable
                    </button>
                  )}
                </div>
              </div>

              {/* Complete button */}
              {isPwaInstalled && pushState === "enabled" && locationEnabled && (
                <button onClick={completeOnboarding}
                  className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-white text-black text-sm font-bold hover:bg-white/90 transition-colors">
                  <CheckCircle2 className="h-5 w-5" />
                  Complete Setup
                </button>
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

function RequestCard({ ride, queuePosition, queueTotal, onAccept, onDecline }: {
  ride: IncomingRide;
  queuePosition: number;
  queueTotal: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [countdown, setCountdown] = useState(30);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const isUrgent = countdown <= 10;

  useEffect(() => {
    if (countdown <= 0) {
      onDecline();
      return;
    }
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown, onDecline]);

  const initial = ride.student_name?.charAt(0)?.toUpperCase() || "P";

  const handleAccept = async () => {
    setAccepting(true);
    await onAccept();
    setAccepting(false);
  };

  const handleDecline = async () => {
    setDeclining(true);
    await onDecline();
    setDeclining(false);
  };

  return (
    <div className={cn(
      "glass-card rounded-2xl p-4 border transition-all",
      isUrgent ? "border-destructive/30 bg-destructive/5" : "border-hairline"
    )}>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border-2 border-primary/20">
          <span className="text-base font-bold text-primary">{initial}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{ride.student_name || "Passenger"}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground">#{queuePosition} of {queueTotal}</span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <p className="text-[10px] text-muted-foreground truncate">{ride.type ? ride.type.replace(/_/g, " ") : "Ride"}</p>
          </div>
          {ride.fare_amount != null && (
            <p className="text-xs font-semibold text-emerald-400 mt-0.5">You'll earn: {formatNLe(Math.floor(ride.fare_amount * 0.8))}</p>
          )}
        </div>
        <div className={cn(
          "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold",
          isUrgent ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"
        )}>
          <Clock className="h-3 w-3" />
          <span>{countdown}s</span>
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="truncate text-foreground/80">{ride.pickup}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Navigation className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="truncate text-foreground/80">{ride.destination}</span>
        </div>
        {ride.distance_km && (
          <p className="text-[10px] text-muted-foreground pl-5">{ride.distance_km.toFixed(1)} km</p>
        )}
      </div>

      {isUrgent && (
        <div className="flex items-center gap-1.5 mb-3 text-[10px] text-destructive">
          <AlertTriangle className="h-3 w-3" />
          <span>Expiring soon</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 rounded-xl h-10 text-xs font-semibold"
          onClick={handleDecline}
          disabled={declining}
        >
          {declining ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Decline
        </Button>
        <Button
          size="sm"
          className="flex-1 rounded-xl h-10 text-xs font-semibold"
          onClick={handleAccept}
          disabled={accepting}
        >
          {accepting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Accept
        </Button>
      </div>
    </div>
  );
}
