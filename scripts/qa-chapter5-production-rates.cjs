const fs = require("fs");
const path = require("path");

const normalizedDir = path.resolve(
  "C:/dev/calc/data/estimating/production-rates/normalized"
);

const candidatesPath = path.join(normalizedDir, "chapter5-production-rate-candidates.json");
const rejectedPath = path.join(normalizedDir, "chapter5-rejected-rows.json");
const duplicatesPath = path.join(normalizedDir, "chapter5-duplicate-report.json");
const skippedPath = path.join(normalizedDir, "chapter5-skipped-tables.json");

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function countBy(items, keyFn) {
  const map = new Map();

  for (const item of items) {
    const key = keyFn(item) || "UNKNOWN";
    map.set(key, (map.get(key) || 0) + 1);
  }

  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
}

function sample(items, count = 10) {
  return items.slice(0, count);
}

const candidates = readJson(candidatesPath);
const rejectedRows = readJson(rejectedPath);
const duplicates = readJson(duplicatesPath);
const skippedTables = readJson(skippedPath);

const byDivision = countBy(candidates, item => {
  const match = String(item.sectionCode || "").match(/^(\d{2})/);
  return match ? match[1] : "UNKNOWN";
});

const bySection = countBy(candidates, item => item.sectionCode);
const byUnit = countBy(candidates, item => item.unit);
const bySourceTable = countBy(candidates, item => item.sourceTableFile);
const rejectedByReason = countBy(rejectedRows, item => item.reason);
const skippedByReason = countBy(skippedTables, item => item.reason);

const suspiciousRates = candidates.filter(item => {
  const rate = Number(item.manHoursPerUnit);
  return !Number.isFinite(rate) || rate <= 0 || rate > 1000;
});

const suspiciousUnits = candidates.filter(item => {
  const unit = String(item.unit || "").trim();
  return (
    !unit ||
    unit.length > 25 ||
    /man-hours|description|unit|total hours|complete/i.test(unit)
  );
});

const missingSectionTitle = candidates.filter(item => !item.sectionTitle);

const report = {
  totals: {
    candidates: candidates.length,
    rejectedRows: rejectedRows.length,
    duplicates: duplicates.length,
    skippedTables: skippedTables.length,
    suspiciousRates: suspiciousRates.length,
    suspiciousUnits: suspiciousUnits.length,
    missingSectionTitle: missingSectionTitle.length
  },
  byDivision,
  topSections: bySection.slice(0, 40),
  topUnits: byUnit.slice(0, 40),
  topSourceTables: bySourceTable.slice(0, 40),
  rejectedByReason,
  skippedByReason,
  duplicateSamples: duplicates.slice(0, 10),
  suspiciousRateSamples: sample(suspiciousRates, 20),
  suspiciousUnitSamples: sample(suspiciousUnits, 20),
  missingSectionTitleSamples: sample(missingSectionTitle, 20),
  candidateSamples: sample(candidates, 30),
  rejectedSamples: sample(rejectedRows, 30)
};

fs.writeFileSync(
  path.join(normalizedDir, "chapter5-qa-report.json"),
  JSON.stringify(report, null, 2)
);

const markdown = [];
markdown.push("# Chapter 5 Production Rate QA Report");
markdown.push("");
markdown.push("## Totals");
markdown.push("");
for (const [key, value] of Object.entries(report.totals)) {
  markdown.push(`- ${key}: ${value}`);
}

markdown.push("");
markdown.push("## Candidates by Division");
markdown.push("");
for (const row of byDivision) {
  markdown.push(`- ${row.key}: ${row.count}`);
}

markdown.push("");
markdown.push("## Rejected Rows by Reason");
markdown.push("");
for (const row of rejectedByReason) {
  markdown.push(`- ${row.key}: ${row.count}`);
}

markdown.push("");
markdown.push("## Top Units");
markdown.push("");
for (const row of byUnit.slice(0, 25)) {
  markdown.push(`- ${row.key}: ${row.count}`);
}

markdown.push("");
markdown.push("## Duplicate Samples");
markdown.push("");
markdown.push("```json");
markdown.push(JSON.stringify(duplicates.slice(0, 5), null, 2));
markdown.push("```");

markdown.push("");
markdown.push("## Suspicious Unit Samples");
markdown.push("");
markdown.push("```json");
markdown.push(JSON.stringify(suspiciousUnits.slice(0, 10), null, 2));
markdown.push("```");

markdown.push("");
markdown.push("## Candidate Samples");
markdown.push("");
markdown.push("```json");
markdown.push(JSON.stringify(candidates.slice(0, 10), null, 2));
markdown.push("```");

fs.writeFileSync(
  path.join(normalizedDir, "chapter5-qa-report.md"),
  markdown.join("\n")
);

console.log("QA report complete.");
console.log(report.totals);
console.log("");
console.log("Candidates by division:");
console.table(byDivision);
console.log("");
console.log("Rejected by reason:");
console.table(rejectedByReason);
console.log("");
console.log("Top units:");
console.table(byUnit.slice(0, 20));
console.log("");
console.log("Output files:");
console.log(path.join(normalizedDir, "chapter5-qa-report.json"));
console.log(path.join(normalizedDir, "chapter5-qa-report.md"));
