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
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Create company_settings table
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name TEXT DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  license_number TEXT DEFAULT '',
  motto TEXT DEFAULT '',
  logo_url TEXT,
  logo_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id)
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  units TEXT DEFAULT 'imperial' CHECK (units IN ('imperial', 'metric')),
  length_unit TEXT DEFAULT 'feet' CHECK (length_unit IN ('feet', 'meters')),
  volume_unit TEXT DEFAULT 'cubic_yards' CHECK (volume_unit IN ('cubic_yards', 'cubic_feet', 'cubic_meters')),
  measurement_system TEXT DEFAULT 'imperial' CHECK (measurement_system IN ('imperial', 'metric')),
  currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'CAD', 'EUR', 'GBP')),
  default_psi TEXT DEFAULT '3000',
  auto_save BOOLEAN DEFAULT true,
  notifications JSONB DEFAULT '{"emailUpdates": true, "projectReminders": true, "weatherAlerts": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id)
);

-- Enable RLS for company_settings
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Enable RLS for user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for company_settings
CREATE POLICY "Users can view their own company settings" 
  ON company_settings FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own company settings" 
  ON company_settings FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own company settings" 
  ON company_settings FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own company settings" 
  ON company_settings FOR DELETE 
  USING (auth.uid() = user_id);

-- Create RLS policies for user_preferences
CREATE POLICY "Users can view their own preferences" 
  ON user_preferences FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" 
  ON user_preferences FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" 
  ON user_preferences FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences" 
  ON user_preferences FOR DELETE 
  USING (auth.uid() = user_id);

-- Create storage policy for logos (public read, authenticated write)
CREATE POLICY "Anyone can view logos" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'logos');

CREATE POLICY "Authenticated users can upload logos" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own logos" 
  ON storage.objects FOR UPDATE 
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own logos" 
  ON storage.objects FOR DELETE 
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_company_settings_user_id ON company_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Create trigger to update updated_at timestamp for company_settings
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_settings_updated_at 
  BEFORE UPDATE ON company_settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at 
  BEFORE UPDATE ON user_preferences 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 