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
  const res = await fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Email failed (${res.status})`);
  }
}
