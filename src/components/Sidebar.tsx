import { Link, useLocation } from "@tanstack/react-router";
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
  Bell,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useNotifications, useRole, markNotificationsRead } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

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
  const { data: notif } = useNotifications();
  const qc = useQueryClient();
  const isAdmin = !!role?.isAdmin;

  const items = ALL_ITEMS.filter((it) => (isAdmin ? it.admin : it.accounts));
  const unread = notif?.events?.length ?? 0;

  const handleBellClick = async () => {
    if (!user) return;
    await markNotificationsRead(user.id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">

      <div className="px-5 pt-5 pb-4">
        <Logo variant="white" className="h-10 w-auto" />
      </div>

      {/* Notification badge */}
      <button
        onClick={handleBellClick}
        className="mx-3 mb-3 flex items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
      >
        <span className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Notifications
        </span>
        {unread > 0 && (
          <Badge className="bg-primary text-primary-foreground">{unread}</Badge>
        )}
      </button>

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
