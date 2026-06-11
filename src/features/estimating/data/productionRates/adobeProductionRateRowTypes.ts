/** Adobe Chapter 5 final-reviewed row shape (browser-safe, no Node imports). */
export interface AdobeFinalReviewedRow {
  id?: string;
  sourceDocument?: string;
  sourceChapter?: string;
  sourceTableFile?: string;
  sourceSheetName?: string;
  sourceRowNumberApprox?: number | null;
  sourceAdobePageIndex?: number | null;
  sourcePageNumberApprox?: number | null;
  division?: string;
  divisionName?: string;
  sectionCode?: string;
  sectionTitle?: string;
  itemCode?: string;
  workElementDescription?: string;
  unitOriginal?: string;
  unit?: string;
  rateType?: string;
  manHoursPerUnit?: number | null;
  rateComponents?: Array<{ name: string; manHoursPerUnit?: number | null }>;
  reviewStatus?: string;
  reviewNotes?: string;
  rawRow?: unknown;
}
