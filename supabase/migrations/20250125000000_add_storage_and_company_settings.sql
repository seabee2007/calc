/*
  # Add Storage Bucket and Company Settings

  1. Storage Setup
    - Create 'logos' bucket for company logo uploads
    - Set up RLS policies for logo access
    - Configure public access for logo viewing

  2. Company Settings Table
    - Store company information in database
    - Replace localStorage storage
    - Enable user-specific company settings

  3. Security
    - Enable RLS on company_settings table
    - Allow authenticated users to manage their own settings
    - Public read access for logos (for proposals/PDFs)
*/

-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true);

-- Create company_settings table
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_name text DEFAULT '',
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  license_number text DEFAULT '',
  motto text DEFAULT '',
  logo_url text,
  logo_path text, -- Store the storage path for cleanup
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on company_settings
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for company_settings
CREATE POLICY "Users can view own company settings"
  ON company_settings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own company settings"
  ON company_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own company settings"
  ON company_settings
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own company settings"
  ON company_settings
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Storage policies for logos bucket
CREATE POLICY "Authenticated users can upload logos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can update their own logos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can delete their own logos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view logos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'logos');

-- Create index for better performance
CREATE INDEX IF NOT EXISTS company_settings_user_id_idx 
ON company_settings(user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column(); 