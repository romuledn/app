DROP POLICY IF EXISTS "receipts public via token" ON public.receipts;
REVOKE SELECT ON public.receipts FROM anon;