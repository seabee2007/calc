import ProjectDocumentDrawer from '../ProjectDocumentDrawer';

interface Props {
  documentId: string | null;
  projectId: string;
  kind?: 'rfi' | 'far';
  onClose: () => void;
  onSaved: () => void;
}

/** @deprecated Prefer ProjectDocumentDrawer directly. */
export default function BuilderDocumentReviewDrawer({ kind, ...rest }: Props) {
  void kind;
  return <ProjectDocumentDrawer {...rest} />;
}
