import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Car, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Auth() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Already authenticated — check driver record in useAuth, redirect to dashboard
  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please enter your email and password.");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Signing in...");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        toast.error("Invalid credentials. Please try again.", { id: toastId });
        return;
      }

      if (!data.user) {
        toast.error("Authentication failed. Please try again.", { id: toastId });
        return;
      }

      // Verify this user exists as a driver
      const { data: driverRecord, error: driverError } = await supabase
        .from("drivers")
        .select("id, full_name, status")
        .eq("id", data.user.id)
        .single();

      if (driverError || !driverRecord) {
        // Not a driver — sign them out
        await supabase.auth.signOut();
        toast.error(
          "This account is not registered as a driver. Contact support for access.",
          { id: toastId }
        );
        return;
      }

      if (driverRecord.status === "suspended") {
        await supabase.auth.signOut();
        toast.error("Your driver account has been suspended. Contact support.", {
          id: toastId,
        });
        return;
      }

      toast.success(`Welcome back, ${driverRecord.full_name.split(" ")[0]}!`, {
        id: toastId,
      });
    } catch {
      toast.error("Something went wrong. Please try again.", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      {/* Subtle background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-white/[0.03] blur-3xl" />
      </div>

      <div className="w-full max-w-sm animate-fade-up">
        {/* Logo wordmark */}
        <div className="flex flex-col items-center mb-10">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-cta">
            <Car className="h-7 w-7 text-primary-foreground" strokeWidth={2} />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Easi<span className="text-muted-foreground">Ride</span>
          </h1>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mt-1">
            Driver Portal
          </p>
        </div>

        {/* Login card */}
        <div className="glass-card rounded-3xl p-6 shadow-elevated">
          <p className="text-sm text-muted-foreground mb-6 text-center">
            Sign in with your driver credentials
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-muted-foreground text-xs uppercase tracking-[0.15em]">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="driver@easiride.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                autoComplete="email"
                className="h-13 rounded-xl bg-background border-hairline text-foreground placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-muted-foreground text-xs uppercase tracking-[0.15em]">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  autoComplete="current-password"
                  className="h-13 rounded-xl bg-background border-hairline text-foreground placeholder:text-muted-foreground/50 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              id="btn-driver-login"
              type="submit"
              size="xl"
              className="w-full rounded-2xl mt-2 h-14 text-base font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6 leading-relaxed">
            Access is restricted to registered Easi Ride drivers.
            <br />
            Contact your fleet manager for credentials.
          </p>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-6">
          v1.0.0 · Easi Ride Driver
        </p>
      </div>
    </div>
  );
}
