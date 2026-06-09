// Temporary debug endpoint — test activity_log insert
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://mzwtbltayapdplekstro.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const results = {
    supabaseUrl: supabaseUrl ? "SET" : "MISSING",
    serviceKey: serviceKey ? `SET (${serviceKey.substring(0, 20)}...)` : "MISSING",
    serviceKeyLength: serviceKey?.length || 0,
  };

  if (!supabaseUrl || !serviceKey) {
    return res.status(200).json({ ...results, error: "Missing credentials" });
  }

  // Test 1: Read an invoice
  try {
    const getResp = await fetch(
      `${supabaseUrl}/rest/v1/invoices?select=id,user_id,number,client_id&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    const getText = await getResp.text();
    results.invoiceRead = { status: getResp.status, body: getText.substring(0, 200) };
  } catch (e) {
    results.invoiceRead = { error: e.message };
  }

  // Test 2: Insert into activity_log
  try {
    const postResp = await fetch(`${supabaseUrl}/rest/v1/activity_log`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: "1cc980cd-871d-43ad-8fc9-e6de0d39e51c",
        entity_type: "invoices",
        entity_id: "de36ce0f-5b5a-4f29-938d-2cc3c7815b20",
        action: "email_opened",
        meta: { number: "TEST-001", client_name: "Test Client", doc_type: "invoice", open_count: 1, first_open: true },
      }),
    });
    const postText = await postResp.text();
    results.activityInsert = { status: postResp.status, body: postText.substring(0, 300) };
  } catch (e) {
    results.activityInsert = { error: e.message };
  }

  return res.status(200).json(results);
}
