import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, LayoutDashboard } from 'lucide-react';
import AuthLayout, { AuthAlert, authLinkClassName, authPrimaryButtonClassName } from '../components/auth/AuthLayout';
import SocialLoginButtons from '../components/auth/SocialLoginButtons';
import Button from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import {
  acceptProjectInvitation,
  fetchProjectInvitationPreview,
  formatProjectInviteRole,
  storePendingProjectInviteToken,
} from '../services/projectInviteService';
import { AUTH_ACCENT } from '../components/auth/authBrandTheme';
import type { ProjectInvitationPreview } from '../types/projectInvite';

export default function ClientInvitePage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [preview, setPreview] = useState<ProjectInvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      if (!token) {
        setPreview(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await fetchProjectInvitationPreview(token);
        if (!active) return;
        setPreview(data);
      } catch {
        if (!active) return;
        setPreview(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPreview();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!user || !token || !preview || preview.status !== 'pending') return;

    let active = true;

    async function acceptInvite() {
      try {
        setAccepting(true);
        setError(null);
        const result = await acceptProjectInvitation(token);
        if (!active) return;
        navigate(`/projects/${result.projectId}/planner/hub`, { replace: true });
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not accept invitation.');
      } finally {
        if (active) setAccepting(false);
      }
    }

    void acceptInvite();
    return () => {
      active = false;
    };
  }, [navigate, preview, token, user]);

  const loginHref = `/login?returnTo=${encodeURIComponent(`/invite/${token}`)}`;
  const signupHref = `/signup?returnTo=${encodeURIComponent(`/invite/${token}`)}`;

  if (loading || authLoading) {
    return (
      <AuthLayout
        title="Loading invitation"
        subtitle="Please wait while we verify your invite."
      >
        <p className="text-sm text-slate-300">Checking invite details...</p>
      </AuthLayout>
    );
  }

  if (!preview || preview.status === 'revoked' || preview.status === 'accepted') {
    return (
      <AuthLayout
        title="Invitation unavailable"
        subtitle="This invitation is no longer active."
      >
        <Button
          type="button"
          fullWidth
          className={authPrimaryButtonClassName}
          onClick={() => navigate('/')}
        >
          Go to Concrete Calc
        </Button>
      </AuthLayout>
    );
  }

  if (preview.status === 'expired') {
    return (
      <AuthLayout
        title="Invitation expired"
        subtitle="This invitation is no longer active."
      >
        <Button
          type="button"
          fullWidth
          className={authPrimaryButtonClassName}
          onClick={() => navigate('/')}
        >
          Go to Concrete Calc
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="You've been invited to Concrete Calc"
      subtitle="Join a professional construction project workspace."
    >
      <div className={`${AUTH_ACCENT.authCard} space-y-5 !p-6 sm:!p-8`}>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${AUTH_ACCENT.brandLabel}`}>
            Project invitation
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {preview.projectName ?? 'Project workspace'}
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Role: {formatProjectInviteRole(preview.role)}
          </p>
          {preview.inviteeName ? (
            <p className="mt-1 text-sm text-slate-300">Invited: {preview.inviteeName}</p>
          ) : null}
          {preview.inviteeEmail ? (
            <p className="mt-1 text-sm text-slate-300">Email: {preview.inviteeEmail}</p>
          ) : null}
        </div>

        {error ? <AuthAlert variant="error">{error}</AuthAlert> : null}
        {socialError ? <AuthAlert variant="error">{socialError}</AuthAlert> : null}

        {user ? (
          <div className="space-y-3">
            <AuthAlert variant="info">
              Signed in as {user.email}. Accepting your invitation...
            </AuthAlert>
            <Button
              type="button"
              fullWidth
              isLoading={accepting}
              className={authPrimaryButtonClassName}
              icon={<LayoutDashboard className="h-5 w-5" />}
            >
              Opening project workspace
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <AuthAlert variant="info">
              Sign in or create an account to accept this project invitation.
            </AuthAlert>

            <SocialLoginButtons
              appearance="auth-dark"
              onBeforeSignIn={() => storePendingProjectInviteToken(token)}
              onError={(message) => setSocialError(message)}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                type="button"
                fullWidth
                className={authPrimaryButtonClassName}
                onClick={() => navigate(loginHref)}
              >
                Sign in
              </Button>
              <Button
                type="button"
                fullWidth
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                onClick={() => navigate(signupHref)}
              >
                Create account
              </Button>
            </div>

            <button
              type="button"
              className={`inline-flex items-center gap-1 text-sm ${authLinkClassName}`}
              onClick={() => navigate('/')}
            >
              Learn more about Concrete Calc
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
