/**
 * Shared prop-type shapes for professional document shell components.
 *
 * These are intentionally narrow — only the fields the document paper
 * renderers actually display. They are aligned with the `companySettings`
 * pick in DocumentPreviewRouter and the ChangeOrderDocumentContext fields.
 */

export interface DocumentCompany {
  name: string;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  licenseNumber?: string | null;
}

export interface DocumentProject {
  name?: string | null;
  address?: string | null;
  projectNumber?: string | null;
}

export interface DocumentInfoRow {
  label: string;
  value?: string | null;
}
