
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin','accounts');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

-- Pending admin emails (so romuled@senesmedia.com auto-becomes admin on signup)
CREATE TABLE public.pending_admin_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pending_admin_emails TO service_role;
ALTER TABLE public.pending_admin_emails ENABLE ROW LEVEL SECURITY;

INSERT INTO public.pending_admin_emails(email) VALUES ('romuled@senesmedia.com') ON CONFLICT DO NOTHING;

-- Assign role on signup; promote pending admins, otherwise default to accounts.
CREATE OR REPLACE FUNCTION public.assign_role_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE is_admin boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.pending_admin_emails WHERE lower(email)=lower(NEW.email)) INTO is_admin;
  INSERT INTO public.user_roles(user_id, role)
    VALUES (NEW.id, CASE WHEN is_admin THEN 'admin'::app_role ELSE 'accounts'::app_role END)
    ON CONFLICT DO NOTHING;
  IF is_admin THEN
    DELETE FROM public.pending_admin_emails WHERE lower(email)=lower(NEW.email);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_role
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_role_on_signup();

-- Backfill: if romuled already exists, make admin now.
INSERT INTO public.user_roles(user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE lower(email)='romuled@senesmedia.com'
ON CONFLICT DO NOTHING;

-- Existing users without role → accounts
INSERT INTO public.user_roles(user_id, role)
SELECT u.id, 'accounts'::app_role FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id=u.id
WHERE r.id IS NULL
ON CONFLICT DO NOTHING;

-- Track who did what
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS sent_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS sent_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Per-document T&Cs override
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS terms text;
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS terms text;

-- RECEIPTS
CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  number text NOT NULL,
  currency text NOT NULL,
  amount numeric NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  terms text,
  share_token uuid NOT NULL DEFAULT gen_random_uuid(),
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invoice_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receipts owner or admin select" ON public.receipts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "receipts insert own" ON public.receipts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "receipts update own or admin" ON public.receipts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "receipts delete own or admin" ON public.receipts FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Public share read
CREATE POLICY "receipts public via token" ON public.receipts FOR SELECT TO anon USING (true);
GRANT SELECT ON public.receipts TO anon;

-- Auto-create receipt when an invoice is fully paid
CREATE OR REPLACE FUNCTION public.auto_create_receipt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inv RECORD; paid_sum numeric;
BEGIN
  SELECT * INTO inv FROM public.invoices WHERE id = NEW.invoice_id;
  IF inv IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(amount),0) INTO paid_sum FROM public.invoice_payments WHERE invoice_id = inv.id;

  -- update invoice paid total + status
  UPDATE public.invoices
    SET amount_paid = paid_sum,
        status = CASE WHEN paid_sum >= total THEN 'paid' WHEN paid_sum > 0 THEN 'partial' ELSE status END,
        paid_at = CASE WHEN paid_sum >= total THEN COALESCE(paid_at, now()) ELSE paid_at END
    WHERE id = inv.id;

  IF paid_sum >= inv.total THEN
    INSERT INTO public.receipts(user_id, invoice_id, client_id, number, currency, amount, items, subtotal, discount, tax_rate, total, notes, terms)
    VALUES (
      inv.user_id, inv.id, inv.client_id,
      'RCT-' || substr(replace(inv.number,'INV-',''),1,10) || '-' || to_char(now(),'MMDD'),
      inv.currency, paid_sum, COALESCE(inv.items,'[]'::jsonb), inv.subtotal, COALESCE(inv.discount,0), inv.tax_rate, inv.total, inv.notes, inv.terms
    )
    ON CONFLICT (invoice_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_receipt ON public.invoice_payments;
CREATE TRIGGER trg_auto_receipt
AFTER INSERT ON public.invoice_payments FOR EACH ROW EXECUTE FUNCTION public.auto_create_receipt();

-- PROJECTS
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'ongoing',
  start_date date,
  due_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(quotation_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects owner or admin select" ON public.projects FOR SELECT TO authenticated
  USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "projects insert own" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "projects update own or admin" ON public.projects FOR UPDATE TO authenticated
  USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "projects delete own or admin" ON public.projects FOR DELETE TO authenticated
  USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- auto project on quotation accepted/converted
CREATE OR REPLACE FUNCTION public.project_from_quote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status IN ('accepted','converted') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.projects(user_id, client_id, quotation_id, title, start_date, due_date)
    VALUES (NEW.user_id, NEW.client_id, NEW.id, NEW.title, CURRENT_DATE, COALESCE(NEW.valid_until, CURRENT_DATE + INTERVAL '30 days'))
    ON CONFLICT (quotation_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_project_from_quote ON public.quotations;
CREATE TRIGGER trg_project_from_quote
AFTER UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.project_from_quote();

-- Notification reads
CREATE TABLE public.notification_reads (
  user_id uuid PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self read" ON public.notification_reads FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "self upsert" ON public.notification_reads FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "self update" ON public.notification_reads FOR UPDATE TO authenticated USING (auth.uid()=user_id);

-- Admin-wide read on existing tables (so admin sees everything created by accounts)
DROP POLICY IF EXISTS "admin reads all invoices" ON public.invoices;
CREATE POLICY "admin reads all invoices" ON public.invoices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admin reads all quotations" ON public.quotations;
CREATE POLICY "admin reads all quotations" ON public.quotations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admin reads all clients" ON public.clients;
CREATE POLICY "admin reads all clients" ON public.clients FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admin reads all activity" ON public.activity_log;
CREATE POLICY "admin reads all activity" ON public.activity_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "admin reads all payments" ON public.invoice_payments;
CREATE POLICY "admin reads all payments" ON public.invoice_payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
