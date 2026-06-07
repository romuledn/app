
-- Client revision feedback (screenshots + comments) and meeting requests for project tracking page
CREATE TABLE public.project_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  revision_number smallint NOT NULL CHECK (revision_number IN (1,2)),
  client_name text,
  client_email text,
  message text NOT NULL,
  screenshots jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_feedback_project_idx ON public.project_feedback(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_feedback TO authenticated;
GRANT SELECT, INSERT ON public.project_feedback TO anon;
GRANT ALL ON public.project_feedback TO service_role;

ALTER TABLE public.project_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback owner or admin select"
  ON public.project_feedback FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE POLICY "feedback owner or admin update"
  ON public.project_feedback FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE POLICY "feedback owner or admin delete"
  ON public.project_feedback FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE POLICY "feedback public insert via shared project"
  ON public.project_feedback FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.client_visible = true));

CREATE POLICY "feedback public read via shared project"
  ON public.project_feedback FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.client_visible = true));


CREATE TABLE public.project_meeting_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  revision_number smallint NOT NULL CHECK (revision_number IN (1,2)),
  duration_minutes integer NOT NULL,
  preferred_at timestamptz,
  client_name text,
  client_email text,
  notes text,
  status text NOT NULL DEFAULT 'requested',
  paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_duration_valid CHECK (
    (revision_number = 1 AND duration_minutes > 0 AND duration_minutes <= 30) OR
    (revision_number = 2 AND duration_minutes > 0 AND duration_minutes <= 45) OR
    paid = true
  )
);
CREATE UNIQUE INDEX project_meeting_one_free_per_revision
  ON public.project_meeting_requests(project_id, revision_number)
  WHERE paid = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_meeting_requests TO authenticated;
GRANT SELECT, INSERT ON public.project_meeting_requests TO anon;
GRANT ALL ON public.project_meeting_requests TO service_role;

ALTER TABLE public.project_meeting_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meetings owner or admin select"
  ON public.project_meeting_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE POLICY "meetings owner or admin update"
  ON public.project_meeting_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE POLICY "meetings owner or admin delete"
  ON public.project_meeting_requests FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE POLICY "meetings public insert via shared project"
  ON public.project_meeting_requests FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.client_visible = true));

CREATE POLICY "meetings public read via shared project"
  ON public.project_meeting_requests FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.client_visible = true));

ALTER PUBLICATION supabase_realtime ADD TABLE public.project_feedback;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_meeting_requests;
