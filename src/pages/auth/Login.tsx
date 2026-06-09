import React from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';
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
      if (inviteToken && session.user) {
        const { acceptInviteForCurrentUser } = await import('../../services/employeeService');
        try {
          await acceptInviteForCurrentUser(inviteToken);
          await refreshProfile();
          navigate('/employee/dashboard', { replace: true });
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Could not accept invite';
          setError('root', {
            message: `Signed in, but invite could not be applied: ${msg}`,
          });
          return;
        }
      }
      navigate(returnTo && returnTo.startsWith('/') ? returnTo : '/', { replace: true });
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

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to your project workspace."
    >
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

      {!resetEmailSent && (
        <>
          <SocialLoginButtons
            appearance="auth-dark"
            disabled={isLoading}
            onError={(message) => setSocialLoginError(message)}
          />
          <AuthDivider label="or continue with email" />
        </>
      )}

      {resetEmailSent ? (
        <AuthAlert variant="success">
          If an account exists with {emailValue}, password reset instructions have been sent.
          Please check your email inbox.
        </AuthAlert>
      ) : (
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
            New to Concrete Calc?{' '}
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
      )}
    </AuthLayout>
  );
};

export default Login;
