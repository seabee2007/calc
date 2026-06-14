-- Structured business address columns on profiles (replaces single text column)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_address_street      text,
  ADD COLUMN IF NOT EXISTS business_address_street2     text,
  ADD COLUMN IF NOT EXISTS business_address_city        text,
  ADD COLUMN IF NOT EXISTS business_address_state       text,
  ADD COLUMN IF NOT EXISTS business_address_postal_code text;

-- If business_address text was previously added, migrate it into street and drop it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'profiles'
      AND column_name  = 'business_address'
  ) THEN
    UPDATE public.profiles
      SET business_address_street = business_address
      WHERE business_address IS NOT NULL
        AND business_address_street IS NULL;
    ALTER TABLE public.profiles DROP COLUMN business_address;
  END IF;
END $$;
