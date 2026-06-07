
-- Profile branding & defaults
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS terms_conditions text DEFAULT 'All projects require a non-refundable 60% down payment before any work commences. This payment confirms project booking, secures production time, and covers initial planning, design, and development costs.',
  ADD COLUMN IF NOT EXISTS deposit_percent numeric NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS brand_color text NOT NULL DEFAULT '#E63946';

-- Quotations: share + discount + deposit
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS share_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_percent numeric NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS quotations_share_token_idx ON public.quotations(share_token);

-- Invoices: share + discount + recurring
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS share_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS recurring_interval text,
  ADD COLUMN IF NOT EXISTS next_issue_date date;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_share_token_idx ON public.invoices(share_token);

-- Partial payments
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  amount numeric NOT NULL,
  method text,
  reference text,
  paid_on date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_payments TO authenticated;
GRANT ALL ON public.invoice_payments TO service_role;
GRANT SELECT ON public.invoice_payments TO anon;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payments" ON public.invoice_payments
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Activity log
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activity" ON public.activity_log
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Anonymous read for public share links (filtered by share_token in queries)
CREATE POLICY "public read by token" ON public.quotations
  FOR SELECT TO anon USING (true);
CREATE POLICY "public read invoices by token" ON public.invoices
  FOR SELECT TO anon USING (true);
CREATE POLICY "public read clients via shared docs" ON public.clients
  FOR SELECT TO anon USING (true);
CREATE POLICY "public read profile" ON public.profiles
  FOR SELECT TO anon USING (true);
GRANT SELECT ON public.quotations TO anon;
GRANT SELECT ON public.invoices TO anon;
GRANT SELECT ON public.clients TO anon;
GRANT SELECT ON public.profiles TO anon;

-- Allow anon to update viewed_at / accepted_at via share link (constrained by status)
CREATE POLICY "public accept quotation" ON public.quotations
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "public mark invoice viewed" ON public.invoices
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
GRANT UPDATE (status, accepted_at, viewed_at) ON public.quotations TO anon;
GRANT UPDATE (viewed_at) ON public.invoices TO anon;
