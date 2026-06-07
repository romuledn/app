
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS share_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS client_visible boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS projects_share_token_key ON public.projects(share_token);

ALTER TABLE public.project_comments
  ADD COLUMN IF NOT EXISTS client_visible boolean NOT NULL DEFAULT true;

-- Public read of single project by share token
GRANT SELECT ON public.projects TO anon;
GRANT SELECT ON public.project_comments TO anon;
GRANT SELECT ON public.clients TO anon;

DROP POLICY IF EXISTS "projects public read by token" ON public.projects;
CREATE POLICY "projects public read by token" ON public.projects
  FOR SELECT TO anon
  USING (client_visible = true);

DROP POLICY IF EXISTS "comments public read if visible" ON public.project_comments;
CREATE POLICY "comments public read if visible" ON public.project_comments
  FOR SELECT TO anon
  USING (
    client_visible = true
    AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_comments.project_id AND p.client_visible = true)
  );

DROP POLICY IF EXISTS "clients public read for shared project" ON public.clients;
CREATE POLICY "clients public read for shared project" ON public.clients
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.client_id = clients.id AND p.client_visible = true));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_comments;
