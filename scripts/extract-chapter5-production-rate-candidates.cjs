const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const extractDir = path.resolve(
  "C:/dev/calc/data/estimating/production-rates/adobe/chapter5"
);

const tablesDir = path.join(extractDir, "tables");
const outputDir = path.resolve(
  "C:/dev/calc/data/estimating/production-rates/normalized"
);

fs.mkdirSync(outputDir, { recursive: true });

function cleanCell(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeDescription(value) {
  return cleanCell(value)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/–|—/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  const text = cleanCell(value);
  if (!text) return null;

  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

function looksLikeRateHeader(row) {
  const text = row.join(" ").toLowerCase();
  return (
    text.includes("work element description") &&
    text.includes("unit") &&
    text.includes("man-hours")
  );
}

function hasData(row) {
  return row.some((cell) => cleanCell(cell).length > 0);
}

function isHeaderOrNoise(row) {
  const text = row.join(" ").toLowerCase();

  return (
    text.includes("work element description") ||
    text.includes("man-hours per unit") ||
    text.includes("man-hours per") ||
    text.includes("estimating worksheet") ||
    text.includes("project location") ||
    text.includes("project title") ||
    text.includes("prepared by") ||
    text.includes("checked by") ||
    text.includes("date prepared")
  );
}

function extractSectionCode(description) {
  const text = cleanCell(description);
  const match = text.match(/^(\d{2}\s+\d{2}\s+\d{2}(?:\.\d{2})?)/);
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

function extractItemCode(description) {
  const text = cleanCell(description);
  const match = text.match(/\((\d{4})\)/);
  return match ? match[1] : null;
}

function stripSectionAndItemCodes(description) {
  return normalizeDescription(description)
    .replace(/^\d{2}\s+\d{2}\s+\d{2}(?:\.\d{2})?\s*/, "")
    .replace(/^\(?\d{4}\)?\s*/, "")
    .replace(/^\((\d{4})\)\s*/, "")
    .trim();
}

function slugify(value) {
  return cleanCell(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildRateComponents(row) {
  const components = [];

  const fabricate = parseNumber(row[2]);
  const erectAndStrip = parseNumber(row[3]);
  const cleanAndMove = parseNumber(row[4]);
  const total = parseNumber(row[5]);

  if (fabricate !== null) {
    components.push({ name: "fabricate", manHoursPerUnit: fabricate });
  }

  if (erectAndStrip !== null) {
    components.push({ name: "erectAndStrip", manHoursPerUnit: erectAndStrip });
  }

  if (cleanAndMove !== null) {
    components.push({ name: "cleanAndMove", manHoursPerUnit: cleanAndMove });
  }

  if (total !== null) {
    components.push({ name: "total", manHoursPerUnit: total });
  }

  return components;
}

const xlsxFiles = fs
  .readdirSync(tablesDir)
  .filter((file) => file.toLowerCase().endsWith(".xlsx"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const candidates = [];
const rejectedRows = [];
const skippedTables = [];

for (const file of xlsxFiles) {
  const fullPath = path.join(tablesDir, file);

  let workbook;
  try {
    workbook = XLSX.readFile(fullPath);
  } catch (error) {
    rejectedRows.push({
      reason: "Could not read workbook",
      file,
      error: error.message
    });
    continue;
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils
    .sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false
    })
    .map((row) => row.map(cleanCell))
    .filter(hasData);

  const headerIndex = rows.findIndex(looksLikeRateHeader);

  if (headerIndex === -1) {
    skippedTables.push({
      file,
      reason: "No Work Element Description / Unit / Man-hours header found",
      firstRows: rows.slice(0, 5)
    });
    continue;
  }

  let currentSectionCode = null;
  let currentSectionTitle = null;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];

    if (isHeaderOrNoise(row)) continue;

    const descriptionRaw = normalizeDescription(row[0]);
    const unit = cleanCell(row[1]);
    const ratePrimary = parseNumber(row[2]);
    const rateComponents = buildRateComponents(row);
    const totalComponent = rateComponents.find((c) => c.name === "total");

    const hasRate =
      ratePrimary !== null ||
      rateComponents.some((component) => component.manHoursPerUnit !== null);

    const sectionCodeInDescription = extractSectionCode(descriptionRaw);
    const itemCode = extractItemCode(descriptionRaw);

    if (sectionCodeInDescription && !unit && !hasRate) {
      currentSectionCode = sectionCodeInDescription;
      currentSectionTitle = stripSectionAndItemCodes(descriptionRaw);
      continue;
    }

    if (
      descriptionRaw &&
      !sectionCodeInDescription &&
      !unit &&
      !hasRate &&
      currentSectionCode
    ) {
      currentSectionTitle = descriptionRaw;
      continue;
    }

    if (!descriptionRaw && !unit && !hasRate) continue;

    if (!unit || !hasRate) {
      rejectedRows.push({
        reason: "Missing unit or man-hours value",
        file,
        sheetName,
        rowNumberApprox: i + 1,
        currentSectionCode,
        currentSectionTitle,
        row
      });
      continue;
    }

    const sectionCode = sectionCodeInDescription || currentSectionCode;
    const itemDescription = stripSectionAndItemCodes(descriptionRaw);

    if (!sectionCode) {
      rejectedRows.push({
        reason: "Could not determine CSI/work element section code",
        file,
        sheetName,
        rowNumberApprox: i + 1,
        row
      });
      continue;
    }

    if (!itemDescription) {
      rejectedRows.push({
        reason: "Missing item description after removing section/item codes",
        file,
        sheetName,
        rowNumberApprox: i + 1,
        currentSectionCode,
        currentSectionTitle,
        row
      });
      continue;
    }

    const manHoursPerUnit =
      totalComponent?.manHoursPerUnit ?? ratePrimary ?? null;

    if (manHoursPerUnit === null) {
      rejectedRows.push({
        reason: "Could not parse numeric man-hours per unit",
        file,
        sheetName,
        rowNumberApprox: i + 1,
        currentSectionCode,
        currentSectionTitle,
        row
      });
      continue;
    }

    const idParts = [
      sectionCode.replace(/\s+/g, "-"),
      itemCode,
      slugify(itemDescription),
      slugify(unit)
    ].filter(Boolean);

    const candidate = {
      id: idParts.join("-"),
      sourceChapter: "chapter5",
      sourceTableFile: file,
      sourceSheetName: sheetName,
      sourceRowNumberApprox: i + 1,
      sectionCode,
      sectionTitle: currentSectionTitle,
      itemCode,
      workElementDescription: itemDescription,
      unit,
      manHoursPerUnit,
      rateComponents,
      rawRow: row
    };

    candidates.push(candidate);
  }
}

const duplicateMap = new Map();

for (const item of candidates) {
  const key = item.id;
  if (!duplicateMap.has(key)) duplicateMap.set(key, []);
  duplicateMap.get(key).push(item);
}

const duplicates = Array.from(duplicateMap.entries())
  .filter(([, records]) => records.length > 1)
  .map(([id, records]) => ({
    id,
    count: records.length,
    records: records.map((record) => ({
      sourceTableFile: record.sourceTableFile,
      sourceRowNumberApprox: record.sourceRowNumberApprox,
      sectionCode: record.sectionCode,
      itemCode: record.itemCode,
      workElementDescription: record.workElementDescription,
      unit: record.unit,
      manHoursPerUnit: record.manHoursPerUnit
    }))
  }));

const auditRows = [
  [
    "id",
    "sourceTableFile",
    "sourceRowNumberApprox",
    "sectionCode",
    "sectionTitle",
    "itemCode",
    "workElementDescription",
    "unit",
    "manHoursPerUnit"
  ]
];

for (const item of candidates) {
  auditRows.push([
    item.id,
    item.sourceTableFile,
    item.sourceRowNumberApprox,
    item.sectionCode,
    item.sectionTitle ?? "",
    item.itemCode ?? "",
    item.workElementDescription,
    item.unit,
    item.manHoursPerUnit
  ]);
}

const auditCsv = auditRows
  .map((row) => row.map(csvEscape).join(","))
  .join("\n");

fs.writeFileSync(
  path.join(outputDir, "chapter5-production-rate-candidates.json"),
  JSON.stringify(candidates, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, "chapter5-rejected-rows.json"),
  JSON.stringify(rejectedRows, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, "chapter5-duplicate-report.json"),
  JSON.stringify(duplicates, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, "chapter5-skipped-tables.json"),
  JSON.stringify(skippedTables, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, "chapter5-audit.csv"),
  auditCsv
);

console.log("Candidate extraction complete.");
console.log({
  xlsxFiles: xlsxFiles.length,
  candidates: candidates.length,
  rejectedRows: rejectedRows.length,
  duplicates: duplicates.length,
  skippedTables: skippedTables.length,
  outputDir
});

console.log("");
console.log("Output files:");
console.log(path.join(outputDir, "chapter5-production-rate-candidates.json"));
console.log(path.join(outputDir, "chapter5-rejected-rows.json"));
console.log(path.join(outputDir, "chapter5-duplicate-report.json"));
console.log(path.join(outputDir, "chapter5-skipped-tables.json"));
console.log(path.join(outputDir, "chapter5-audit.csv"));
