
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS revision1_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revision2_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_revisions integer NOT NULL DEFAULT 0 CHECK (paid_revisions >= 0);
