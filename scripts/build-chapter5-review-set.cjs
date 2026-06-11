const fs = require("fs");
const path = require("path");

const normalizedDir = path.resolve(
  "C:/dev/calc/data/estimating/production-rates/normalized"
);

const adobeInspectionDir = path.resolve(
  "C:/dev/calc/data/estimating/production-rates/adobe/chapter5/inspection"
);

const candidatesPath = path.join(normalizedDir, "chapter5-production-rate-candidates.json");
const duplicatesPath = path.join(normalizedDir, "chapter5-duplicate-report.json");
const tableRefsPath = path.join(adobeInspectionDir, "table-file-references.json");

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function normalizeUnit(unit) {
  const raw = String(unit || "").trim();
  const key = raw.toLowerCase();

  const unitMap = {
    "each": "EA",
    "ea": "EA",
    "sf": "SF",
    "square foot": "SF",
    "square feet": "SF",
    "lf": "LF",
    "foot": "LF",
    "feet": "LF",
    "sy": "SY",
    "cyd": "CY",
    "cy": "CY",
    "bank cyd": "BCY",
    "cf": "CF",
    "bf": "BF",
    "ton": "TON",
    "acre": "ACRE",
    "lb": "LB",
    "pair": "PAIR",
    "opening": "OPENING",
    "square": "SQUARE",
    "sf floor": "SF_FLOOR",
    "sf of contact surface": "SF_CONTACT_SURFACE",
    "sf of shelf": "SF_SHELF"
  };

  return unitMap[key] || raw.toUpperCase().replace(/\s+/g, "_");
}

function divisionName(code) {
  const map = {
    "01": "General Requirements",
    "02": "Existing Conditions",
    "03": "Concrete",
    "04": "Masonry",
    "05": "Metals",
    "06": "Wood, Plastics, and Composites",
    "07": "Thermal and Moisture Protection",
    "08": "Openings",
    "09": "Finishes",
    "10": "Specialties",
    "11": "Equipment",
    "12": "Furnishings",
    "13": "Special Construction",
    "21": "Fire Suppression",
    "22": "Plumbing",
    "23": "HVAC",
    "26": "Electrical",
    "27": "Communications",
    "28": "Electronic Safety and Security",
    "31": "Earthwork",
    "32": "Exterior Improvements",
    "33": "Utilities",
    "34": "Transportation",
    "35": "Waterway and Marine Construction",
    "41": "Material Processing and Handling Equipment",
    "46": "Water and Wastewater Equipment"
  };

  return map[code] || "Unknown";
}

function isSuspiciousRate(rate) {
  const value = Number(rate);
  return !Number.isFinite(value) || value <= 0 || value > 1000;
}

function isSuspiciousUnit(unit) {
  const raw = String(unit || "").trim();

  return (
    !raw ||
    raw.length > 25 ||
    /man-hours|description|unit|total hours|complete/i.test(raw) ||
    /^each each$/i.test(raw) ||
    /^lf each$/i.test(raw)
  );
}

const candidates = readJson(candidatesPath, []);
const duplicates = readJson(duplicatesPath, []);
const tableRefs = readJson(tableRefsPath, []);

const duplicateIds = new Set(duplicates.map((item) => item.id));

const tableFileToPage = new Map();

for (const ref of tableRefs || []) {
  for (const filePath of ref.filePaths || []) {
    const fileName = path.basename(filePath);
    if (!tableFileToPage.has(fileName)) {
      tableFileToPage.set(fileName, ref.page ?? ref.Page ?? null);
    }
  }
}

const ready = [];
const needsReview = [];

