import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Loader2, Lock, X } from 'lucide-react';
import SignatureBlock from '../../../components/change-order/SignatureBlock';
import Button from '../../../components/ui/Button';
import {
  APP_SECTION_CARD,
  SURFACE_ELEVATED,
  TEXT_BODY,
  TEXT_FOREGROUND,
  TEXT_MUTED,
} from '../../../theme/appTheme';
import { CC_PAGE_HERO_TITLE } from '../../../theme/pageTypography';
import {
  declineContract,
  fetchContractByPublicToken,
  markContractViewed,
  signContract,
} from '../services/contractDocumentService';
import type { PublicContractData } from '../services/contractDocumentTypes';

function unavailableMessage(data: PublicContractData | null): string {
  if (!data) {
    return 'This contract is unavailable, has not been sent yet, or the signing link has expired.';
  }
  if (data.document.public_token_revoked_at) {
    return 'This signing link has been revoked by the contractor.';
  }
  if (
    data.document.public_token_expires_at &&
    new Date(data.document.public_token_expires_at) < new Date()
  ) {
    return 'This signing link has expired. Contact your contractor for a new link.';
  }
  return 'This contract is unavailable.';
}

export default function PublicContractPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'sign' | 'decline' | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientSignature, setClientSignature] = useState('');
  const viewedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid contract link.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const result = await fetchContractByPublicToken(token);
        if (cancelled) return;
        if (!result) {
          setError(unavailableMessage(null));
          setLoading(false);
          return;
        }
        setData(result);
        if (result.document.client_signer_name) setClientName(result.document.client_signer_name);
        if (result.document.client_signature) setClientSignature(result.document.client_signature);
        if (!viewedRef.current && result.document.signing_status === 'sent') {
          viewedRef.current = true;
          const updated = await markContractViewed(token);
          if (!cancelled && updated) setData(updated);
        }
      } catch {
        if (!cancelled) setError('Could not load this contract.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSign = async () => {
    if (!token) return;
    if (!clientName.trim()) {
      setError('Please enter your printed name before signing.');
      return;
    }
    if (!clientSignature.trim()) {
      setError('Please sign or use your typed name as signature before signing.');
      return;
    }
    setError(null);
    setActionLoading('sign');
    try {
      const updated = await signContract(token, clientName.trim(), clientSignature.trim());
      if (updated) setData(updated);
    } catch {
      setError('Could not record your signature. Please contact your contractor.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    setActionLoading('decline');
    try {
      const updated = await declineContract(token);
      if (updated) setData(updated);
    } catch {
      setError('Could not record your response. Please contact your contractor.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-600" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className={`max-w-md text-center rounded-xl p-8 shadow-lg ${SURFACE_ELEVATED}`}>
          <p className={`text-lg font-semibold ${TEXT_FOREGROUND} mb-2`}>Contract unavailable</p>
          <p className={TEXT_BODY}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { document: doc, version } = data;
  const isFinal = doc.signing_status === 'signed' || doc.signing_status === 'declined';
  const disclaimer = version?.manifest?.disclaimer;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-900 py-6 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6 text-center">
          <p className={`text-sm ${TEXT_MUTED}`}>Construction contract</p>
          <h1 className={`${CC_PAGE_HERO_TITLE} mt-1`}>{doc.title}</h1>
          {version && (
            <p className={`mt-1 text-xs ${TEXT_MUTED}`}>
              Version {version.version_number} · ref {version.output_hash}
            </p>
          )}
          {doc.public_token_expires_at && !isFinal && (
            <p className={`mt-2 text-xs ${TEXT_MUTED}`}>
              Link expires {new Date(doc.public_token_expires_at).toLocaleString()}
            </p>
          )}
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {error}
          </div>
        )}

        {doc.signing_status === 'signed' && (
          <div className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 p-4 text-center text-emerald-800 dark:text-emerald-200">
            You signed this contract. A copy has been recorded for your contractor.
          </div>
        )}
        {doc.signing_status === 'declined' && (
          <div className="mb-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 text-center text-slate-700 dark:text-slate-300">
            This contract was declined.
          </div>
        )}

        {disclaimer && (
          <p className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            {disclaimer}
          </p>
        )}

        <div className={`rounded-xl shadow-lg overflow-hidden mb-6 p-6 ${APP_SECTION_CARD}`}>
          {version ? (
            <div className="space-y-5">
              {version.sections.map((section) => {
                const isLockedNotice = section.clauseKey.startsWith('notice.');
                return (
                  <article key={section.clauseKey}>
                    <h2 className={`flex items-center gap-2 text-sm font-semibold ${TEXT_FOREGROUND}`}>
                      {isLockedNotice && <Lock className="h-3.5 w-3.5 text-amber-500" aria-hidden />}
                      {section.title}
                    </h2>
                    <p className={`mt-1 whitespace-pre-wrap text-sm leading-relaxed ${TEXT_BODY}`}>
                      {section.body}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className={`text-sm ${TEXT_MUTED}`}>This contract has no content to display.</p>
          )}
        </div>

        {doc.contractor_signature && (
          <div className="mb-4">
            <SignatureBlock
              title="Contractor signature"
              name={doc.contractor_signer_name ?? ''}
              signature={doc.contractor_signature}
              signedAt={doc.contractor_signed_at}
              onNameChange={() => {}}
              onSignatureChange={() => {}}
              readOnly
            />
          </div>
        )}

        {isFinal ? (
          <div className="mb-6">
            <SignatureBlock
              title="Client signature"
              name={doc.client_signer_name ?? clientName}
              signature={doc.client_signature ?? clientSignature}
              signedAt={doc.client_signed_at}
              onNameChange={() => {}}
              onSignatureChange={() => {}}
              readOnly
            />
          </div>
        ) : (
          <>
            <div className={`mb-4 rounded-xl p-4 ${APP_SECTION_CARD}`}>
              <SignatureBlock
                title="Your signature (required to sign)"
                helperText="By signing you agree to the terms of this draft contract. Review with your own counsel if needed."
                name={clientName}
                signature={clientSignature}
                signedAt={doc.client_signed_at}
                onNameChange={setClientName}
                onSignatureChange={setClientSignature}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center sticky bottom-4">
              <Button
                variant="primary"
                size="lg"
                className="flex-1 sm:flex-none"
                onClick={handleSign}
                disabled={actionLoading !== null}
                icon={
                  actionLoading === 'sign' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Check className="h-5 w-5" />
                  )
                }
              >
                Sign contract
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={handleDecline}
                disabled={actionLoading !== null}
                icon={
                  actionLoading === 'decline' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <X className="h-5 w-5" />
                  )
                }
              >
                Decline
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
