import React, { useEffect, useState } from 'react';
import { Copy, Link2, Loader2, Plus } from 'lucide-react';
import Button from '../ui/Button';
import {
  copyClientPortalLink,
  createClientPortal,
  fetchClientPortalByProjectId,
  getClientPortalUrl,
} from '../../services/clientPortalService';
import type { ClientPortalRecord } from '../../types/clientPortal';
import ClientPortalCreatedModal from './ClientPortalCreatedModal';
import {
  OPS_MUTED,
  OPS_OUTLINE_BTN,
  OPS_SECTION,
  OPS_SECTION_TITLE,
} from '../dashboard/opsTheme';
import { TEXT_ACCENT } from '../../theme/appTheme';

interface ClientPortalActionsProps {
  projectId: string;
  clientName?: string;
  clientEmail?: string;
}

const ClientPortalActions: React.FC<ClientPortalActionsProps> = ({
  projectId,
  clientName,
  clientEmail,
}) => {
  const [portal, setPortal] = useState<ClientPortalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createdModal, setCreatedModal] = useState<ClientPortalRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchClientPortalByProjectId(projectId)
      .then((row) => {
        if (!cancelled) setPortal(row);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load client portal.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleCreate = async () => {
    const name = clientName?.trim();
    const email = clientEmail?.trim();
    if (!name || !email) {
      setError('Add client name and email on the project before creating a portal.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const row = await createClientPortal({
        projectId,
        clientName: name,
        clientEmail: email,
      });
      setPortal(row);
      setCreatedModal(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create client portal.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!portal) return;
    await copyClientPortalLink(portal.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm ${OPS_MUTED}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking client portal…
      </div>
    );
  }

  return (
    <>
      <div className={OPS_SECTION}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className={`${OPS_SECTION_TITLE} flex items-center gap-2`}>
              <Link2 className={`h-4 w-4 ${TEXT_ACCENT}`} />
              Client project portal
            </p>
            <p className={`text-xs ${OPS_MUTED} mt-1`}>
              Share a read-only progress dashboard with your client — no login required.
            </p>
          </div>

          {portal ? (
            <Button
              size="sm"
              variant="outline"
              className={OPS_OUTLINE_BTN}
              icon={<Copy size={16} />}
              onClick={() => void handleCopy()}
            >
              {copied ? 'Link copied' : 'Copy Client Portal Link'}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className={OPS_OUTLINE_BTN}
              icon={creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={16} />}
              disabled={creating}
              onClick={() => void handleCreate()}
            >
              Create Client Portal
            </Button>
          )}
        </div>

        {portal && (
          <p className={`text-xs ${OPS_MUTED} mt-3 break-all`}>
            {getClientPortalUrl(portal.token)}
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
        )}
      </div>

      {createdModal && (
        <ClientPortalCreatedModal
          clientName={createdModal.clientName}
          token={createdModal.token}
          onClose={() => setCreatedModal(null)}
        />
      )}
    </>
  );
};

export default ClientPortalActions;
