const fs = require("fs");
const path = require("path");

const extractDir = path.resolve(
  "C:/dev/calc/data/estimating/production-rates/adobe/chapter5"
);

const structuredPath = path.join(extractDir, "structuredData.json");
const tablesDir = path.join(extractDir, "tables");

if (!fs.existsSync(structuredPath)) {
  throw new Error(`Missing structuredData.json at ${structuredPath}`);
}

const data = JSON.parse(fs.readFileSync(structuredPath, "utf8"));
const elements = data.elements ?? [];

const tableElements = elements.filter((e) =>
  String(e.Path ?? "").toLowerCase().includes("table")
);

const textElements = elements.filter((e) => e.Text);

const files = fs.existsSync(tablesDir)
  ? fs.readdirSync(tablesDir).map((file) => path.join(tablesDir, file))
  : [];

const xlsxFiles = files.filter((file) => file.toLowerCase().endsWith(".xlsx"));
const csvFiles = files.filter((file) => file.toLowerCase().endsWith(".csv"));
const pngFiles = files.filter((file) => file.toLowerCase().endsWith(".png"));

const pagesWithTables = new Set(
  tableElements
    .map((e) => e.Page)
    .filter((page) => page !== undefined && page !== null)
);

const sampleText = textElements.slice(0, 50).map((e) => ({
  page: e.Page,
  path: e.Path,
  text: e.Text
}));

const tableFileRefs = elements
  .filter((e) => Array.isArray(e.filePaths) && e.filePaths.length > 0)
  .map((e) => ({
    page: e.Page,
    path: e.Path,
    filePaths: e.filePaths,
    text: e.Text ?? null
  }));

const summary = {
  extractDir,
  totalElements: elements.length,
  totalPages: data.pages?.length ?? null,
  textElements: textElements.length,
  tableElements: tableElements.length,
  pagesWithTables: pagesWithTables.size,
  xlsxFiles: xlsxFiles.length,
  csvFiles: csvFiles.length,
  pngFiles: pngFiles.length,
  tableFileRefs: tableFileRefs.length
};

const outputDir = path.join(extractDir, "inspection");
fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(
  path.join(outputDir, "adobe-inspection-summary.json"),
  JSON.stringify(summary, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, "sample-text-elements.json"),
  JSON.stringify(sampleText, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, "table-file-references.json"),
  JSON.stringify(tableFileRefs, null, 2)
);

console.log("Inspection complete.");
console.log(summary);
console.log(`Wrote inspection files to: ${outputDir}`);