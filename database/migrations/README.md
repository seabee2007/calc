# Database Migrations

This directory contains SQL migration scripts for the concrete calculator application.

## How to Apply Migrations

### Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of the migration file
4. Execute the SQL commands

### Using Supabase CLI
```bash
supabase db push
```

## Migration Files

### `add_calculation_fields.sql`
Adds enhanced fields to the calculations table:
- `psi`: Concrete strength (TEXT)
- `mix_profile`: Mix profile type (TEXT) 
- `quikrete_product`: Quikrete product details (JSONB)

This enables the project details page to display:
- PSI and mix profile information with volume
- Quikrete product type and weight with bag count

## Notes
- All migrations use `IF NOT EXISTS` to prevent errors on re-runs
- JSONB is used for quikrete_product to store structured data efficiently
- Comments are added to document column purposes 