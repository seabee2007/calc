import type { ProjectDocumentRow } from '../../services/projectDocumentService';
import { resolveEffectiveDocumentType } from '../../services/projectDocumentDisplay';
import { contractBuilderToolHref } from '../../utils/plannerRoutes';

export function builderDocumentHrefs(projectId: string, doc: ProjectDocumentRow) {
  const packKey = doc.pack_key;
  const documentType = resolveEffectiveDocumentType(doc);
  const editHref = contractBuilderToolHref(projectId, doc.id, {
    packKey,
    documentType,
  });
  const exportHref = `${editHref}${editHref.includes('?') ? '&' : '?'}export=1`;
  return { editHref, exportHref };
}
