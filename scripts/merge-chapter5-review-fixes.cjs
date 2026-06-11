const fs = require("fs");
const path = require("path");

const normalizedDir = path.resolve(
  "C:/dev/calc/data/estimating/production-rates/normalized"
);

const cleanPath = path.join(
  normalizedDir,
  "chapter5-production-rates.review-clean.json"
);

const fixedPath = path.join(
  normalizedDir,
  "chapter5-production-rates.review-fixed.json"
);

const finalPath = path.join(
  normalizedDir,
  "chapter5-production-rates.final-reviewed.json"
);

const seedPath = path.join(
  normalizedDir,
  "chapter5-production-rates.seed.json"
);

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isBadUnit(unit) {
  const value = String(unit || "").trim();
  return (
    !value ||
    value.includes(" ") ||
    /EACH_EACH|LF_EACH|SY_SY|8\.312/i.test(value)
  );
}

function isBadRate(row) {
  const value = Number(row.manHoursPerUnit);
  if (!Number.isFinite(value) || value <= 0) return true;

  // 1080 is valid for 33 52 00.00 TPT fuel unit per source PDF.
  if (row.sectionCode === "33 52 00.00" && row.itemCode === "0110" && value === 1080) {
    return false;
  }

  // Anything over 300 should be intentionally reviewed later, but do not fail here.
  return false;
}

const cleanRows = readJson(cleanPath);
const fixedRows = readJson(fixedPath);

const rowsById = new Map();

for (const row of cleanRows) {
  rowsById.set(row.id, row);
}

// Fixed records intentionally override any matching extraction record.
for (const row of fixedRows) {
  rowsById.set(row.id, row);
}

const finalRows = Array.from(rowsById.values()).sort((a, b) =>
  String(a.division || "").localeCompare(String(b.division || "")) ||
  String(a.sectionCode || "").localeCompare(String(b.sectionCode || "")) ||
  String(a.itemCode || "").localeCompare(String(b.itemCode || "")) ||
  String(a.workElementDescription || "").localeCompare(String(b.workElementDescription || ""))
);

const ids = new Set();
const duplicateIds = [];

const validationErrors = [];

for (const row of finalRows) {
  if (ids.has(row.id)) duplicateIds.push(row.id);
  ids.add(row.id);

  if (!row.id) validationErrors.push({ id: row.id, reason: "Missing id" });
  if (!row.sectionCode) validationErrors.push({ id: row.id, reason: "Missing sectionCode" });
  if (!row.sectionTitle) validationErrors.push({ id: row.id, reason: "Missing sectionTitle" });
  if (!row.workElementDescription) validationErrors.push({ id: row.id, reason: "Missing workElementDescription" });
  if (isBadUnit(row.unit)) validationErrors.push({ id: row.id, reason: `Bad unit: ${row.unit}` });
  if (isBadRate(row)) validationErrors.push({ id: row.id, reason: `Bad manHoursPerUnit: ${row.manHoursPerUnit}` });
}

if (duplicateIds.length > 0) {
  validationErrors.push({
    reason: "Duplicate IDs after merge",
    duplicateIds
  });
}

if (validationErrors.length > 0) {
  const errorPath = path.join(normalizedDir, "chapter5-production-rates.final-validation-errors.json");
  fs.writeFileSync(errorPath, JSON.stringify(validationErrors, null, 2));
  console.error("Validation failed.");
  console.error({ validationErrors: validationErrors.length, errorPath });
  process.exit(1);
}

fs.writeFileSync(finalPath, JSON.stringify(finalRows, null, 2));

const seed = {
  schemaVersion: "1.0.0",
  sourceDocument: "MCRP 3-40D.12 / NTRP 4-04.2.3 / TM 3-34.41, Construction Estimating",
  sourceChapter: "chapter5",
  rateType: "LABOR_MAN_HOURS_PER_UNIT",
  generatedAt: new Date().toISOString(),
  recordCount: finalRows.length,
  records: finalRows
};

fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2));

console.log("Final reviewed production-rate dataset created.");
console.log({
  cleanRows: cleanRows.length,
  fixedRows: fixedRows.length,
  finalRows: finalRows.length,
  finalPath,
  seedPath
});
