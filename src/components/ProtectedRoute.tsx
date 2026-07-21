import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";

export function ProtectedRoute() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      setChecking(false);
      return;
    }

    const checkOnboarding = async () => {
      try {
        const { data } = await supabase
          .from("drivers")
          .select("onboarding_completed")
          .eq("id", user.id)
          .maybeSingle();
        setOnboardingCompleted(data?.onboarding_completed ?? false);
      } catch {
        setOnboardingCompleted(false);
      } finally {
        setChecking(false);
      }
    };
    checkOnboarding();
  }, [user, authLoading]);

  if (authLoading || checking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-sm font-bold">ER</span>
          </div>
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Handle onboarding redirect
  if (onboardingCompleted === false && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // Prevent accessing onboarding once completed
  if (onboardingCompleted === true && location.pathname === "/onboarding") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
