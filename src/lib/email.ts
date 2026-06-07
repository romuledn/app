const FORMSPREE_URL = "https://formspree.io/f/xrevpaqq";

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
};

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const res = await fetch(FORMSPREE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      email: payload.to,
      _replyto: payload.replyTo || payload.to,
      _subject: payload.subject,
      message: payload.message,
      "Client Name": payload.clientName || "",
      "Client Email": payload.to,
      "Document Type": payload.documentType || "",
      "Document Number": payload.documentNumber || "",
      "Total Amount": payload.total || "",
      "View Online": payload.shareUrl || "",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Email failed (${res.status})`);
  }
}
