import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_DESIGN,
  DISPLAY_FONTS,
  BODY_FONTS,
  TEMPLATES,
  googleFontsHref,
  mergeDesign,
  PDF_EMBEDDED_FONTS,
  type DocDesign,
  type DocTemplate,
  type LogoPosition,
} from "@/lib/doc-design";
import { LOGO_URL } from "@/components/Logo";
import { Loader2, Check, Info } from "lucide-react";
import { toast } from "sonner";

export function DesignBuilder() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [design, setDesign] = useState<DocDesign>(DEFAULT_DESIGN);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.doc_design) setDesign(mergeDesign(profile.doc_design as any));
  }, [profile]);

  // Inject Google Fonts link for preview only.
  useEffect(() => {
    const id = "design-builder-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = googleFontsHref([...DISPLAY_FONTS, ...BODY_FONTS]);
  }, []);

  const update = (patch: Partial<DocDesign>) => setDesign((d) => ({ ...d, ...patch }));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ doc_design: design as any }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Design saved — applied to all new PDFs.");
  };

  const reset = () => setDesign(DEFAULT_DESIGN);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Template</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  // Reasonable defaults per template
                  const presets: Record<DocTemplate, Partial<DocDesign>> = {
                    classic: { template: "classic", showWatermark: true, showFooterBand: true },
                    modern: { template: "modern", showWatermark: false, showFooterBand: false },
                    bold: { template: "bold", showWatermark: false, showFooterBand: true },
                    minimal: { template: "minimal", showWatermark: false, showFooterBand: false },
                  };
                  update(presets[t.id]);
                }}
                className={`relative rounded-lg border p-3 text-left transition hover:border-primary/60 ${
                  design.template === t.id ? "border-primary ring-2 ring-primary/30" : "border-border"
                }`}
              >
                <div className="text-sm font-semibold">{t.label}</div>
                <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{t.description}</div>
                {design.template === t.id && (
                  <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Colours</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Accent colour">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={design.accentColor}
                  onChange={(e) => update({ accentColor: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                />
                <Input value={design.accentColor} onChange={(e) => update({ accentColor: e.target.value })} />
              </div>
            </Field>
            <Field label="Ink (body text) colour">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={design.inkColor}
                  onChange={(e) => update({ inkColor: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                />
                <Input value={design.inkColor} onChange={(e) => update({ inkColor: e.target.value })} />
              </div>
            </Field>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {["#E63946", "#0F172A", "#2563EB", "#16A34A", "#D97706", "#7C3AED", "#DB2777", "#0D9488"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => update({ accentColor: c })}
                  className="h-7 w-7 rounded-full border-2 border-white shadow"
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Typography</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Display font (headings)">
              <Select value={design.displayFont} onValueChange={(v) => update({ displayFont: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISPLAY_FONTS.map((f) => (
                    <SelectItem key={f} value={f}>
                      <span style={{ fontFamily: `'${f}', serif` }}>{f}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Body font">
              <Select value={design.bodyFont} onValueChange={(v) => update({ bodyFont: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BODY_FONTS.map((f) => (
                    <SelectItem key={f} value={f}>
                      <span style={{ fontFamily: `'${f}', sans-serif` }}>{f}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {(!PDF_EMBEDDED_FONTS.has(design.displayFont) || !PDF_EMBEDDED_FONTS.has(design.bodyFont)) && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Selected font shown in preview. Embedded PDF currently ships Bricolage Grotesque and Inter; other choices fall back to a similar built-in PDF font.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Logo &amp; layout</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Logo position">
              <div className="grid grid-cols-3 gap-1.5">
                {(["left", "center", "right"] as LogoPosition[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => update({ logoPosition: p })}
                    className={`rounded border px-2 py-1.5 text-xs capitalize transition ${
                      design.logoPosition === p ? "border-primary bg-primary/10 text-primary" : "border-border"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>
            <div className="flex items-center justify-between">
              <Label htmlFor="wm">Logo watermark behind table</Label>
              <Switch id="wm" checked={design.showWatermark} onCheckedChange={(v) => update({ showWatermark: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="fb">Bottom accent band</Label>
              <Switch id="fb" checked={design.showFooterBand} onCheckedChange={(v) => update({ showFooterBand: v })} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save design
          </Button>
          <Button variant="outline" onClick={reset}>Reset</Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Live preview</div>
        <DesignPreview design={design} profile={profile} />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function DesignPreview({ design, profile }: { design: DocDesign; profile: any }) {
  const sampleItems = useMemo(() => ([
    { description: "Brand identity design", quantity: 1, price: 12000, notes: "Logo, colours, typography." },
    { description: "Website (5 pages)", quantity: 1, price: 28000, notes: "Responsive, copy & SEO." },
    { description: "Launch motion graphic", quantity: 1, price: 6500 },
  ]), []);
  const subtotal = sampleItems.reduce((s, it) => s + it.quantity * it.price, 0);
  const total = subtotal;

  const accent = design.accentColor;
  const ink = design.inkColor;
  const t = design.template;

  return (
    <div
      className="aspect-[1/1.414] w-full overflow-hidden rounded-md border bg-white shadow-lg"
      style={{ color: ink, fontFamily: `'${design.bodyFont}', sans-serif` }}
    >
      {/* Header */}
      {t === "classic" && (
        <div className="relative grid grid-cols-2">
          <LogoSlot pos={design.logoPosition} src={LOGO_URL} dark />
          <div className="flex h-[15%] items-center justify-end px-6" style={{ background: accent }}>
            <span className="text-2xl font-bold uppercase tracking-wider text-white" style={{ fontFamily: `'${design.displayFont}', serif` }}>
              QUOTATION
            </span>
          </div>
        </div>
      )}
      {t === "bold" && (
        <div className="flex items-center justify-between px-6 py-5" style={{ background: accent }}>
          <LogoSlot pos={design.logoPosition} src={LOGO_URL} inline invertOnDark />
          <span className="text-3xl font-bold uppercase tracking-wider text-white" style={{ fontFamily: `'${design.displayFont}', serif` }}>
            QUOTATION
          </span>
        </div>
      )}
      {t === "modern" && (
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between">
            <LogoSlot pos={design.logoPosition} src={LOGO_URL} inline />
            <span className="text-2xl font-semibold uppercase tracking-wider" style={{ fontFamily: `'${design.displayFont}', serif`, color: ink }}>
              QUOTATION
            </span>
          </div>
          <div className="mt-3 h-[2px] w-full" style={{ background: accent }} />
        </div>
      )}
      {t === "minimal" && (
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between">
            <LogoSlot pos={design.logoPosition} src={LOGO_URL} inline />
            <span className="text-xl uppercase tracking-[0.3em]" style={{ fontFamily: `'${design.displayFont}', serif`, color: ink }}>
              Quotation
            </span>
          </div>
        </div>
      )}

      <div className="px-6 pt-5">
        <div className="flex justify-between text-[10px]">
          <div>
            <div className="text-[11px] font-semibold" style={{ fontFamily: `'${design.displayFont}', serif` }}>Quotation For:</div>
            <div className="mt-0.5 font-semibold" style={{ color: accent }}>{profile?.business_name || "Acme Studio"}</div>
            <div className="opacity-60">123 Sample Lane, City</div>
          </div>
          <div className="text-right">
            <div>Quotation Date: 06 June 2026</div>
            <div>Quotation No: QT-2026-001</div>
            <div>Valid until: 20 June 2026</div>
          </div>
        </div>

        <table className="mt-4 w-full text-[9px]">
          <thead style={{ fontFamily: `'${design.displayFont}', serif` }}>
            <tr className="border-y" style={{ borderColor: "#d4d8df" }}>
              <th className="py-1.5 text-left">NO.</th>
              <th className="text-left">Item Description</th>
              <th className="text-right">Price</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sampleItems.map((it, i) => (
              <tr key={i} className="border-b align-top" style={{ borderColor: "#eef0f4" }}>
                <td className="py-1.5">{i + 1}.</td>
                <td>
                  <div>{it.description}</div>
                  {it.notes && <div className="text-[8px] opacity-60">{it.notes}</div>}
                </td>
                <td className="text-right">R {it.price.toLocaleString()}</td>
                <td className="text-right">{it.quantity}</td>
                <td className="text-right">R {(it.price * it.quantity).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 flex justify-between text-[10px]">
          <div style={{ fontFamily: `'${design.displayFont}', serif` }}>Looking forward to working with you.</div>
          <div className="text-right">
            <div>Sub Total: <span className="font-semibold">R {subtotal.toLocaleString()}</span></div>
            <div className="mt-1 border-t pt-1 text-sm font-bold" style={{ color: accent, fontFamily: `'${design.displayFont}', serif` }}>
              Total: R {total.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute" />
      {design.showFooterBand && (
        <div className="mt-auto h-[3%] w-[40%]" style={{ background: accent }} />
      )}
    </div>
  );
}

function LogoSlot({
  pos, src, dark, inline,
}: { pos: LogoPosition; src: string; dark?: boolean; inline?: boolean; invertOnDark?: boolean }) {
  const just = pos === "center" ? "justify-center" : pos === "right" ? "justify-end" : "justify-start";
  return (
    <div className={`flex items-center px-6 ${inline ? "" : "h-[15%]"} ${just}`} style={{ background: dark ? "#fff" : undefined }}>
      <img src={src} alt="" className="max-h-8 w-auto object-contain" />
    </div>
  );
}
