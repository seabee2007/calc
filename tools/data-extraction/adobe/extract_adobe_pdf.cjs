require("dotenv").config({ path: ".env.local" });

const {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  ExtractPDFParams,
  ExtractElementType,
  ExtractRenditionsElementType,
  ExtractPDFJob,
  ExtractPDFResult
} = require("@adobe/pdfservices-node-sdk");

const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

function getArg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

async function pipeToFile(readStream, outputFilePath) {
  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(outputFilePath);
    readStream.pipe(writeStream);
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
    readStream.on("error", reject);
  });
}

async function main() {
  const inputArg = getArg("input");
  const outputArg = getArg("output", "data/estimating/production-rates/adobe/chapter5");

  if (!inputArg) {
    throw new Error(
      "Missing --input. Example: npm run extract:adobe-production-rates -- --input data/manuals/MCRP-3-40D.12.pdf"
    );
  }

  const inputPdf = path.resolve(inputArg);
  const outputDir = path.resolve(outputArg);
  const outputZip = path.join(outputDir, "adobe-extract-output.zip");

  if (!process.env.PDF_SERVICES_CLIENT_ID || !process.env.PDF_SERVICES_CLIENT_SECRET) {
    throw new Error(
      "Missing Adobe credentials. Add PDF_SERVICES_CLIENT_ID and PDF_SERVICES_CLIENT_SECRET to .env.local"
    );
  }

  if (!fs.existsSync(inputPdf)) {
    throw new Error(`Missing input PDF: ${inputPdf}`);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const credentials = new ServicePrincipalCredentials({
    clientId: process.env.PDF_SERVICES_CLIENT_ID,
    clientSecret: process.env.PDF_SERVICES_CLIENT_SECRET
  });

  const pdfServices = new PDFServices({ credentials });

  console.log("Uploading PDF to Adobe...");
  const inputAsset = await pdfServices.upload({
    readStream: fs.createReadStream(inputPdf),
    mimeType: MimeType.PDF
  });

  const params = new ExtractPDFParams({
    elementsToExtract: [
      ExtractElementType.TEXT,
      ExtractElementType.TABLES
    ],
    elementsToExtractRenditions: [
      ExtractRenditionsElementType.TABLES
    ]
  });

  console.log("Submitting Extract PDF job...");
  const job = new ExtractPDFJob({ inputAsset, params });

  const pollingURL = await pdfServices.submit({ job });

  console.log("Waiting for Adobe extraction result...");
  const response = await pdfServices.getJobResult({
    pollingURL,
    resultType: ExtractPDFResult
  });

  const resultAsset = response.result.resource;
  const streamAsset = await pdfServices.getContent({ asset: resultAsset });

  console.log("Downloading ZIP...");
  await pipeToFile(streamAsset.readStream, outputZip);

  console.log("Extracting ZIP...");
  const zip = new AdmZip(outputZip);
  zip.extractAllTo(outputDir, true);

  const structuredPath = path.join(outputDir, "structuredData.json");

  if (!fs.existsSync(structuredPath)) {
    throw new Error("structuredData.json was not found in Adobe output.");
  }

  const structuredData = JSON.parse(fs.readFileSync(structuredPath, "utf8"));

  const summary = {
    inputPdf,
    outputDir,
    outputZip,
    totalElements: structuredData.elements?.length ?? 0,
    totalPages: structuredData.pages?.length ?? 0,
    tableElements: structuredData.elements?.filter((e) => e.Path?.includes("Table")).length ?? 0,
    textElements: structuredData.elements?.filter((e) => Boolean(e.Text)).length ?? 0,
    extractedAt: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(outputDir, "extraction-summary.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log("Adobe extraction complete.");
  console.log(summary);
}

main().catch((error) => {
  console.error("Extraction failed:");
  console.error(error);
  process.exit(1);
});