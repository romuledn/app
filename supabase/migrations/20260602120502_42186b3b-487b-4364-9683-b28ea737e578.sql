
DROP POLICY IF EXISTS "public accept quotation" ON public.quotations;
DROP POLICY IF EXISTS "public mark invoice viewed" ON public.invoices;
REVOKE UPDATE ON public.quotations FROM anon;
REVOKE UPDATE ON public.invoices FROM anon;

CREATE OR REPLACE FUNCTION public.mark_quotation_viewed(p_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.quotations SET viewed_at = COALESCE(viewed_at, now()) WHERE share_token = p_token;
$$;

CREATE OR REPLACE FUNCTION public.accept_quotation(p_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.quotations
     SET status = 'accepted', accepted_at = COALESCE(accepted_at, now())
   WHERE share_token = p_token AND status IN ('sent','draft');
$$;

CREATE OR REPLACE FUNCTION public.mark_invoice_viewed(p_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.invoices SET viewed_at = COALESCE(viewed_at, now()) WHERE share_token = p_token;
$$;

GRANT EXECUTE ON FUNCTION public.mark_quotation_viewed(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_quotation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invoice_viewed(uuid) TO anon, authenticated;
