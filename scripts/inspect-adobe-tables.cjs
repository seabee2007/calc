const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const extractDir = path.resolve(
  "C:/dev/calc/data/estimating/production-rates/adobe/chapter5"
);

const tablesDir = path.join(extractDir, "tables");
const outputDir = path.join(extractDir, "inspection");

fs.mkdirSync(outputDir, { recursive: true });

if (!fs.existsSync(tablesDir)) {
  throw new Error(`Missing tables directory: ${tablesDir}`);
}

const xlsxFiles = fs
  .readdirSync(tablesDir)
  .filter((file) => file.toLowerCase().endsWith(".xlsx"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

function cleanCell(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function rowHasData(row) {
  return row.some((cell) => cleanCell(cell).length > 0);
}

function compactRow(row) {
  return row.map(cleanCell);
}

const inventory = [];

for (const file of xlsxFiles) {
  const fullPath = path.join(tablesDir, file);

  let workbook;
  try {
    workbook = XLSX.readFile(fullPath);
  } catch (error) {
    inventory.push({
      file,
      error: error.message
    });
    continue;
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false
  });

  const cleanedRows = rows.map(compactRow);
  const nonEmptyRows = cleanedRows.filter(rowHasData);
  const colCount = nonEmptyRows.reduce(
    (max, row) => Math.max(max, row.length),
    0
  );

  const joinedText = nonEmptyRows
    .slice(0, 8)
    .map((row) => row.join(" | "))
    .join(" ")
    .toLowerCase();

  const likelyProductionRateTable =
    joinedText.includes("man") ||
    joinedText.includes("hour") ||
    joinedText.includes("unit") ||
    joinedText.includes("crew") ||
    joinedText.includes("production") ||
    joinedText.includes("rate") ||
    joinedText.includes("quantity") ||
    joinedText.includes("activity");

  inventory.push({
    file,
    sheetName,
    rowCount: rows.length,
    nonEmptyRowCount: nonEmptyRows.length,
    colCount,
    likelyProductionRateTable,
    firstRows: nonEmptyRows.slice(0, 10)
  });
}

const likelyTables = inventory.filter((item) => item.likelyProductionRateTable);

fs.writeFileSync(
  path.join(outputDir, "table-inventory.json"),
  JSON.stringify(inventory, null, 2)
);

fs.writeFileSync(
  path.join(outputDir, "likely-production-rate-tables.json"),
  JSON.stringify(likelyTables, null, 2)
);

console.log("Table inspection complete.");
console.log({
  totalXlsxFiles: xlsxFiles.length,
  likelyProductionRateTables: likelyTables.length,
  outputDir
});

console.log("");
console.log("Top 20 likely tables:");
for (const item of likelyTables.slice(0, 20)) {
  console.log("");
  console.log(`${item.file} | rows: ${item.nonEmptyRowCount} | cols: ${item.colCount}`);
  for (const row of item.firstRows.slice(0, 3)) {
    console.log("  " + row.join(" | "));
  }
}
