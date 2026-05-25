/*
  Structured US jobsite address on projects for geocoding, routing, and weather.
*/

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS jobsite_street text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS jobsite_street2 text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS jobsite_city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS jobsite_state text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS jobsite_zip text NOT NULL DEFAULT '';
