-- Tighten logos bucket INSERT policy to require folder ownership.
-- Previously any authenticated user could INSERT into any path under logos.
-- UPDATE and DELETE already required auth.uid() = folder[1].
-- Unchanged: public SELECT, UPDATE/DELETE policies, bucket public flag, MIME/size limits.

DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;

CREATE POLICY "Authenticated users can upload logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
