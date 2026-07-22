import { User, Phone, Car, Tag, ShieldCheck, HelpCircle, LogOut, Sun, Moon, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { openWhatsApp } from "@/lib/utils";

export default function Profile() {
  const { driver, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleSignOut = () => {
    signOut();
  };

  if (!driver) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header Profile Info */}
      <div className="px-5 pt-14 pb-8 border-b border-hairline/50">
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center shadow-cta shrink-0">
            <span className="text-primary-foreground text-3xl font-display font-bold uppercase">
              {driver.full_name.charAt(0)}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              {driver.full_name}
            </h1>
            <div className="flex items-center gap-1.5 mt-1 text-emerald-400 bg-emerald-500/10 w-fit px-2 py-0.5 rounded-full border border-emerald-500/20">
              <ShieldCheck className="h-3 w-3" />
              <span className="text-[10px] uppercase tracking-wider font-semibold">
                Verified Driver
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-6 space-y-6">
        {/* Account Details */}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 px-2">
            Account Details
          </p>
          <div className="glass-card rounded-3xl p-2 shadow-soft">
            <div className="flex items-center gap-4 p-3">
              <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
                <Phone className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Phone Number
                </p>
                <p className="text-sm font-medium text-foreground">{driver.phone}</p>
              </div>
            </div>
            
            <div className="h-px w-full bg-hairline" />
            
            <div className="flex items-center gap-4 p-3">
              <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
                <Car className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Vehicle
                </p>
                <p className="text-sm font-medium text-foreground">{driver.vehicle}</p>
              </div>
            </div>

            {driver.plate_number && (
              <>
                <div className="h-px w-full bg-hairline" />
                <div className="flex items-center gap-4 p-3">
                  <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
                    <Tag className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Plate Number
                    </p>
                    <p className="text-sm font-medium text-foreground uppercase">
                      {driver.plate_number}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Support & Actions */}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 px-2">
            Support
          </p>
          <div className="glass-card rounded-3xl p-2 shadow-soft">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-4 p-3 hover:bg-secondary/50 rounded-2xl transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
                {theme === "dark" ? (
                  <Sun className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Moon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Switch theme
                </p>
              </div>
            </button>
            <button
              onClick={() => openWhatsApp(undefined, "Hi Easi Ride Support, I need help with my driver account.")}
              className="w-full flex items-center gap-4 p-3 hover:bg-secondary/50 rounded-2xl transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <HelpCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Contact Support</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Get help via WhatsApp
                </p>
              </div>
            </button>
          </div>
        </div>

        <Button
          variant="outline"
          size="xl"
          onClick={handleSignOut}
          className="w-full rounded-2xl h-14 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-5 w-5 mr-2" />
          Sign Out
        </Button>

        <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest pt-4">
          Easi Ride Driver v1.0.0
        </p>
      </div>
    </div>
  );
}
