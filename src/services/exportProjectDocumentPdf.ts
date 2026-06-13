import {
  assembleDocument,
  evaluateDocumentCompliance,
  scoreDocumentRisk,
} from '../features/documents';
import { buildChangeOrderPreviewFromDocumentAnswers } from '../features/documents/ui/adapters/changeOrderPreviewAdapter';
import { buildDailyReportPreviewFromDocumentAnswers } from '../features/documents/ui/adapters/dailyReportPreviewAdapter';
import { buildFarPreviewFromDocumentAnswers } from '../features/documents/ui/adapters/farPreviewAdapter';
import { buildPunchListPreviewFromDocumentAnswers } from '../features/documents/ui/adapters/punchListPreviewAdapter';
import { buildQcReportPreviewFromDocumentAnswers } from '../features/documents/ui/adapters/qcReportPreviewAdapter';
import { buildRfiPreviewFromDocumentAnswers } from '../features/documents/ui/adapters/rfiPreviewAdapter';
import { buildSubmittalPreviewFromDocumentAnswers } from '../features/documents/ui/adapters/submittalPreviewAdapter';
import { buildWarrantyCloseoutPreviewFromDocumentAnswers } from '../features/documents/ui/adapters/warrantyCloseoutPreviewAdapter';
import { buildDocumentInput } from '../features/documents/ui/contractInput';
import { exportContractDraftPdf } from '../features/documents/ui/contractPdf';
import { mapCompanySettingsToContractPrefillSource } from '../features/documents/ui/contractPrefill';
import { restoreBuilderStateFromSnapshot } from '../features/documents/ui/contractVersionState';
import {
  normalizeCompanySettingsForDocument,
  type DocumentCompanySettingsSource,
} from '../features/documents/ui/documentCompanySettings';
import { generateChangeOrderPDF } from '../utils/changeOrderPdf';
import { generateDailyReportPDF } from '../features/documents/ui/pdf/dailyReportPdf';
import { generateFarPDF } from '../features/documents/ui/pdf/farPdf';
import { generatePunchListPDF } from '../features/documents/ui/pdf/punchListPdf';
import { generateQcReportPDF } from '../features/documents/ui/pdf/qcReportPdf';
import { generateRfiPDF } from '../features/documents/ui/pdf/rfiPdf';
import { generateSubmittalPDF } from '../features/documents/ui/pdf/submittalPdf';
import { generateWarrantyCloseoutPDF } from '../features/documents/ui/pdf/warrantyCloseoutPdf';
import { normalizePlannerDocumentType } from './documentWorkflowConfig';
import { resolveEffectiveDocumentType } from './projectDocumentDisplay';
import { getProjectDocument } from './projectDocumentService';
import { companySettingsFromDocumentSnapshot } from './projectDocumentSnapshots';
import type { Project } from '../types/index';

export interface ExportProjectDocumentPdfParams {
  documentId: string;
  mergedAnswers?: Record<string, unknown>;
  selectedProject?: Project | null;
  companySettings: DocumentCompanySettingsSource;
}

export async function exportProjectDocumentPdf(
  params: ExportProjectDocumentPdfParams,
): Promise<void> {
  const { document, versions } = await getProjectDocument(params.documentId);
  const current =
    versions.find((v) => v.id === document.current_version_id) ?? versions[0];
  if (!current) {
    throw new Error('Document has no saved version');
  }

  const state = restoreBuilderStateFromSnapshot(current.input_snapshot);
  const answers = {
    ...state.answers,
    ...(params.mergedAnswers ?? {}),
  };

  const snapshotCompany = companySettingsFromDocumentSnapshot(document.company_snapshot);
  const companySettings = normalizeCompanySettingsForDocument({
    ...params.companySettings,
    ...snapshotCompany,
  });

  const selectedProject = params.selectedProject ?? null;
  const title = document.title;
  const effectiveType = normalizePlannerDocumentType(
    resolveEffectiveDocumentType(document),
  );

  switch (effectiveType) {
    case 'change_order': {
      const preview = buildChangeOrderPreviewFromDocumentAnswers({
        answers,
        selectedProject,
        companySettings,
        title,
      });
      await generateChangeOrderPDF(preview.order, preview.context);
      return;
    }
    case 'rfi': {
      const view = buildRfiPreviewFromDocumentAnswers({
        answers,
        selectedProject,
        companySettings,
        title,
      });
      await generateRfiPDF(view);
      return;
    }
    case 'far': {
      const view = buildFarPreviewFromDocumentAnswers({
        answers,
        selectedProject,
        companySettings,
        title,
      });
      await generateFarPDF(view);
      return;
    }
    case 'submittal': {
      const view = buildSubmittalPreviewFromDocumentAnswers({
        answers,
        selectedProject,
        companySettings,
        title,
      });
      await generateSubmittalPDF(view);
      return;
    }
    case 'daily_report': {
      const view = buildDailyReportPreviewFromDocumentAnswers({
        answers,
        selectedProject,
        companySettings,
        title,
      });
      await generateDailyReportPDF(view);
      return;
    }
    case 'qc_report': {
      const view = buildQcReportPreviewFromDocumentAnswers({
        answers,
        selectedProject,
        companySettings,
        title,
      });
      await generateQcReportPDF(view);
      return;
    }
    case 'warranty_letter': {
      const view = buildWarrantyCloseoutPreviewFromDocumentAnswers({
        answers,
        selectedProject,
        companySettings,
        title,
      });
      await generateWarrantyCloseoutPDF(view);
      return;
    }
    case 'punch_list': {
      const view = buildPunchListPreviewFromDocumentAnswers({
        answers,
        selectedProject,
        companySettings,
        title,
      });
      await generatePunchListPDF(view);
      return;
    }
    case 'residential_contract':
    default: {
      const packKey = document.pack_key;
      const documentType = resolveEffectiveDocumentType(document);
      const input = buildDocumentInput(answers, [...state.accepted], {
        company: mapCompanySettingsToContractPrefillSource(companySettings),
        packKey,
        mode: state.mode,
        documentType: documentType as never,
      });
      const assembly = assembleDocument(input);
      const risk = scoreDocumentRisk(input);
      const compliance = evaluateDocumentCompliance(input);
      const company = mapCompanySettingsToContractPrefillSource(companySettings);
      await exportContractDraftPdf(
        assembly,
        risk,
        {
          companyName: company.legalName || companySettings.companyName || 'Arden Project OS',
          address: company.address || companySettings.address || '',
          phone: company.phone || companySettings.phone || '',
          email: company.email || companySettings.email,
          licenseNumber: company.licenseNumber || companySettings.licenseNumber,
          logoUrl: companySettings.logoUrl ?? null,
        },
        {
          answers,
          documentTitle: title || assembly.title,
          complianceWarningCount: compliance.issues.filter(
            (issue) => issue.severity === 'warning' || issue.severity === 'blocker',
          ).length,
        },
      );
    }
  }
}
