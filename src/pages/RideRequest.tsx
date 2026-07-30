import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Bell, Calendar, MapPin, Clock, Check, X, Loader2, Navigation, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn, formatNLe } from "@/lib/utils";
import type { IncomingRide } from "@/hooks/useRideRequest";

type Tab = "rides" | "weekly";

const COUNTDOWN_SECONDS = 30;

interface WeeklyRequest {
  id: string;
  studentName: string;
  pickup: string;
  destination: string;
  schedule: string;
  price: number;
  status: "pending" | "accepted" | "declined";
}

const MOCK_WEEKLY: WeeklyRequest[] = [
  { id: "w1", studentName: "Fatmata Kamara", pickup: "Campus Gate A", destination: "City Centre", schedule: "Mon, Wed, Fri — 8:00 AM", price: 450, status: "pending" },
  { id: "w2", studentName: "John Sesay", pickup: "Student Hostel B", destination: "Lumley Beach Road", schedule: "Tue, Thu — 5:30 PM", price: 350, status: "pending" },
  { id: "w3", studentName: "Mariatu Bangura", pickup: "East Side Campus", destination: "Market Area", schedule: "Mon-Fri — 7:00 AM & 4:00 PM", price: 600, status: "pending" },
];

function RideCard({ ride, onAccept, onDecline, queuePosition, queueTotal }: {
  ride: IncomingRide;
  onAccept: () => void;
  onDecline: () => void;
  queuePosition: number;
  queueTotal: number;
}) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const isUrgent = secondsLeft <= 10;
  const autoDeclinedRef = useRef(false);

  useEffect(() => {
    setSecondsLeft(COUNTDOWN_SECONDS);
    autoDeclinedRef.current = false;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    const autoDecline = setTimeout(() => {
      if (!autoDeclinedRef.current) { autoDeclinedRef.current = true; onDecline(); }
    }, COUNTDOWN_SECONDS * 1000);
    return () => { clearInterval(timer); clearTimeout(autoDecline); };
  }, [ride.id, ride.invitation_id, onDecline]);

  const handleAccept = async () => { setAccepting(true); await onAccept(); setAccepting(false); };
  const handleDecline = async () => { setDeclining(true); await onDecline(); setDeclining(false); };
  const initial = ride.student_name?.charAt(0)?.toUpperCase() || "P";

  return (
    <div className={cn("glass-card rounded-2xl p-4 border transition-all", isUrgent ? "border-destructive/30 bg-destructive/5" : "border-hairline")}>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border-2 border-primary/20">
          <span className="text-base font-bold text-primary">{initial}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{ride.student_name || "Passenger"}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {queueTotal > 1 && <><span className="text-[10px] text-muted-foreground">#{queuePosition} of {queueTotal}</span><span className="text-[10px] text-muted-foreground">·</span></>}
            <span className="text-[10px] text-muted-foreground capitalize">{ride.type?.replace(/_/g, " ") || "Ride"}</span>
          </div>
          {ride.fare_amount != null && <p className="text-xs font-semibold text-emerald-400 mt-0.5">You'll earn: {formatNLe(Math.floor(ride.fare_amount * 0.8))}</p>}
        </div>
        <div className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold tabular-nums", isUrgent ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground")}>
          <Clock className="h-3 w-3" /><span>{secondsLeft}s</span>
        </div>
      </div>
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2 text-xs"><MapPin className="h-3 w-3 text-muted-foreground shrink-0" /><span className="truncate text-foreground/80">{ride.pickup}</span></div>
        <div className="flex items-center gap-2 text-xs"><Navigation className="h-3 w-3 text-muted-foreground shrink-0" /><span className="truncate text-foreground/80">{ride.destination}</span></div>
        {ride.distance_km != null && <p className="text-[10px] text-muted-foreground pl-5">{ride.distance_km.toFixed(1)} km</p>}
      </div>
      {isUrgent && <div className="flex items-center gap-1.5 mb-3 text-[10px] text-destructive"><AlertTriangle className="h-3 w-3" /><span>Expiring soon</span></div>}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 rounded-xl h-10 text-xs font-semibold" onClick={handleDecline} disabled={declining || accepting}>
          {declining ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3.5 w-3.5 mr-1" />} Decline
        </Button>
        <Button size="sm" className="flex-1 rounded-xl h-10 text-xs font-semibold" onClick={handleAccept} disabled={accepting || declining}>
          {accepting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />} Accept
        </Button>
      </div>
    </div>
  );
}

