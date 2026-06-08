import jsPDF from "jspdf";
import { formatMoney } from "./currency";
import { LOGO_URL } from "@/components/Logo";
import {
  PDF_EMBEDDED_FONTS,
  hexToRgb,
  mergeDesign,
  type DocDesign,
} from "./doc-design";


export type LineItem = {
  description: string;
  quantity: number;
  price?: number;
  unit_price?: number;
  total?: number;
  notes?: string;
};

export type DocKind = "QUOTATION" | "INVOICE" | "RECEIPT";

export type DocData = {
  kind: DocKind;
  number: string;
  title: string;
  currency: string;
  items: LineItem[];
  subtotal: number;
  taxRate: number;
  discount?: number;
  depositPercent?: number;
  total: number;
  amountPaid?: number;
  notes?: string | null;
  bankDetails?: string | null;
  issueDate: string;
  dueOrValidLabel: string;
  dueOrValid?: string | null;
  terms?: string | null;
  business: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  client?: {
    name?: string | null;
    email?: string | null;
    company?: string | null;
    address?: string | null;
  } | null;
  design?: Partial<DocDesign> | null;
};

function linePrice(item: LineItem) {
  const quantity = Number(item.quantity || 0);
  const price = item.price ?? item.unit_price ?? (quantity > 0 && item.total != null ? Number(item.total) / quantity : 0);
  return Number(price || 0);
}

function lineTotal(item: LineItem) {
  return item.total != null ? Number(item.total || 0) : Number(item.quantity || 0) * linePrice(item);
}

function clientName(doc: DocData) {
  return doc.client?.company || doc.client?.name || "Client";
}

let _logoData: { dataUrl: string; w: number; h: number } | null = null;
async function loadLogo() {
  if (_logoData) return _logoData;
  try {
    const res = await fetch(LOGO_URL);
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext("2d")!.drawImage(bmp, 0, 0);
    _logoData = { dataUrl: c.toDataURL("image/png"), w: bmp.width, h: bmp.height };
    return _logoData;
  } catch {
    return null;
  }
}

// Embed the app's fonts (Bricolage Grotesque for display, Inter for body)
// so PDFs match the on-screen typography.
const FONT_SOURCES: Record<string, { url: string; style: "normal" | "bold" }> = {
  "Bricolage-normal": {
    url: "https://fonts.gstatic.com/s/bricolagegrotesque/v7/3y9U6as8bTXq_nANBjzKo3IeZx8z6up5BeSl5jBNz_19PpbpMXuECpwUxJBOm_OJWiaaD30YfKfjZZoLvRdGzQ.ttf",
    style: "normal",
  },
  "Bricolage-bold": {
    url: "https://fonts.gstatic.com/s/bricolagegrotesque/v7/3y9U6as8bTXq_nANBjzKo3IeZx8z6up5BeSl5jBNz_19PpbpMXuECpwUxJBOm_OJWiaaD30YfKfjZZoL_RVGzQ.ttf",
    style: "bold",
  },
  "Barlow-normal": {
    url: "https://fonts.gstatic.com/s/barlow/v12/7cHpv4kjgoGqM7E_DMs5.ttf",
    style: "normal",
  },
  "Barlow-bold": {
    url: "https://fonts.gstatic.com/s/barlow/v12/7cHqv4kjgoGqM7E3w-oc4Pg.ttf",
    style: "bold",
  },
};

const _fontCache = new Map<string, string>();
async function fetchFontBase64(url: string): Promise<string | null> {
  if (_fontCache.has(url)) return _fontCache.get(url)!;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    const b64 = btoa(binary);
    _fontCache.set(url, b64);
    return b64;
  } catch {
    return null;
  }
}

let _fontsRegistered: WeakSet<jsPDF> = new WeakSet();
async function registerAppFonts(pdf: jsPDF) {
  if (_fontsRegistered.has(pdf)) return true;
  try {
    const entries = await Promise.all(
      Object.entries(FONT_SOURCES).map(async ([key, { url, style }]) => {
        const b64 = await fetchFontBase64(url);
        return b64 ? { key, b64, style, family: key.split("-")[0] } : null;
      }),
    );
    for (const e of entries) {
      if (!e) return false;
      const filename = `${e.key}.ttf`;
      pdf.addFileToVFS(filename, e.b64);
      pdf.addFont(filename, e.family, e.style);
    }
    _fontsRegistered.add(pdf);
    return true;
  } catch {
    return false;
  }
}


