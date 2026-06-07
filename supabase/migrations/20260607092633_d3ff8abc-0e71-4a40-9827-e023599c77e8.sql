
CREATE POLICY "project-feedback anon upload"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'project-feedback');

CREATE POLICY "project-feedback anon read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'project-feedback');

CREATE POLICY "project-feedback owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-feedback');
