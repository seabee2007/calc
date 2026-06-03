interface DocumentSignatureBlockProps {
  role: string;
  printedName?: string | null;
  /** Typed name or base64 image data-URL. */
  signedName?: string | null;
  signedAt?: string | null;
  showDateLine?: boolean;
}

function formatSignedAt(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

/**
 * Read-only preview signature block.
 *
 * Matches the `SignatureDisplay` pattern in ChangeOrderDocument (lines 44–81)
 * without the interactive canvas used by `components/change-order/SignatureBlock.tsx`.
 */
export default function DocumentSignatureBlock({
  role,
  printedName,
  signedName,
  signedAt,
  showDateLine = true,
}: DocumentSignatureBlockProps) {
  const ts = formatSignedAt(signedAt);

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{role}</p>

      {printedName?.trim() ? (
        <p className="mt-2 text-sm text-slate-900">
          <span className="font-medium">Printed name:</span> {printedName}
        </p>
      ) : (
        <p className="mt-2 text-sm italic text-slate-400">Not signed</p>
      )}

      <div className="mt-3 min-h-[3rem] border-b border-slate-300">
        {signedName?.startsWith('data:image') ? (
          <img
            src={signedName}
            alt={`${role} signature`}
            className="max-h-16 object-contain"
          />
        ) : signedName?.trim() ? (
          <p className="font-serif text-lg italic text-slate-900">{signedName}</p>
        ) : (
          <p className="text-xs text-slate-400">Signature</p>
        )}
      </div>

      {showDateLine ? (
        ts ? (
          <p className="mt-2 text-xs text-slate-500">Signed {ts}</p>
        ) : (
          <p className="mt-2 text-xs text-slate-400">Date</p>
        )
      ) : null}
    </div>
  );
}
