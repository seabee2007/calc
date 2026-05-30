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
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking client portal…
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200/60 dark:border-gray-700/70 bg-white/50 dark:bg-gray-900/30 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Link2 className="h-4 w-4 text-cyan-600" />
              Client project portal
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Share a read-only progress dashboard with your client — no login required.
            </p>
          </div>

          {portal ? (
            <Button
              size="sm"
              icon={<Copy size={16} />}
              onClick={() => void handleCopy()}
            >
              {copied ? 'Link copied' : 'Copy Client Portal Link'}
            </Button>
          ) : (
            <Button
              size="sm"
              icon={creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={16} />}
              disabled={creating}
              onClick={() => void handleCreate()}
            >
              Create Client Portal
            </Button>
          )}
        </div>

        {portal && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 break-all">
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
