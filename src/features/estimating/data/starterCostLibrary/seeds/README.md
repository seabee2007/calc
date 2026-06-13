# Arden Starter Cost Library — Seed Files

This folder contains the **source data** for the starter cost library catalog. TypeScript modules are auto-generated from these files — do **not** edit `starterMaterials.ts` or `starterEquipment.ts` directly.

---

## Folder structure

```
seeds/
  materials/
    concrete-masonry.json       ← Concrete, ready-mix, rebar, CMU, mortar, formwork
    lumber-framing.json         ← Dimensional lumber, sheathing, connectors, fasteners
    roofing-exterior.json       ← Shingles, underlayment, flashing, siding, waterproofing
    drywall-finishes.json       ← Gypsum board, insulation, paint, flooring, tile
    mep.json                    ← Plumbing, electrical, HVAC
    sitework.json               ← Earthwork aggregates, drainage, landscaping, pavers
    specialties.json            ← Specialties, misc. materials (create when needed)
    general-conditions.json     ← Temporary materials, safety, site signage (create when needed)
  equipment/
    earthwork.json              ← Excavators, skid steers, compactors
    concrete.json               ← Pumps, vibrators, trowels, saws
    lifting-access.json         ← Forklifts, telehandlers, boom lifts, scissor lifts
    carpentry-framing.json      ← Saws, nail guns, drills (rental tools)
    drywall-finishes.json       ← Lifts, sprayers, grinders, sanders
    temporary-site.json         ← Generators, light towers, scaffolding, compressors
```

---

## Item schema

Every item must match `StarterCostLibraryItem` from `../starterCostLibraryTypes.ts`:

```ts
{
  id: string;               // stable slug, e.g. "material-concrete-ready-mix-4000-psi"
  type: 'material' | 'equipment';
  category: string;
  subcategory: string;
  csiDivision: string;      // e.g. "03"
  csiSection: string;       // e.g. "03 30 00"
  name: string;             // ≥12 chars, specific (not just "concrete" or "2x4")
  description: string;      // ≥40 chars, explains use
  unit: string;             // see allowed units below
  commonUnits: string[];
  defaultUnitCost: number;  // finite, ≥0, starter placeholder only
  costConfidence: 'placeholder' | 'low' | 'medium' | 'high';
  pricingRequired: true;    // always true for starter catalog
  tags: string[];           // at least one tag
  notes: string;            // must explain this is a placeholder
}
```

### Allowed units

**Materials:** `EA LF SF SY CY TON LB BAG ROLL BOX SQ GAL MBF`  
**Equipment:** `HR DAY WEEK MONTH`

---

## Rules for subagents

1. **Each subagent owns one file.** Do not edit other trade files.
2. **IDs must be stable slugs.** Use the pattern: `material-{trade}-{descriptor}` or `equipment-{category}-{descriptor}`. Once published, never change an ID.
3. **Names must be specific and estimator-ready.** Bad: `"2x4"`, `"compactor"`, `"concrete"`. Good: `"Framing lumber, SPF #2, 2x4 x 10'"`, `"Vibratory plate compactor, 4,000 lb centrifugal force"`.
4. **Descriptions ≥ 40 characters.** Explain what the item is used for.
5. **Pricing is placeholder only.** Always set:
   ```json
   "costConfidence": "placeholder",
   "pricingRequired": true,
   "notes": "Starter placeholder only. Verify local supplier pricing before proposal."
   ```
6. **Do not duplicate IDs.** Run the generator — it will fail loudly on any duplicate.
7. **Do not edit generated TypeScript.** The `.ts` files are overwritten every run.

---

## Workflow

### Add new items

1. Open the relevant `seeds/materials/<trade>.json` or `seeds/equipment/<trade>.json`.
2. Append new items following the schema above.
3. Run the generator:
   ```bash
   node scripts/generateStarterCostLibrary.mjs
   ```
4. Run tests to verify data quality:
   ```bash
   npm test
   ```
5. Commit both the seed file and the regenerated `.ts` file together.

### Add a new trade file

1. Create `seeds/materials/<new-trade>.json` as an empty array `[]` or with initial items.
2. The generator automatically picks up all `.json` files in the folder.
3. Follow the same workflow above.

### Fix a bad item

1. Edit the seed file directly.
2. Re-run the generator and tests.

---

## Do NOT

- Edit `starterMaterials.ts` or `starterEquipment.ts` manually.
- Edit `starterCostLibraryIndex.ts` (it just imports the generated modules).
- Edit app UI, estimate logic, database migrations, or schedule/CPM/Gantt code in a data task.
- Copy data from proprietary cost databases (RSMeans, etc.). Generate reasonable placeholders only.
