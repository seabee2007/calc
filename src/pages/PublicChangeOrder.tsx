import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, X, Loader2 } from 'lucide-react';
import {
  acceptChangeOrder,
  declineChangeOrder,
  fetchChangeOrderPublicBundle,
  markChangeOrderOpened,
} from '../lib/changeOrderTracking';
import type { ChangeOrder } from '../types/changeOrder';
import ChangeOrderDocument from '../components/change-order/ChangeOrderDocument';
import SignatureBlock from '../components/change-order/SignatureBlock';
import Button from '../components/ui/Button';
import { SURFACE_ELEVATED } from '../theme/appTheme';
import {
  buildChangeOrderDocumentContextFromPublic,
  type ChangeOrderPublicBundle,
} from '../utils/changeOrderDocumentContext';
import { useNoIndex } from '../hooks/useNoIndex';

const PublicChangeOrder: React.FC = () => {
  useNoIndex();
  const { token } = useParams<{ token: string }>();
  const [order, setOrder] = useState<ChangeOrder | null>(null);
  const [publicBundle, setPublicBundle] = useState<ChangeOrderPublicBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<'accept' | 'decline' | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientSignature, setClientSignature] = useState('');
  const openedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid change order link.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const bundle = await fetchChangeOrderPublicBundle(token);
        if (cancelled) return;
        if (!bundle) {
          setError('This change order is unavailable or has not been sent yet.');
          setLoading(false);
          return;
        }
        setPublicBundle(bundle);
        setOrder(bundle.order);
        if (bundle.order.clientName) setClientName(bundle.order.clientName);
        if (bundle.order.clientSignature) setClientSignature(bundle.order.clientSignature);
        if (!openedRef.current) {
          openedRef.current = true;
          const updated = await markChangeOrderOpened(token);
          if (!cancelled) {
            setOrder(updated);
            setPublicBundle((prev) =>
              prev ? { ...prev, order: updated } : { order: updated, project: null, company: null },
            );
          }
        }
      } catch {
        if (!cancelled) setError('Could not load this change order.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    if (!clientName.trim()) {
      setError('Please enter your printed name before accepting.');
      return;
    }
    if (!clientSignature.trim()) {
      setError('Please sign or use your typed name as signature before accepting.');
      return;
    }
    setError(null);
    setActionLoading('accept');
    try {
      const updated = await acceptChangeOrder(token, {
        name: clientName.trim(),
        signature: clientSignature.trim(),
      });
      setOrder(updated);
      setPublicBundle((prev) =>
        prev ? { ...prev, order: updated } : { order: updated, project: null, company: null },
      );
      setClientName(updated.clientName ?? clientName);
      setClientSignature(updated.clientSignature ?? clientSignature);
    } catch {
      setError('Could not record acceptance. Please contact your contractor.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    setActionLoading('decline');
    try {
      const updated = await declineChangeOrder(token);
      setOrder(updated);
      setPublicBundle((prev) =>
        prev ? { ...prev, order: updated } : { order: updated, project: null, company: null },
      );
    } finally {
      setActionLoading(null);
    }
  };

  const documentContext = useMemo(() => {
    if (!order) return undefined;
    const bundle = publicBundle ?? { order, project: null, company: null };
    return buildChangeOrderDocumentContextFromPublic(bundle);
  }, [order, publicBundle]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-600" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className={`max-w-md text-center rounded-xl p-8 shadow-lg ${SURFACE_ELEVATED}`}>
          <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Change order unavailable
          </p>
          <p className="text-gray-600 dark:text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const isFinal = order.status === 'accepted' || order.status === 'declined';

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-900 py-6 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">Change order</p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-1">{order.title}</h1>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {error}
          </div>
        )}

        {order.status === 'accepted' && (
          <div className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 p-4 text-center text-emerald-800 dark:text-emerald-200">
            You accepted this change order. Your contractor will update the project contract.
          </div>
        )}
        {order.status === 'declined' && (
          <div className="mb-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 text-center text-slate-700 dark:text-slate-300">
            This change order was declined.
          </div>
        )}

        <div className={`rounded-xl shadow-lg overflow-hidden mb-6 ${SURFACE_ELEVATED}`}>
          <ChangeOrderDocument
            order={order}
            audience="client"
            context={documentContext}
          />
        </div>

        {!isFinal && (
          <>
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-gray-800">
              <SignatureBlock
                title="Your signature (required to accept)"
                name={clientName}
                signature={clientSignature}
                signedAt={order.clientSignedAt}
                onNameChange={setClientName}
                onSignatureChange={setClientSignature}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center sticky bottom-4">
              <Button
                variant="primary"
                size="lg"
                className="flex-1 sm:flex-none"
                onClick={handleAccept}
                disabled={actionLoading !== null}
                icon={
                  actionLoading === 'accept' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Check className="h-5 w-5" />
                  )
                }
              >
                Accept change order
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
};

export default PublicChangeOrder;
