/*
  Tighten logos bucket INSERT policy to require folder ownership.

  Previously, any authenticated user could INSERT into any path under the logos
  bucket. UPDATE and DELETE already required auth.uid() = folder[1]. This aligns
  INSERT with that ownership model.

  Unchanged:
  - logos bucket public setting
  - bucket file_size_limit and allowed_mime_types
  - public SELECT policy
  - UPDATE and DELETE policies
*/

DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;

CREATE POLICY "Authenticated users can upload logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
