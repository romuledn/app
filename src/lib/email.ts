type EmailPayload = {
  to: string;
  subject: string;
  message: string;
  replyTo?: string;
  documentType?: string;
  documentNumber?: string;
  clientName?: string;
  total?: string;
  shareUrl?: string;
  bankDetails?: string;       // currency-specific banking details
  trackingId?: string;       // document UUID for open tracking
  trackingTable?: "i" | "q"; // i = invoices, q = quotations
};

const EMAIL_API = "https://senes-accounts.vercel.app/api/send-email";

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const res = await fetch(EMAIL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Email failed (${res.status})`);
  }
}
