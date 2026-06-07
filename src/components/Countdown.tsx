import { useEffect, useState } from "react";

export function Countdown({ target, label }: { target: string | Date | null | undefined; label?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!target) return <span className="text-muted-foreground">—</span>;
  const ms = new Date(target).getTime() - now;
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const mins = Math.floor((abs % 3600000) / 60000);
  const secs = Math.floor((abs % 60000) / 1000);
  const color = overdue
    ? "text-destructive"
    : days < 1
      ? "text-warning"
      : days < 3
        ? "text-warning"
        : "text-foreground";
  return (
    <span className={`tabular-nums font-mono text-sm ${color}`}>
      {overdue ? "Overdue " : ""}
      {days > 0 && `${days}d `}
      {String(hours).padStart(2, "0")}:{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      {label && <span className="ml-1 text-xs text-muted-foreground">{label}</span>}
    </span>
  );
}