function WeeklyCard({ req, onAccept, onDecline, acceptingId }: {
  req: WeeklyRequest;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  acceptingId: string | null;
}) {
  return (
    <div className={cn("glass-card rounded-2xl p-4 border transition-all", req.status === "accepted" ? "border-emerald-500/30 bg-emerald-500/5" : req.status === "declined" ? "border-destructive/30 bg-destructive/5 opacity-60" : "border-hairline")}>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border-2 border-primary/20">
          <span className="text-base font-bold text-primary">{req.studentName.charAt(0)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{req.studentName}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{req.status === "accepted" ? "Accepted" : req.status === "declined" ? "Declined" : "Pending review"}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-emerald-400">{formatNLe(req.price)}<span className="text-[10px] text-muted-foreground font-normal">/wk</span></p>
        </div>
      </div>
      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2 text-xs"><MapPin className="h-3 w-3 text-muted-foreground shrink-0" /><span className="truncate text-foreground/80">{req.pickup} → {req.destination}</span></div>
        <div className="flex items-center gap-2 text-xs"><Clock className="h-3 w-3 text-muted-foreground shrink-0" /><span className="text-foreground/80">{req.schedule}</span></div>
      </div>
      {req.status === "pending" && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 rounded-xl h-10 text-xs font-semibold" onClick={() => onDecline(req.id)} disabled={acceptingId === req.id}>
            <X className="h-3.5 w-3.5 mr-1" /> Decline
          </Button>
          <Button size="sm" className="flex-1 rounded-xl h-10 text-xs font-semibold" onClick={() => onAccept(req.id)} disabled={acceptingId === req.id}>
            {acceptingId === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />} Accept
          </Button>
        </div>
      )}
      {req.status === "accepted" && <div className="flex items-center gap-2 text-xs text-emerald-400"><Check className="h-3.5 w-3.5" /><span>You accepted this weekly subscription</span></div>}
      {req.status === "declined" && <div className="flex items-center gap-2 text-xs text-destructive"><X className="h-3.5 w-3.5" /><span>You declined this request</span></div>}
    </div>
  );
}

export default function RideRequestPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, driver } = useAuth();
  const [weeklyRequests, setWeeklyRequests] = useState<WeeklyRequest[]>(MOCK_WEEKLY);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const rides = (location.state as { rides?: IncomingRide[] })?.rides || [];
  const [activeTab, setActiveTab] = useState<Tab>(rides.length > 0 ? "rides" : "weekly");

  if (!user) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const handleAccept = async (ride: IncomingRide) => {
    const { data, error } = await supabase.rpc("accept_ride", { p_ride_id: ride.id, p_driver_id: user.id });
    if (error) { toast.error(error.message); return; }
    const result = data as { success: boolean; reason?: string };
    if (!result.success) { toast.error(result.reason || "Could not accept ride."); return; }
    if (ride.user_id && driver) {
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_PUSH_NOTIFICATIONS_API_KEY },
        body: JSON.stringify({ userId: ride.user_id, title: "Driver Assigned!", message: `${driver.full_name} is on the way in a ${driver.vehicle}`, type: "ride", url: "/dashboard" }),
      }).catch(() => {});
    }
    navigate(`/ride/${ride.id}`, { replace: true });
  };

  const handleDecline = async (ride: IncomingRide) => {
    const { error } = await supabase.rpc("decline_ride_invitation", { p_ride_id: ride.id, p_driver_id: user.id });
    if (error) { toast.error(error.message); return; }
    navigate("/dashboard", { replace: true });
  };

  const handleAcceptWeekly = (id: string) => {
    setAcceptingId(id);
    setTimeout(() => {
      setWeeklyRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "accepted" } : r));
      setAcceptingId(null);
      toast.success("Weekly subscription accepted!");
    }, 1000);
  };

  const handleDeclineWeekly = (id: string) => {
    setWeeklyRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "declined" } : r));
    toast("Weekly subscription declined.");
  };

  const pendingWeekly = weeklyRequests.filter((r) => r.status === "pending");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-shrink-0 px-5 pt-4 pb-0">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-secondary border border-hairline">
          <button onClick={() => setActiveTab("rides")} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all", activeTab === "rides" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Bell className="h-4 w-4" /> Ride Requests {rides.length > 0 && <span className="flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{rides.length}</span>}
          </button>
          <button onClick={() => setActiveTab("weekly")} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all", activeTab === "weekly" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Calendar className="h-4 w-4" /> Weekly Subs {pendingWeekly.length > 0 && <span className="flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{pendingWeekly.length}</span>}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-4 space-y-3">
        {activeTab === "rides" && (
          rides.length === 0 ? (
            <div className="glass-card rounded-3xl p-8 text-center mt-8"><Bell className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No ride requests at the moment.</p></div>
          ) : (
            rides.map((ride, idx) => <RideCard key={ride.id} ride={ride} queuePosition={idx + 1} queueTotal={rides.length} onAccept={() => handleAccept(ride)} onDecline={() => handleDecline(ride)} />)
          )
        )}
        {activeTab === "weekly" && (
          weeklyRequests.length === 0 ? (
            <div className="glass-card rounded-3xl p-8 text-center mt-8"><Calendar className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No subscription requests yet.</p></div>
          ) : (
            weeklyRequests.map((req) => <WeeklyCard key={req.id} req={req} onAccept={handleAcceptWeekly} onDecline={handleDeclineWeekly} acceptingId={acceptingId} />)
          )
        )}
      </div>
    </div>
  );
}