for (const item of candidates) {
  const flags = [];

  if (duplicateIds.has(item.id)) flags.push("DUPLICATE_ID");
  if (isSuspiciousRate(item.manHoursPerUnit)) flags.push("SUSPICIOUS_RATE");
  if (isSuspiciousUnit(item.unit)) flags.push("SUSPICIOUS_UNIT");
  if (!item.sectionTitle) flags.push("MISSING_SECTION_TITLE");
  if (!item.workElementDescription) flags.push("MISSING_DESCRIPTION");

  const divisionCode = String(item.sectionCode || "").slice(0, 2);
  const adobePageIndex = tableFileToPage.get(item.sourceTableFile) ?? null;

  const normalized = {
    id: item.id,
    sourceDocument: "WCRP 3-40D.12",
    sourceChapter: item.sourceChapter,
    sourceTableFile: item.sourceTableFile,
    sourceSheetName: item.sourceSheetName,
    sourceRowNumberApprox: item.sourceRowNumberApprox,
    sourceAdobePageIndex: adobePageIndex,
    sourcePageNumberApprox:
      Number.isInteger(adobePageIndex) ? adobePageIndex + 1 : null,

    division: divisionCode,
    divisionName: divisionName(divisionCode),
    sectionCode: item.sectionCode,
    sectionTitle: item.sectionTitle,
    itemCode: item.itemCode,

    workElementDescription: item.workElementDescription,
    unitOriginal: item.unit,
    unit: normalizeUnit(item.unit),

    rateType: "LABOR_MAN_HOURS_PER_UNIT",
    manHoursPerUnit: Number(item.manHoursPerUnit),

    rateComponents: item.rateComponents || [],
    rawRow: item.rawRow
  };

  if (flags.length > 0) {
    needsReview.push({
      reviewFlags: flags,
      ...normalized
    });
  } else {
    ready.push(normalized);
  }
}

ready.sort((a, b) =>
  a.division.localeCompare(b.division) ||
  a.sectionCode.localeCompare(b.sectionCode) ||
  String(a.itemCode || "").localeCompare(String(b.itemCode || "")) ||
  a.workElementDescription.localeCompare(b.workElementDescription)
);

needsReview.sort((a, b) =>
  a.reviewFlags.join(",").localeCompare(b.reviewFlags.join(",")) ||
  a.division.localeCompare(b.division) ||
  a.sectionCode.localeCompare(b.sectionCode)
);

const flagCounts = {};

for (const item of needsReview) {
  for (const flag of item.reviewFlags) {
    flagCounts[flag] = (flagCounts[flag] || 0) + 1;
  }
}

const csvRows = [
  [
    "reviewFlags",
    "id",
    "division",
    "divisionName",
    "sectionCode",
    "sectionTitle",
    "itemCode",
    "workElementDescription",
    "unitOriginal",
    "unit",
    "manHoursPerUnit",
    "sourceTableFile",
    "sourceRowNumberApprox",
    "sourcePageNumberApprox"
  ]
];

for (const item of needsReview) {
  csvRows.push([
    item.reviewFlags.join("|"),
    item.id,
    item.division,
    item.divisionName,
    item.sectionCode,
    item.sectionTitle || "",
    item.itemCode || "",
    item.workElementDescription,
    item.unitOriginal,
    item.unit,
    item.manHoursPerUnit,
    item.sourceTableFile,
    item.sourceRowNumberApprox,
    item.sourcePageNumberApprox || ""
  ]);
}

fs.writeFileSync(
  path.join(normalizedDir, "chapter5-production-rates.review-clean.json"),
  JSON.stringify(ready, null, 2)
);

fs.writeFileSync(
  path.join(normalizedDir, "chapter5-production-rates.needs-review.json"),
  JSON.stringify(needsReview, null, 2)
);

fs.writeFileSync(
  path.join(normalizedDir, "chapter5-production-rates.needs-review.csv"),
  csvRows.map((row) => row.map(csvEscape).join(",")).join("\n")
);

fs.writeFileSync(
  path.join(normalizedDir, "chapter5-production-rates.review-summary.json"),
  JSON.stringify(
    {
      totalCandidates: candidates.length,
      reviewClean: ready.length,
      needsReview: needsReview.length,
      flagCounts
    },
    null,
    2
  )
);

console.log("Review set complete.");
console.log({
  totalCandidates: candidates.length,
  reviewClean: ready.length,
  needsReview: needsReview.length,
  flagCounts,
  outputDir: normalizedDir
});

console.log("");
console.log("Output files:");
console.log(path.join(normalizedDir, "chapter5-production-rates.review-clean.json"));
console.log(path.join(normalizedDir, "chapter5-production-rates.needs-review.json"));
console.log(path.join(normalizedDir, "chapter5-production-rates.needs-review.csv"));
console.log(path.join(normalizedDir, "chapter5-production-rates.review-summary.json"));
