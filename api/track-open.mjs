// Vercel serverless function — email open tracking pixel
// When the recipient's email client loads this 1x1 transparent GIF,
// we record the open event in Supabase via a direct REST call (bypasses RLS).

// 1x1 transparent GIF (43 bytes)
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export default async function handler(req, res) {
  // Always serve the pixel — never block email rendering
  const servePixel = () => {
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Content-Length", PIXEL.length);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).end(PIXEL);
  };

  try {
    const { t: table, id } = req.query;
    if (!table || !id) return servePixel();

    // Only allow tracking on invoices and quotations
    const allowedTables = { i: "invoices", q: "quotations" };
    const tableName = allowedTables[table];
    if (!tableName) return servePixel();

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      // Fallback: use anon key with direct REST PATCH (relies on RLS)
      const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!supabaseUrl || !anonKey) {
        console.error("No Supabase credentials for tracking");
        return servePixel();
      }

      // Use PostgREST RPC to increment — but we need service role for that.
      // Without it, we simply log the attempt.
      console.log(`Email open detected (no service key): ${tableName}/${id}`);
      return servePixel();
    }

    const now = new Date().toISOString();

    // Fetch current record via PostgREST
    const getResp = await fetch(
      `${supabaseUrl}/rest/v1/${tableName}?id=eq.${id}&select=opened_at,open_count`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );

    if (!getResp.ok) {
      console.error("track-open GET failed:", await getResp.text());
      return servePixel();
    }

    const rows = await getResp.json();
    if (!rows.length) return servePixel();

    const row = rows[0];
    const update = { open_count: (row.open_count || 0) + 1 };
    if (!row.opened_at) update.opened_at = now;

    // Update via PostgREST
    const patchResp = await fetch(
      `${supabaseUrl}/rest/v1/${tableName}?id=eq.${id}`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(update),
      }
    );

    if (!patchResp.ok) {
      console.error("track-open PATCH failed:", await patchResp.text());
    } else {
      console.log(`Email open tracked: ${tableName}/${id} (count: ${update.open_count})`);
    }
  } catch (err) {
    console.error("track-open error:", err.message);
  }

  return servePixel();
}
