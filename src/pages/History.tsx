import { useEffect, useState } from "react";
import { Clock, MapPin, Navigation, TrendingUp, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { formatRelative, formatNLe, formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface HistoryRide {
  id: string;
  created_at: string;
  pickup: string;
  destination: string;
  distance_km: number | null;
  fare_amount: number | null;
  status: string;
}

export default function History() {
  const { driver } = useAuth();
  const [rides, setRides] = useState<HistoryRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!driver) return;

    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .from("rides")
          .select("id, created_at, pickup, destination, distance_km, fare_amount, status")
          .eq("driver_id", driver.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        setRides(data as HistoryRide[]);
      } catch (err) {
        console.error("Failed to fetch history:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    fetchHistory();
  }, [driver]);

  const handleRefresh = () => {
    setRefreshing(true);
    setLoading(true);
    // Re-trigger the useEffect by updating a dependency or calling fetch directly
    if (driver) {
      const fetchHistory = async () => {
        try {
          const { data, error } = await supabase
            .from("rides")
            .select("id, created_at, pickup, destination, distance_km, fare_amount, status")
            .eq("driver_id", driver.id)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(50);

          if (error) throw error;
          setRides(data as HistoryRide[]);
        } catch (err) {
          console.error("Failed to fetch history:", err);
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      };
      fetchHistory();
    }
  };

  const totalEarnings = rides.reduce((sum, ride) => {
    if (!ride.fare_amount) return sum;
    return sum + Math.floor(ride.fare_amount * 0.8);
  }, 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-5 pt-14 pb-6 sticky top-0 bg-background/90 backdrop-blur-md z-10 border-b border-hairline/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Ride History
            </h1>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mt-1">
              Completed trips
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-10 w-10 rounded-xl bg-secondary border border-hairline flex items-center justify-center hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="px-5 py-6 space-y-6">
        {/* Earnings Summary */}
        <div className="glass-card rounded-3xl p-5 shadow-soft bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20">
              <TrendingUp className="h-6 w-6 text-emerald-400" strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-emerald-400/80 mb-0.5">
                Total Earned (Recent)
              </p>
              <p className="text-2xl font-display font-bold text-emerald-400">
                {formatNLe(totalEarnings)}
              </p>
            </div>
          </div>
        </div>

        {/* History List */}
        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl p-4 flex gap-4">
                <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))
          ) : rides.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Clock className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-foreground font-medium">No rides yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your completed rides will appear here.
              </p>
            </div>
          ) : (
            rides.map((ride) => (
              <div
                key={ride.id}
                className="glass-card rounded-2xl p-4 shadow-soft space-y-4"
              >
                {/* Date & Earnings */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {formatDate(ride.created_at)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {formatRelative(ride.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400 font-display">
                      {ride.fare_amount ? formatNLe(Math.floor(ride.fare_amount * 0.8)) : "—"}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {ride.distance_km?.toFixed(1)} km
                    </p>
                  </div>
                </div>

                <div className="h-px bg-hairline w-full" />

                {/* Locations */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                      <div className="h-6 w-px bg-hairline mx-auto mt-1" />
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug line-clamp-1">
                      {ride.pickup}
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      <div className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]" />
                    </div>
                    <p className="text-xs text-foreground font-medium leading-snug line-clamp-1">
                      {ride.destination}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
