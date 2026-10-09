import { NavLink, Outlet } from "react-router-dom";
import { Activity, Car, History, LayoutDashboard, LogOut, MapPinned } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Book a ride", icon: MapPinned, end: true },
  { to: "/rides", label: "My rides", icon: History },
  { to: "/drivers", label: "Driver console", icon: Car },
  { to: "/overview", label: "Operations", icon: LayoutDashboard },
  { to: "/observability", label: "Observability", icon: Activity },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const initials = (user?.fullName ?? "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="flex shrink-0 items-center gap-1 border-b bg-ink px-2 py-2 text-primary-foreground md:w-60 md:flex-col md:items-stretch md:border-b-0 md:px-3 md:py-4">
        <div className="hidden items-center gap-2.5 px-2 pb-5 pt-1 font-display text-lg font-semibold md:flex">
          <span className="grid size-8 place-items-center rounded-lg bg-meter text-ink">🚕</span> RideShare
        </div>
        <nav className="flex flex-1 gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-primary-foreground/70 transition-colors hover:bg-white/10 hover:text-primary-foreground",
                  isActive && "bg-white/[0.12] text-primary-foreground shadow-[inset_3px_0_0_hsl(var(--meter))]",
                )
              }
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 md:ml-0 md:border-t md:border-white/10 md:px-2 md:pt-4">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-semibold">{initials}</div>
          <div className="hidden min-w-0 flex-1 md:block">
            <p className="truncate text-sm font-medium">{user?.fullName}</p>
            <p className="truncate text-xs text-primary-foreground/60">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="rounded-md p-2 text-primary-foreground/70 hover:bg-white/10 hover:text-primary-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
