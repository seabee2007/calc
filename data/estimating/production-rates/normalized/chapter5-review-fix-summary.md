# Chapter 5 review-fix summary

- Original review rows uploaded: 57
- Corrected replacement records created: 117
- Unique replacement IDs: 117

Several PDF rows contained multiple rates in one source table row, so the correct result is more replacement records than review rows. Examples include concrete formwork fabricate/erect/clean totals, pipe diameter rate tables, louvers with LF/Each subitems, and rough-in/finish plumbing fixture tables.

## Corrected records by division
- 01 General Requirements: 6
- 02 Existing Conditions: 1
- 03 Concrete: 8
- 04 Masonry: 1
- 05 Metals: 7
- 07 Thermal and Moisture Protection: 1
- 08 Openings: 5
- 09 Finishes: 6
- 12 Furnishings: 3
- 13 Special Construction: 2
- 22 Plumbing: 68
- 23 HVAC: 1
- 33 Utilities: 8

## Major fixes applied
- Removed duplicate/collapsed Cast Iron Pipe Bends row and replaced it with six pipe-diameter-specific records.
- Fixed leading-decimal errors such as .5 extracted as 5.0 and .0650 extracted as 650.0.
- Split collapsed `Each Each`, `LF Each`, and `SY SY` rows into separate source records.
- Split plumbing fixture rough-in and finish columns into separate records because the PDF table has separate man-hour columns.
- Verified the 1080.0 man-hour TPT fuel-unit rate as valid, not an extraction error.
- Converted the concrete stairs formwork rate from -0.55 to +0.55 because the PDF row is `0.55 Complete`.

## Files
- JSON: chapter5-production-rates.review-fixed.json
- CSV: chapter5-production-rates.review-fixed.csv