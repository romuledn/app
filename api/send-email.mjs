// Vercel serverless function — sends transactional emails via Resend
// Env var required: RESEND_API_KEY

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY not set");
    return res.status(500).json({ error: "Email service not configured" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { to, subject, message, replyTo, documentType, documentNumber, clientName, total, shareUrl } = body;

    if (!to || !subject || !message) {
      return res.status(400).json({ error: "Missing required fields: to, subject, message" });
    }

    // Build a nicely formatted HTML email
    const html = buildHtml({ message, documentType, documentNumber, clientName, total, shareUrl });

    const resendPayload = {
      from: process.env.RESEND_FROM_EMAIL || "Senes Media <noreply@senesmedia.com>",
      to: [to],
      subject,
      html,
      text: message,
    };

    if (replyTo) {
      resendPayload.reply_to = replyTo;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Resend error:", result);
      return res.status(response.status).json({
        error: result.message || "Failed to send email",
      });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ success: true, id: result.id });
  } catch (err) {
    console.error("send-email error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}

function buildHtml({ message, documentType, documentNumber, clientName, total, shareUrl }) {
  const escapedMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  const viewButton = shareUrl
    ? `<div style="text-align:center;margin:28px 0">
        <a href="${shareUrl}" style="display:inline-block;padding:14px 32px;background-color:#dc2626;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px">
          View ${documentType || "Document"} Online
        </a>
       </div>`
    : "";

  const summaryRow = (label, value) =>
    value ? `<tr><td style="padding:6px 12px;color:#6b7280;font-size:14px">${label}</td><td style="padding:6px 12px;font-weight:600;font-size:14px">${value}</td></tr>` : "";

  const summaryTable =
    documentType || documentNumber || total
      ? `<table style="margin:20px auto;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden">
          ${summaryRow("Document", documentType && documentNumber ? `${documentType} #${documentNumber}` : "")}
          ${summaryRow("Client", clientName || "")}
          ${summaryRow("Total", total || "")}
         </table>`
      : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px">
    <div style="background:#ffffff;border-radius:12px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
      <div style="text-align:center;margin-bottom:24px">
        <h2 style="margin:0;color:#111827;font-size:20px">${documentType ? `Your ${documentType}` : "Message"} from Senes Media</h2>
      </div>
      <div style="color:#374151;font-size:15px;line-height:1.7">
        ${escapedMessage}
      </div>
      ${summaryTable}
      ${viewButton}
    </div>
    <div style="text-align:center;margin-top:24px;color:#9ca3af;font-size:12px">
      &copy; Senes Media &middot; Sent via Senes Accounts
    </div>
  </div>
</body>
</html>`;
}
