import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/history", icon: Clock, label: "History" },
  { to: "/profile", icon: User, label: "Profile" },
];

export function AppShell() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Page content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-hairline bg-background/95 backdrop-blur-md safe-area-inset-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                id={`nav-${label.toLowerCase()}`}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={cn(
                        "p-1.5 rounded-lg transition-all duration-200",
                        isActive ? "bg-primary/10" : "bg-transparent"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5 transition-all duration-200",
                          isActive ? "text-primary stroke-[2.5px]" : "stroke-[1.5px]"
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-[0.12em] font-medium transition-all duration-200",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))
          )}
        </div>
      </nav>
    </div>
  );
}
