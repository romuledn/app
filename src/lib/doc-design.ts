// Document design configuration shared by quotations, invoices, and receipts.
// Lives on profiles.doc_design (jsonb) and travels with each DocData passed to
// the PDF renderer.

export type DocTemplate = "classic" | "modern" | "bold" | "minimal";
export type LogoPosition = "left" | "center" | "right";

export type DocDesign = {
  template: DocTemplate;
  accentColor: string;
  inkColor: string;
  displayFont: string;
  bodyFont: string;
  logoPosition: LogoPosition;
  showWatermark: boolean;
  showFooterBand: boolean;
};

export const DEFAULT_DESIGN: DocDesign = {
  template: "classic",
  accentColor: "#E63946",
  inkColor: "#161C32",
  displayFont: "Bricolage Grotesque",
  bodyFont: "Inter",
  logoPosition: "left",
  showWatermark: true,
  showFooterBand: true,
};

export const TEMPLATES: { id: DocTemplate; label: string; description: string }[] = [
  { id: "classic", label: "Classic", description: "Half red header block, watermark, footer band." },
  { id: "modern", label: "Modern", description: "Clean white header, thin accent rule, no watermark." },
  { id: "bold", label: "Bold", description: "Full-bleed coloured header, oversized label." },
  { id: "minimal", label: "Minimal", description: "Monochrome, ultra-restrained, accent only on total." },
];

export const DISPLAY_FONTS = [
  "Bricolage Grotesque",
  "Playfair Display",
  "DM Serif Display",
  "Space Grotesk",
  "Syne",
  "Cormorant Garamond",
  "Instrument Serif",
];

export const BODY_FONTS = [
  "Inter",
  "Manrope",
  "DM Sans",
  "Work Sans",
  "Lora",
  "IBM Plex Sans",
];

// Fonts we ship embedded in PDFs. Other selections render in the on-screen
// preview (via Google Fonts) but fall back to built-in PDF fonts.
export const PDF_EMBEDDED_FONTS = new Set(["Bricolage Grotesque", "Inter"]);

export function mergeDesign(input: Partial<DocDesign> | null | undefined): DocDesign {
  return { ...DEFAULT_DESIGN, ...(input ?? {}) };
}

// Convert "#rrggbb" -> [r,g,b]
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [231, 60, 39];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Google Fonts URL for loading on-screen previews.
export function googleFontsHref(families: string[]): string {
  const params = families
    .filter((f, i, arr) => arr.indexOf(f) === i)
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}
