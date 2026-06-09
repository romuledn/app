import { useState } from "react";
import { useNotifications, markNotificationsRead } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  Eye,
  Send,
  FileText,
  Receipt,
  CheckCircle2,
  CreditCard,
  Plus,
  ArrowRightLeft,
  Clock,
} from "lucide-react";

const ACTION_CONFIG: Record<string, { icon: typeof Bell; label: string; color: string }> = {
  email_opened: { icon: Eye, label: "Email opened", color: "text-blue-500" },
  sent: { icon: Send, label: "Sent", color: "text-amber-500" },
  reminder_sent: { icon: Clock, label: "Reminder sent", color: "text-orange-500" },
  accepted: { icon: CheckCircle2, label: "Accepted", color: "text-green-500" },
  paid: { icon: CreditCard, label: "Payment received", color: "text-emerald-500" },
  created: { icon: Plus, label: "Created", color: "text-violet-500" },
  created_from_quote: { icon: ArrowRightLeft, label: "Converted", color: "text-indigo-500" },
  marked_sent: { icon: Send, label: "Marked sent", color: "text-amber-500" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function notifMessage(event: any): string {
  const meta = event.meta || {};
  const number = meta.number || "";
  const client = meta.client_name || "";
  const docType = meta.doc_type || event.entity_type?.replace(/s$/, "") || "document";

  switch (event.action) {
    case "email_opened": {
      const count = meta.open_count || 1;
      const who = client || "Someone";
      if (meta.first_open) {
        return `${who} opened ${docType} #${number} for the first time`;
      }
      return `${who} opened ${docType} #${number} (${count}x total)`;
    }
    case "sent":
      return `${docType.charAt(0).toUpperCase() + docType.slice(1)} #${number} sent${client ? ` to ${client}` : ""}`;
    case "reminder_sent":
      return `Reminder sent for #${number}${client ? ` to ${client}` : ""}`;
    case "accepted":
      return `Quotation #${number} accepted${client ? ` by ${client}` : ""}`;
    case "paid":
      return `Invoice #${number} marked as paid`;
    case "created":
      return `${docType.charAt(0).toUpperCase() + docType.slice(1)} #${number} created`;
    case "created_from_quote":
      return `Invoice #${number} created from quotation`;
    case "marked_sent":
      return `${docType.charAt(0).toUpperCase() + docType.slice(1)} #${number} marked as sent`;
    default:
      return `${event.action} on #${number}`;
  }
}

export function NotificationCenter() {
  const { user } = useAuth();
  const { data: notif } = useNotifications();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const events = notif?.events ?? [];
  const unread = events.length;

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && user && unread > 0) {
      // Mark read after a brief delay so user sees the badges first
      setTimeout(async () => {
        await markNotificationsRead(user.id);
        qc.invalidateQueries({ queryKey: ["notifications"] });
      }, 2000);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button className="mx-3 mb-3 flex items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors relative">
          <span className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </span>
          {unread > 0 && (
            <Badge className="bg-primary text-primary-foreground animate-pulse">
              {unread}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-[380px] p-0 rounded-xl shadow-2xl"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unread > 0 && (
            <span className="text-xs text-muted-foreground">{unread} new</span>
          )}
        </div>

        <ScrollArea className="max-h-[420px]">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No new notifications</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                You'll see alerts here when clients open your emails
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {events.map((event: any) => {
                const config = ACTION_CONFIG[event.action] || {
                  icon: Bell,
                  label: event.action,
                  color: "text-muted-foreground",
                };
                const Icon = config.icon;
                const isEmailOpen = event.action === "email_opened";

                return (
                  <div
                    key={event.id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${
                      isEmailOpen ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        isEmailOpen
                          ? "bg-blue-100 dark:bg-blue-900/40"
                          : "bg-muted"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{notifMessage(event)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {timeAgo(event.created_at)}
                      </p>
                    </div>
                    {isEmailOpen && (
                      <div className="shrink-0 mt-1">
                        <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                          <Eye className="mr-0.5 h-2.5 w-2.5" />
                          Opened
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {events.length > 0 && (
          <div className="border-t px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={async () => {
                if (user) {
                  await markNotificationsRead(user.id);
                  qc.invalidateQueries({ queryKey: ["notifications"] });
                }
              }}
            >
              Mark all as read
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
