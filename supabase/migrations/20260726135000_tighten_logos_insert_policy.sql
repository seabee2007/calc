-- Logos bucket INSERT policy: require folder ownership (auth.uid() = folder[1]).
-- Unchanged: public SELECT, UPDATE, DELETE, bucket public flag, MIME and size limits.

DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;

CREATE POLICY "Authenticated users can upload logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
