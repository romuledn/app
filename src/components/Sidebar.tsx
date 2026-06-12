import { Link, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  Globe,
  Settings,
  LogOut,
  TrendingUp,
  ReceiptText,
  ListTodo,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useRole } from "@/lib/queries";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useIsMobile } from "@/hooks/use-mobile";

const ALL_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", admin: true, accounts: false },
  { to: "/revenue", icon: TrendingUp, label: "Revenue", admin: true, accounts: false },
  { to: "/clients", icon: Users, label: "Clients", admin: true, accounts: true },
  { to: "/quotations", icon: FileText, label: "Quotations", admin: true, accounts: true },
  { to: "/invoices", icon: Receipt, label: "Invoices", admin: true, accounts: true },
  { to: "/receipts", icon: ReceiptText, label: "Receipts", admin: true, accounts: true },
  { to: "/projects", icon: ListTodo, label: "Projects", admin: true, accounts: true },
  { to: "/hosting", icon: Globe, label: "Hosting", admin: true, accounts: false },
  { to: "/settings", icon: Settings, label: "Settings", admin: true, accounts: true },
] as const;

export function Sidebar() {
  const loc = useLocation();
  const { signOut, user } = useAuth();
  const { data: role } = useRole();
  const isAdmin = !!role?.isAdmin;
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = ALL_ITEMS.filter((it) => (isAdmin ? it.admin : it.accounts));

  // Mobile: top bar + slide-out drawer
  if (isMobile) {
    return (
      <>
        {/* Fixed top bar */}
        <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b bg-sidebar px-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-sidebar-foreground" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <Logo variant="white" className="h-7 w-auto" />
          </div>
          <NotificationCenter />
        </div>

        {/* Spacer for fixed top bar */}
        <div className="h-14 shrink-0" />

        {/* Overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setMobileOpen(false)} />
        )}

        {/* Slide-out drawer */}
        <aside
          className={`fixed top-0 left-0 z-50 flex h-full w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <Logo variant="white" className="h-10 w-auto" />
            <Button variant="ghost" size="icon" className="text-sidebar-foreground" onClick={() => setMobileOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
            {items.map((it) => {
              const active = loc.pathname.startsWith(it.to);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-[var(--shadow-elegant)]"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  }`}
                >
                  <it.icon className="h-4 w-4" />
                  {it.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-3">
            <div className="px-3 py-2 text-xs text-sidebar-foreground/60 truncate">
              {user?.email}
              {role && (
                <span className="ml-2 rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] uppercase">
                  {isAdmin ? "Admin" : "Accounts"}
                </span>
              )}
            </div>
            <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </aside>
      </>
    );
  }

  // Desktop: fixed sidebar
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 pt-5 pb-4">
        <Logo variant="white" className="h-10 w-auto" />
      </div>

      <NotificationCenter />

      <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
        {items.map((it) => {
          const active = loc.pathname.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-elegant)]"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="px-3 py-2 text-xs text-sidebar-foreground/60 truncate">
          {user?.email}
          {role && (
            <span className="ml-2 rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] uppercase">
              {isAdmin ? "Admin" : "Accounts"}
            </span>
          )}
        </div>
        <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </aside>
  );
}
