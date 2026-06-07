import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, Plus, Minus, AlertTriangle, CreditCard, Lock } from "lucide-react";
import { toast } from "sonner";

const REV1_AT = 50;
const REV2_AT = 90;

export function ProjectRevisions({
  project,
  readOnly = false,
  onChanged,
}: {
  project: any;
  readOnly?: boolean;
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const r1 = !!project.revision1_done;
  const r2 = !!project.revision2_done;
  const paid = project.paid_revisions ?? 0;
  const progress = project.progress ?? 0;

  const r1Available = progress >= REV1_AT;
  const r2Available = progress >= REV2_AT;
  const paymentRequired = r2;

  const update = async (
    patch: Partial<{ revision1_done: boolean; revision2_done: boolean; paid_revisions: number }>,
  ) => {
    setBusy(true);
    const { error } = await supabase.from("projects").update(patch).eq("id", project.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    onChanged?.();
  };

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Revisions</div>
          <div className="text-xs text-muted-foreground">
            Two free revision checkpoints unlock automatically at {REV1_AT}% and {REV2_AT}%
            project progress.
          </div>
        </div>
        <Badge variant="outline">
          {(r1 ? 0 : 1) + (r2 ? 0 : 1)} of 2 free left
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <RevisionRow
          label={`First revision (at ${REV1_AT}%)`}
          done={r1}
          available={r1Available}
          unlockHint={`Unlocks when progress reaches ${REV1_AT}%.`}
          onToggle={(v) => update({ revision1_done: v })}
          disabled={busy || readOnly || !r1Available}
        />
        <RevisionRow
          label={`Second revision (at ${REV2_AT}%)`}
          done={r2}
          available={r2Available}
          unlockHint={`Unlocks when progress reaches ${REV2_AT}%.`}
          onToggle={(v) => update({ revision2_done: v })}
          disabled={busy || readOnly || !r2Available}
        />
      </div>

      {paid > 0 && (
        <div className="rounded-md border bg-background p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {paid} paid revision{paid > 1 ? "s" : ""}
              </span>
              <span className="text-xs text-muted-foreground">added after the free ones</span>
            </div>
            {!readOnly && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => paid > 0 && update({ paid_revisions: paid - 1 })}
                disabled={busy}
              >
                <Minus className="mr-1 h-3.5 w-3.5" /> Remove one
              </Button>
            )}
          </div>
        </div>
      )}

      {paymentRequired && (
        <Alert className="border-primary/50 bg-primary/5">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <AlertTitle className="text-sm">Payment required for further revisions</AlertTitle>
          <AlertDescription className="text-xs">
            Both free revisions have been used. Any additional changes require a new payment before
            work continues.
            {!readOnly && (
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => update({ paid_revisions: paid + 1 })}
                  disabled={busy}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Log a paid revision
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function RevisionRow({
  label,
  done,
  available,
  unlockHint,
  onToggle,
  disabled,
}: {
  label: string;
  done: boolean;
  available: boolean;
  unlockHint: string;
  onToggle: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-md border bg-background p-2 ${
        !available ? "opacity-60" : ""
      }`}
    >
      <label className="flex flex-1 items-center gap-2 text-sm">
        <Checkbox
          checked={done}
          onCheckedChange={(v) => onToggle(!!v)}
          disabled={disabled}
        />
        <span className={done ? "text-muted-foreground line-through" : ""}>{label}</span>
      </label>
      {done ? (
        <Badge variant="outline" className="gap-1 border-success/40 bg-success/15 text-success">
          <CheckCircle2 className="h-3 w-3" /> Done
        </Badge>
      ) : available ? (
        <Badge variant="outline" className="border-primary/40 text-primary">
          Ready to review
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1 text-muted-foreground" title={unlockHint}>
          <Lock className="h-3 w-3" /> Locked
        </Badge>
      )}
    </div>
  );
}
