import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Copy, Mail, Share2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { useProjectStore } from '../../store';
import { useAuth } from '../../hooks/useAuth';
import { AUTH_ACCENT, authInputClassName } from '../auth/authBrandTheme';
import { createProjectInvitation } from '../../services/projectInviteService';
import { PROJECT_CLIENT_ROLES } from '../../types/projectInvite';
import {
  APP_SHARE_EMAIL_SUBJECT,
  buildAppShareEmailBody,
  buildMailtoLink,
  buildProjectInviteEmailBody,
  copyToClipboard,
  getAppShareOrigin,
  getSafeShareUrl,
  PROJECT_INVITE_EMAIL_SUBJECT,
  shareOrCopy,
} from '../../utils/shareLinks';

interface ShareInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ShareToast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[10060] -translate-x-1/2 rounded-full border border-cyan-400/30 bg-slate-950/95 px-4 py-2 text-sm text-cyan-100 shadow-lg shadow-cyan-950/40"
    >
      {message}
    </div>
  );
}

export default function ShareInviteModal({ isOpen, onClose }: ShareInviteModalProps) {
  const location = useLocation();
  const { isOwner } = useAuth();
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);

  const [toast, setToast] = useState<string | null>(null);
  const [projectId, setProjectId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientRole, setClientRole] = useState('client_viewer');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const appShareUrl = useMemo(
    () => getSafeShareUrl(location.pathname),
    [location.pathname],
  );

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'Select a project' },
      ...projects.map((project) => ({ value: project.id, label: project.name })),
    ],
    [projects],
  );

  useEffect(() => {
    if (!isOpen) return;
    if (projects.length === 0) {
      void loadProjects();
    }
  }, [isOpen, loadProjects, projects.length]);

  useEffect(() => {
    if (!isOpen) return;
    if (!projectId && projects[0]) {
      setProjectId(projects[0].id);
    }
  }, [isOpen, projectId, projects]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showCopiedToast = () => setToast('Link copied');

  const handleShareResult = async (result: Awaited<ReturnType<typeof shareOrCopy>>) => {
    if (result === 'copied') {
      showCopiedToast();
    }
  };

  const handleCopyAppLink = async () => {
    const copied = await copyToClipboard(appShareUrl);
    if (copied) showCopiedToast();
  };

  const handleShareApp = async () => {
    const result = await shareOrCopy({
      title: 'Arden Project OS',
      text: 'Professional construction project management for estimates, proposals, schedules, and field tracking.',
      url: appShareUrl,
    });
    await handleShareResult(result);
  };

  const handleEmailAppInvite = () => {
    const mailto = buildMailtoLink({
      subject: APP_SHARE_EMAIL_SUBJECT,
      body: buildAppShareEmailBody(appShareUrl),
    });
    window.location.href = mailto;
  };

  const handleGenerateInviteLink = async () => {
    if (!projectId) {
      setInviteError('Select a project first.');
      return;
    }

    try {
      setCreatingInvite(true);
      setInviteError(null);
      const result = await createProjectInvitation({
        projectId,
        inviteeEmail: clientEmail.trim() || undefined,
        inviteeName: clientName.trim() || undefined,
        role: clientRole as 'client_viewer' | 'client_collaborator',
      });
      setInviteUrl(result.inviteUrl);
      showCopiedToast();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not create invitation.');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!inviteUrl) return;
    const copied = await copyToClipboard(inviteUrl);
    if (copied) showCopiedToast();
  };

  const handleShareInvite = async () => {
    if (!inviteUrl) return;
    const result = await shareOrCopy({
      title: "You're invited to Arden Project OS",
      text: 'View your project workspace on Arden Project OS.',
      url: inviteUrl,
    });
    await handleShareResult(result);
  };

  const handleEmailProjectInvite = () => {
    if (!inviteUrl) return;
    const mailto = buildMailtoLink({
      to: clientEmail.trim() || undefined,
      subject: PROJECT_INVITE_EMAIL_SUBJECT,
      body: buildProjectInviteEmailBody({
        inviteeName: clientName,
        inviteUrl,
      }),
    });
    window.location.href = mailto;
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Share / Invite Client" size="lg">
        <div className="space-y-8 -mt-2">
          <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
            <div className="relative space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Share Arden Project OS</h3>
                <p className="mt-1 text-sm text-slate-300">
                  Invite someone to view Arden Project OS and create their own workspace.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 break-all">
                {appShareUrl || getAppShareOrigin()}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                  icon={<Copy className="h-4 w-4" />}
                  onClick={() => void handleCopyAppLink()}
                >
                  Copy app link
                </Button>
                <Button
                  type="button"
                  variant="accent"
                  icon={<Share2 className="h-4 w-4" />}
                  onClick={() => void handleShareApp()}
                >
                  Share app
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                  icon={<Mail className="h-4 w-4" />}
                  onClick={handleEmailAppInvite}
                >
                  Email invite
                </Button>
              </div>
            </div>
          </section>

          {isOwner ? (
            <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Invite client to project</h3>
                  <p className="mt-1 text-sm text-slate-300">
                    Send a secure invite link for a specific project workspace.
                  </p>
                </div>

                <Select
                  label="Project"
                  options={projectOptions}
                  value={projectId}
                  onChange={setProjectId}
                  fullWidth
                  className={authInputClassName}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Client name (optional)"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className={authInputClassName}
                    fullWidth
                  />
                  <Input
                    label="Client email (optional)"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className={authInputClassName}
                    fullWidth
                  />
                </div>

                <Select
                  label="Role"
                  options={PROJECT_CLIENT_ROLES.map((role) => ({
                    value: role.value,
                    label: role.label,
                  }))}
                  value={clientRole}
                  onChange={setClientRole}
                  fullWidth
                  className={authInputClassName}
                />

                {inviteUrl ? (
                  <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 break-all">
                    {inviteUrl}
                  </div>
                ) : null}

                {inviteError ? (
                  <p className="text-sm text-red-300" role="alert">
                    {inviteError}
                  </p>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    variant="accent"
                    isLoading={creatingInvite}
                    onClick={() => void handleGenerateInviteLink()}
                  >
                    Generate invite link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                    icon={<Copy className="h-4 w-4" />}
                    disabled={!inviteUrl}
                    onClick={() => void handleCopyInviteLink()}
                  >
                    Copy invite link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                    icon={<Share2 className="h-4 w-4" />}
                    disabled={!inviteUrl}
                    onClick={() => void handleShareInvite()}
                  >
                    Share invite
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                    icon={<Mail className="h-4 w-4" />}
                    disabled={!inviteUrl}
                    onClick={handleEmailProjectInvite}
                  >
                    Email invite
                  </Button>
                </div>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-sm text-slate-300">
                Project client invites are available to project owners. You can still share the app link above.
              </p>
            </section>
          )}
        </div>
      </Modal>
      <ShareToast message={toast} />
    </>
  );
}
