import React from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { Building2, HardHat, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { setLoginIntent, type LoginIntent } from '../../lib/loginIntent';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';
import { isEmployeeRole } from '../../types/fieldPlanner';
import {
  applyFieldEmployeeProfileLinking,
  loadAuthenticatedUserProfile,
  resolveFieldPortalLoginError,
} from './postAuthRouting';
import AuthLayout, {
  AuthAlert,
  AuthDivider,
  authInputClassName,
  authLinkClassName,
  authPrimaryButtonClassName,
} from '../../components/auth/AuthLayout';

interface LoginForm {
  email: string;
  password: string;
}

type LoginPath = 'admin' | 'field' | null;

export function resolvePostLoginDest(role: string | undefined, returnTo?: string): string {
  if (isEmployeeRole(role)) return '/employee/dashboard';
  if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) return returnTo;
  return '/';
}

const Login: React.FC = () => {
  const { signIn, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const inviteToken =
    (location.state as { inviteToken?: string } | null)?.inviteToken ??
    new URLSearchParams(location.search).get('invite') ??
    undefined;
  const returnTo = new URLSearchParams(location.search).get('returnTo') ?? undefined;
  const loginMessage = (location.state as { message?: string } | null)?.message;
  const oauthError = new URLSearchParams(location.search).get('error') === 'oauth';
  const [socialLoginError, setSocialLoginError] = React.useState<string | null>(null);
  const [loginPath, setLoginPath] = React.useState<LoginPath>(
    inviteToken ? 'field' : null,
  );
  const { register, handleSubmit, formState: { errors }, setError, watch } = useForm<LoginForm>();
  const [isLoading, setIsLoading] = React.useState(false);
  const [resetEmailSent, setResetEmailSent] = React.useState(false);
  const [resetError, setResetError] = React.useState<string | null>(null);

  const emailValue = watch('email');

  const onSubmit = async (data: LoginForm) => {
    try {
      setIsLoading(true);
      await signIn(data.email, data.password);
      const { data: session } = await supabase.auth.getUser();
      const loginIntent: LoginIntent | null =
        loginPath === 'field' ? 'field' : loginPath === 'admin' ? 'admin' : inviteToken ? 'field' : null;

      try {
        await applyFieldEmployeeProfileLinking({ inviteToken, loginIntent });
      } catch (linkErr) {
        if (inviteToken) {
          const msg = linkErr instanceof Error ? linkErr.message : 'Could not accept invite';
          setError('root', {
            message: `Signed in, but invite could not be applied: ${msg}`,
          });
          return;
        }
        console.warn('[Login] Field employee profile sync failed:', linkErr);
      }

      await refreshProfile();

      const profile = session.user
        ? await loadAuthenticatedUserProfile(loginIntent)
        : null;

      const fieldPortalError = resolveFieldPortalLoginError(profile, loginIntent);
      if (fieldPortalError) {
        setError('root', { message: fieldPortalError });
        return;
      }

      const dest = resolvePostLoginDest(profile?.role, returnTo);
      navigate(dest, { replace: true });
    } catch {
      setError('root', {
        message: 'Invalid email or password',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!emailValue) {
      setResetError('Please enter your email address first');
      return;
    }

    try {
      setIsLoading(true);
      setResetError(null);

      const origin = window.location.origin || `${window.location.protocol}//${window.location.host}`;

      const { error } = await supabase.auth.resetPasswordForEmail(emailValue, {
        redirectTo: `${origin}/reset-password`,
      });

      if (error) throw error;

      setResetEmailSent(true);
      setResetError(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error sending password reset email';
      setResetError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const subtitle =
    loginPath === 'field'
      ? 'Sign in to access the Field Portal and your assigned project work.'
      : loginPath === 'admin'
        ? 'Sign in to continue to your project workspace.'
        : 'Sign in to continue to your project workspace.';

  return (
    <AuthLayout title="Welcome back" subtitle={subtitle}>
      {/* Path selector — shown when no path chosen and no invite token */}
      {loginPath === null && !inviteToken && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2" data-testid="login-path-selector">
          <button
            type="button"
            onClick={() => setLoginPath('admin')}
            className="flex flex-col items-start gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-left hover:border-cyan-500/60 hover:bg-slate-800 transition-colors"
            data-testid="login-path-admin"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-700">
              <Building2 className="h-4 w-4 text-cyan-400" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-white">Company / Admin Login</span>
            <span className="text-xs leading-relaxed text-slate-400">
              For owners, project managers, estimators, and office staff.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setLoginPath('field')}
            className="flex flex-col items-start gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-left hover:border-cyan-500/60 hover:bg-slate-800 transition-colors"
            data-testid="login-path-field"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-700">
              <HardHat className="h-4 w-4 text-cyan-400" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-white">Field Portal Login</span>
            <span className="text-xs leading-relaxed text-slate-400">
              For field employees submitting photos, notes, RFIs, FARs, and task updates.
            </span>
          </button>
        </div>
      )}

      {loginPath === 'field' && !inviteToken && (
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLoginPath(null)}
            className="text-xs text-slate-400 hover:text-slate-200 underline"
          >
            ← Back
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 text-xs font-medium text-cyan-300">
            <HardHat className="h-3 w-3" aria-hidden />
            Field Portal
          </span>
        </div>
      )}

      {loginPath === 'admin' && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setLoginPath(null)}
            className="text-xs text-slate-400 hover:text-slate-200 underline"
          >
            ← Back
          </button>
        </div>
      )}

      {inviteToken && (
        <AuthAlert variant="info">
          Sign in with the email address that received the team invite to join your company.
        </AuthAlert>
      )}

      {loginMessage && <AuthAlert variant="success">{loginMessage}</AuthAlert>}

      {(oauthError || socialLoginError) && (
        <AuthAlert variant="error">
          {socialLoginError ?? 'Social login failed. Please try again.'}
        </AuthAlert>
      )}

      {/* Show the form only after a path is chosen (or when an invite token is present) */}
      {(loginPath !== null || inviteToken) && !resetEmailSent && (
        <>
          <SocialLoginButtons
            appearance="auth-dark"
            disabled={isLoading}
            onError={(message) => setSocialLoginError(message)}
            onBeforeSignIn={() => {
              if (loginPath === 'field' || inviteToken) {
                setLoginIntent('field');
              } else if (loginPath === 'admin') {
                setLoginIntent('admin');
              }
            }}
          />
          <AuthDivider label="or continue with email" />
        </>
      )}

      {resetEmailSent ? (
        <AuthAlert variant="success">
          If an account exists with {emailValue}, password reset instructions have been sent.
          Please check your email inbox.
        </AuthAlert>
      ) : (loginPath !== null || inviteToken) ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="auth-page-inputs space-y-6 [&_label]:text-slate-300"
        >
          <Input
            label="Email address"
            type="email"
            icon={<Mail className="h-5 w-5 text-slate-400" />}
            error={errors.email?.message}
            className={authInputClassName}
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address',
              },
            })}
            fullWidth
          />

          <div>
            <Input
              label="Password"
              type="password"
              icon={<Lock className="h-5 w-5 text-slate-400" />}
              error={errors.password?.message}
              className={authInputClassName}
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters',
                },
              })}
              fullWidth
            />
            <div className="mt-2 flex flex-col space-y-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleForgotPassword}
                className={`!h-auto !justify-start !p-0 hover:!bg-transparent ${authLinkClassName}`}
              >
                Forgot your password?
              </Button>
              {resetError && <p className="text-sm text-red-300">{resetError}</p>}
            </div>
          </div>

          {errors.root && (
            <AuthAlert variant="error">{errors.root.message}</AuthAlert>
          )}

          <Button
            type="submit"
            fullWidth
            isLoading={isLoading}
            className={authPrimaryButtonClassName}
          >
            Sign In
          </Button>

          <p className="text-center text-sm text-slate-300">
            New to Arden Project OS?{' '}
            <button
              type="button"
              onClick={() =>
                navigate(
                  inviteToken
                    ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                    : '/signup',
                )
              }
              className={authLinkClassName}
            >
              Create an account
            </button>
          </p>
        </form>
      ) : null}
    </AuthLayout>
  );
};

export default Login;
