import { Link2, Send } from 'lucide-react';
import SignatureBlock from '../../../../components/change-order/SignatureBlock';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import { APP_SECTION_CARD, TEXT_FOREGROUND, TEXT_MUTED } from '../../../../theme/appTheme';
import { getPublicContractUrl } from '../../services/contractDocumentService';
import type { ContractDocumentRow } from '../../services/contractDocumentTypes';
import { SIGNING_STATUS_STYLES } from '../contractBuilderConstants';

export interface SignaturePanelProps {
  documentId: string;
  loadedDoc: ContractDocumentRow | null;
  contractorName: string;
  contractorSignature: string;
  sending: boolean;
  onContractorNameChange: (name: string) => void;
  onContractorSignatureChange: (signature: string) => void;
  onSendForSignature: () => void;
  onCopyContractLink: () => void;
}

export default function SignaturePanel({
  documentId,
  loadedDoc,
  contractorName,
  contractorSignature,
  sending,
  onContractorNameChange,
  onContractorSignatureChange,
  onSendForSignature,
  onCopyContractLink,
}: SignaturePanelProps) {
  if (!documentId) return null;

  const signingStatus = loadedDoc?.signing_status ?? 'draft';
  const isSentForSigning = signingStatus !== 'draft' && signingStatus !== 'void';

  return (
    <div className={APP_SECTION_CARD}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>Client signature</h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
            SIGNING_STATUS_STYLES[signingStatus] ?? SIGNING_STATUS_STYLES.draft
          }`}
        >
          {signingStatus}
        </span>
      </div>

      {!isSentForSigning ? (
        <div className="space-y-3">
          <p className={`text-xs ${TEXT_MUTED}`}>
            Counter-sign (optional), then send the latest saved version to your client for
            signature.
          </p>
          <SignatureBlock
            title="Your signature (contractor)"
            name={contractorName}
            signature={contractorSignature}
            signedAt={loadedDoc?.contractor_signed_at}
            onNameChange={onContractorNameChange}
            onSignatureChange={onContractorSignatureChange}
          />
          <Button variant="accent" onClick={onSendForSignature} isLoading={sending} fullWidth>
            <Send className="mr-1.5 h-4 w-4" aria-hidden />
            Send for client signature
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {signingStatus === 'signed' && (
            <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
              Signed by {loadedDoc?.client_signer_name || 'the client'}
              {loadedDoc?.client_signed_at
                ? ` on ${new Date(loadedDoc.client_signed_at).toLocaleString()}`
                : ''}
              .
            </p>
          )}
          {signingStatus === 'declined' && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              The client declined this contract.
            </p>
          )}
          {(signingStatus === 'sent' || signingStatus === 'viewed') && (
            <p className={`text-xs ${TEXT_MUTED}`}>
              Waiting on the client. Share the signing link below.
            </p>
          )}
          {loadedDoc?.public_token && (
            <>
              <Input
                label="Client signing link"
                value={getPublicContractUrl(loadedDoc.public_token)}
                readOnly
                fullWidth
              />
              <Button variant="outline" onClick={onCopyContractLink} fullWidth>
                <Link2 className="mr-1.5 h-4 w-4" aria-hidden />
                Copy signing link
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
