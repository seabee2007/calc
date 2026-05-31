-- Company-wide tax defaults for standard pricing
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS tax_system text NOT NULL DEFAULT 'none'
    CHECK (tax_system IN ('none', 'sales_tax', 'gross_receipts_tax', 'vat')),
  ADD COLUMN IF NOT EXISTS tax_rate_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_application text NOT NULL DEFAULT 'materials_only'
    CHECK (tax_application IN ('materials_only', 'materials_and_equipment', 'entire_project'));

COMMENT ON COLUMN company_settings.tax_system IS 'none | sales_tax | gross_receipts_tax | vat';
COMMENT ON COLUMN company_settings.tax_application IS 'Taxable base: materials_only | materials_and_equipment | entire_project';
