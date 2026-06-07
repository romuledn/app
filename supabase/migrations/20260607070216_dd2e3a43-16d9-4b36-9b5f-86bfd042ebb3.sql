
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assignee_name text;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_progress_range CHECK (progress >= 0 AND progress <= 100);

CREATE TABLE IF NOT EXISTS public.project_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author_name text,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_comments TO authenticated;
GRANT ALL ON public.project_comments TO service_role;

ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments select if project visible"
  ON public.project_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (p.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "comments insert if project visible"
  ON public.project_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (p.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "comments delete own or admin"
  ON public.project_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS project_comments_project_id_idx ON public.project_comments(project_id);
