
CREATE OR REPLACE FUNCTION public.auto_create_receipt()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE inv RECORD; paid_sum numeric; q_valid date;
BEGIN
  SELECT * INTO inv FROM public.invoices WHERE id = NEW.invoice_id;
  IF inv IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(amount),0) INTO paid_sum FROM public.invoice_payments WHERE invoice_id = inv.id;

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

    -- Auto-create project when invoice is fully paid
    IF inv.quotation_id IS NOT NULL THEN
      SELECT valid_until INTO q_valid FROM public.quotations WHERE id = inv.quotation_id;
      INSERT INTO public.projects(user_id, client_id, quotation_id, title, start_date, due_date)
      VALUES (inv.user_id, inv.client_id, inv.quotation_id, inv.title, CURRENT_DATE, COALESCE(q_valid, CURRENT_DATE + INTERVAL '30 days'))
      ON CONFLICT (quotation_id) DO NOTHING;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.user_id = inv.user_id AND p.title = inv.title AND p.client_id = inv.client_id
      ) THEN
        INSERT INTO public.projects(user_id, client_id, title, start_date, due_date)
        VALUES (inv.user_id, inv.client_id, inv.title, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;
