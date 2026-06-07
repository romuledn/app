const LOGO_DARK = "/images/senes-logo.webp";
const LOGO_WHITE = "/images/senes-logo-white.webp";

export function Logo({
  className = "h-8",
  variant = "dark",
}: {
  className?: string;
  showWordmark?: boolean;
  variant?: "dark" | "white";
}) {
  const src = variant === "white" ? LOGO_WHITE : LOGO_DARK;
  return <img src={src} alt="SENES MEDIA" className={className} style={{ objectFit: "contain" }} />;
}

export const LOGO_URL = LOGO_DARK;