const MUTED: [number, number, number] = [120, 124, 140];
const RULE: [number, number, number] = [200, 205, 215];

function resolveFont(name: string, kind: "display" | "body"): string {
  if (name === "Bricolage Grotesque") return "Bricolage";
  if (name === "Inter") return "Inter";
  return kind === "display" ? "times" : "helvetica";
}

export async function generatePdf(doc: DocData): Promise<jsPDF> {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 50;

  const design = mergeDesign(doc.design);
  const ACCENT = hexToRgb(design.accentColor);
  const INK = hexToRgb(design.inkColor);

  // Always use Bricolage Grotesque for headings and Barlow for body text in PDFs,
  // regardless of the on-screen design choice.
  await registerAppFonts(pdf);
  const DISPLAY = "Bricolage";
  const BODY = "Barlow";

  // ===== Header: template-specific =====
  const logo = await loadLogo();
  const drawLogoAt = (x: number, y: number, boxW = 220, boxH = 80) => {
    if (!logo) return;
    const ratio = logo.w / logo.h;
    let drawW = boxW;
    let drawH = boxW / ratio;
    if (drawH > boxH) { drawH = boxH; drawW = boxH * ratio; }
    pdf.addImage(logo.dataUrl, "PNG", x, y + (boxH - drawH) / 2, drawW, drawH, undefined, "FAST");
  };

  const logoX = design.logoPosition === "center" ? (W - 220) / 2
              : design.logoPosition === "right" ? W - M - 220
              : M;

  if (design.template === "classic") {
    const headerH = 110;
    pdf.setFillColor(...ACCENT);
    pdf.rect(W * 0.5, 0, W * 0.5, headerH, "F");
    drawLogoAt(logoX, 20);
    pdf.setFont(DISPLAY, "normal");
    pdf.setFontSize(46);
    pdf.setTextColor(255, 255, 255);
    pdf.text(doc.kind, W - M, 72, { align: "right" });
  } else if (design.template === "bold") {
    const headerH = 130;
    pdf.setFillColor(...ACCENT);
    pdf.rect(0, 0, W, headerH, "F");
    drawLogoAt(logoX, 25);
    pdf.setFont(DISPLAY, "normal");
    pdf.setFontSize(56);
    pdf.setTextColor(255, 255, 255);
    pdf.text(doc.kind, W - M, 88, { align: "right" });
  } else if (design.template === "modern") {
    drawLogoAt(logoX, 30);
    pdf.setFont(DISPLAY, "normal");
    pdf.setFontSize(40);
    pdf.setTextColor(...INK);
    pdf.text(doc.kind, W - M, 70, { align: "right" });
    pdf.setDrawColor(...ACCENT);
    pdf.setLineWidth(2);
    pdf.line(M, 120, W - M, 120);
  } else {
    // minimal
    drawLogoAt(logoX, 30);
    pdf.setFont(DISPLAY, "normal");
    pdf.setFontSize(32);
    pdf.setTextColor(...INK);
    pdf.text(doc.kind, W - M, 70, { align: "right" });
  }

  // Faint watermark (logo behind table)
  if (logo && design.showWatermark) {
    const ww = 320;
    const wh = ww / (logo.w / logo.h);
    const gState = (pdf as any).GState ? new (pdf as any).GState({ opacity: 0.05 }) : null;
    if (gState) (pdf as any).setGState(gState);
    pdf.addImage(logo.dataUrl, "PNG", (W - ww) / 2, (H - wh) / 2, ww, wh);
    if (gState) (pdf as any).setGState(new (pdf as any).GState({ opacity: 1 }));
  }

  // ===== "Invoice To" / meta row (compact, matches in-app preview) =====
  let y = 170;
  const toLabel =
    doc.kind === "QUOTATION" ? "Quotation For:" : doc.kind === "RECEIPT" ? "Receipt For:" : "Invoice To:";
  pdf.setFont(DISPLAY, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  pdf.text(toLabel, M, y);

  pdf.setFont(DISPLAY, "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...ACCENT);
  pdf.text(clientName(doc), M, y + 14);

  pdf.setFont(BODY, "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...MUTED);
  if (doc.client?.address) {
    const addr = pdf.splitTextToSize(doc.client.address, 260);
    pdf.text(addr, M, y + 28);
  }

  // right meta — small
  pdf.setFont(BODY, "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  const metaX = W - M;
  let my = y;
  const labelFor = doc.kind === "RECEIPT" ? "Receipt" : doc.kind === "QUOTATION" ? "Quotation" : "Invoice";
  pdf.text(`${labelFor} Date: ${formatDate(doc.issueDate)}`, metaX, my, { align: "right" });
  my += 14;
  pdf.text(`${labelFor} No: ${doc.number}`, metaX, my, { align: "right" });
  if (doc.kind === "INVOICE" || doc.kind === "RECEIPT") {
    my += 14;
    const paid = doc.amountPaid ?? (doc.kind === "RECEIPT" ? doc.total : 0);
    pdf.text(`Amount Paid: ${formatMoney(paid, doc.currency)}`, metaX, my, { align: "right" });
  } else if (doc.dueOrValid) {
    my += 14;
    pdf.text(`${doc.dueOrValidLabel}: ${formatDate(doc.dueOrValid)}`, metaX, my, { align: "right" });
  }

  // ===== Items table =====
  let ty = y + 70;

  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.8);
  pdf.line(M, ty, W - M, ty);
  ty += 18;

  const cNo = M + 4;
  const cDesc = M + 40;
  const cPrice = W - M - 220;
  const cQty = W - M - 110;
  const cTotal = W - M - 4;

  pdf.setFont(DISPLAY, "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...INK);
  pdf.text("NO.", cNo, ty);
  pdf.text("Item Description", cDesc, ty);
  pdf.text("Price", cPrice, ty, { align: "right" });
  pdf.text("Qty", cQty, ty, { align: "right" });
  pdf.text("Total", cTotal, ty, { align: "right" });
  ty += 6;
  pdf.line(M, ty, W - M, ty);
  ty += 16;

  // rows
  const descMaxWidth = cPrice - cDesc - 30;
  doc.items.forEach((it, idx) => {
    const rawDesc = it.description || "";
    const lines = rawDesc.split("\n");
    const heading = lines[0] || "—";
    const inline = lines.slice(1).join(" ").trim();
    const subDesc = [inline, it.notes?.trim()].filter(Boolean).join("\n");

    pdf.setFont(BODY, "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...INK);
    pdf.text(`${idx + 1}.`, cNo, ty);
    const headingLines = pdf.splitTextToSize(heading, descMaxWidth);
    pdf.text(headingLines, cDesc, ty);
    const price = linePrice(it);
    pdf.text(formatMoney(price, doc.currency), cPrice, ty, { align: "right" });
    pdf.text(String(it.quantity), cQty, ty, { align: "right" });
    pdf.text(formatMoney(lineTotal(it), doc.currency), cTotal, ty, { align: "right" });

    let rowH = headingLines.length * 12;
    if (subDesc) {
      pdf.setFont(BODY, "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...MUTED);
      const wrapped = pdf.splitTextToSize(subDesc, descMaxWidth);
      pdf.text(wrapped, cDesc, ty + rowH + 2);
      rowH += wrapped.length * 10 + 2;
    }

    ty += rowH + 10;
    pdf.setDrawColor(235, 237, 241);
    pdf.setLineWidth(0.4);
    pdf.line(M, ty, W - M, ty);
    ty += 14;
  });

  // ===== Inline message + compact totals (matches preview) =====
  const blockTop = ty + 4;
  pdf.setFont(DISPLAY, "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(...INK);
  const thanks =
    doc.kind === "RECEIPT"
      ? "Payment received — thank you."
      : doc.kind === "QUOTATION"
      ? "Looking forward to working with you."
      : "Thank you for your business.";
  pdf.text(thanks, M, blockTop);

  const labelX = W - M - 90;
  let ttY = blockTop;
  pdf.setFont(BODY, "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  pdf.text("Sub Total:", labelX, ttY, { align: "right" });
  pdf.text(formatMoney(doc.subtotal, doc.currency), cTotal, ttY, { align: "right" });
  ttY += 12;

  if (doc.discount && doc.discount > 0) {
    pdf.text("Discount:", labelX, ttY, { align: "right" });
    pdf.text(`− ${formatMoney(doc.discount, doc.currency)}`, cTotal, ttY, { align: "right" });
    ttY += 12;
  }
  if (doc.taxRate > 0) {
    pdf.text(`Tax (${doc.taxRate}%):`, labelX, ttY, { align: "right" });
    const tax = (doc.subtotal - (doc.discount || 0)) * doc.taxRate / 100;
    pdf.text(formatMoney(tax, doc.currency), cTotal, ttY, { align: "right" });
    ttY += 12;
  }

  ttY += 2;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.6);
  pdf.line(labelX - 40, ttY, cTotal, ttY);
  ttY += 14;
  pdf.setFont(DISPLAY, "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...ACCENT);
  pdf.text("Total:", labelX, ttY, { align: "right" });
  pdf.text(formatMoney(doc.total, doc.currency), cTotal, ttY, { align: "right" });

  // PAID stamp for receipts
  if (doc.kind === "RECEIPT") {
    pdf.setFont(DISPLAY, "bold");
    pdf.setFontSize(40);
    pdf.setTextColor(...ACCENT);
    pdf.text("PAID", M + 60, ttY - 6, { angle: -12 });
  }

  // ===== Bank / Payment Details =====
  if (doc.bankDetails && doc.kind !== "QUOTATION") {
    const bankTop = ttY + 24;
    pdf.setFont(DISPLAY, "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...INK);
    pdf.text("Banking Details", M, bankTop);
    pdf.setFont(BODY, "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    const bankLines = pdf.splitTextToSize(doc.bankDetails, W / 2 - M);
    pdf.text(bankLines, M, bankTop + 12);
  }

  // ===== Footer: T&Cs (left) + Contact (right) — compact =====
  const footerTop = H - 110;
  pdf.setFont(DISPLAY, "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  pdf.text("Terms & Conditions", M, footerTop);
  pdf.text("Contact Details", W - M, footerTop, { align: "right" });

  pdf.setFont(BODY, "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...INK);
  if (doc.terms) {
    const t = pdf.splitTextToSize(doc.terms, W / 2 - M - 20);
    pdf.text(t, M, footerTop + 12);
  }

  let cy = footerTop + 12;
  const contactX = W - M;
  if (doc.business.phone) {
    pdf.text(`Phone: ${doc.business.phone}`, contactX, cy, { align: "right" });
    cy += 11;
  }
  if (doc.business.email) {
    pdf.text(`Email: ${doc.business.email}`, contactX, cy, { align: "right" });
    cy += 11;
  }
  if (doc.business.address) {
    pdf.text(doc.business.address, contactX, cy, { align: "right" });
  }

  // Bottom accent band (left) — optional
  if (design.showFooterBand) {
    pdf.setFillColor(...ACCENT);
    pdf.rect(0, H - 22, W * 0.4, 22, "F");
  }

  return pdf;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "2-digit" });
}

export async function downloadPdf(doc: DocData) {
  const pdf = await generatePdf(doc);
  pdf.save(`${doc.kind.toLowerCase()}-${doc.number}.pdf`);
}

export function downloadCsv(doc: DocData) {
  const rows = [
    ["#", "Description", "Notes", "Qty", "Price", "Amount"],
    ...doc.items.map((it, i) => [
      i + 1,
      it.description?.split("\n")[0] || "",
      it.notes || "",
      it.quantity,
      linePrice(it),
      lineTotal(it),
    ]),
    [],
    ["", "", "", "", "Subtotal", doc.subtotal],
    ["", "", "", "", `Tax (${doc.taxRate}%)`, (doc.subtotal - (doc.discount || 0)) * doc.taxRate / 100],
    ["", "", "", "", "Total", doc.total],
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${doc.kind.toLowerCase()}-${doc.number}.csv`;
  a.click();
}

export async function openEmailWithPdf(doc: DocData, shareUrl?: string) {
  const labelFor =
    doc.kind === "QUOTATION" ? "Quotation" : doc.kind === "RECEIPT" ? "Receipt" : "Invoice";
  const subject = `${labelFor} ${doc.number} — ${doc.title}`;
  const body =
    `Hi ${doc.client?.name || clientName(doc)},\n\n` +
    `Please find your ${labelFor.toLowerCase()} #${doc.number} for "${doc.title}".\n\n` +
    `Total: ${formatMoney(doc.total, doc.currency)}\n` +
    (doc.dueOrValid ? `${doc.dueOrValidLabel}: ${formatDate(doc.dueOrValid)}\n` : "") +
    (shareUrl ? `\nView & download online: ${shareUrl}\n` : "") +
    `\nKind regards,\n${doc.business.name || ""}`;

  if (!doc.client?.email) {
    throw new Error("No client email address — add an email to the client first.");
  }

  const { sendEmail } = await import("./email");
  await sendEmail({
    to: doc.client.email,
    subject,
    message: body,
    replyTo: doc.business.email || undefined,
    documentType: labelFor,
    documentNumber: doc.number,
    clientName: clientName(doc),
    total: formatMoney(doc.total, doc.currency),
    shareUrl: shareUrl || "",
  });
}
