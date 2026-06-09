import React from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogIn, Mail, Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';
import backgroundImage from '../../assets/images/bkgrnd.jpg';

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
      navigate('/', { replace: true });
    } catch {
      setError('root', {
        message: 'Invalid email or password'
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
    } catch (error: any) {
      setResetError(error.message || 'Error sending password reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      className="relative min-h-[100dvh] overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-900"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <div className="pointer-events-none fixed inset-0 bg-black/40 dark:bg-black/60" />

      <div className="relative z-10 min-h-[100dvh] px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          icon={<ArrowLeft size={20} />}
          className="text-white hover:text-blue-200"
        >
          Back
        </Button>

        <div className="flex min-h-[calc(100dvh-4rem)] items-start justify-center py-6 lg:items-center">
          <Card className="mx-auto w-full max-w-md p-8">
          <div className="text-center mb-8">
            <LogIn className="mx-auto h-12 w-12 text-blue-600 dark:text-blue-400" />
            <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">Sign in to your account</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Or{' '}
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  navigate(
                    inviteToken
                      ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                      : '/signup',
                  )
                }
                className="!inline !h-auto !p-0 !font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                create a new account
              </Button>
            </p>
          </div>

          {inviteToken && (
            <div className="mb-6 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100">
              Sign in with the email address that received the team invite to join your company.
            </div>
          )}

          {loginMessage && (
            <div className="mb-6 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100">
              {loginMessage}
            </div>
          )}

          {(oauthError || socialLoginError) && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
              {socialLoginError ?? 'Social login failed. Please try again.'}
            </div>
          )}

          {!resetEmailSent && (
            <>
              <SocialLoginButtons
                disabled={isLoading}
                onError={(message) => setSocialLoginError(message)}
              />
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    Or continue with email
                  </span>
                </div>
              </div>
            </>
          )}

          {resetEmailSent ? (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md p-4 text-center">
              <p className="text-green-800 dark:text-green-200">
                If an account exists with {emailValue}, password reset instructions have been sent.
                Please check your email inbox.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <Input
                label="Email address"
                type="email"
                icon={<Mail className="h-5 w-5 text-gray-400 dark:text-gray-500" />}
                error={errors.email?.message}
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address'
                  }
                })}
                fullWidth
              />

              <div>
                <Input
                  label="Password"
                  type="password"
                  icon={<Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />}
                  error={errors.password?.message}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters'
                    }
                  })}
                  fullWidth
                />
                <div className="mt-2 flex flex-col space-y-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleForgotPassword}
                    className="!h-auto !p-0 text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Forgot your password?
                  </Button>
                  {resetError && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {resetError}
                    </p>
                  )}
                </div>
              </div>

              {errors.root && (
                <p className="text-sm text-red-600 dark:text-red-400 text-center">
                  {errors.root.message}
                </p>
              )}

              <Button
                type="submit"
                fullWidth
                isLoading={isLoading}
                icon={<LogIn size={18} />}
              >
                Sign in
              </Button>
            </form>
          )}
          </Card>
        </div>
      </div>
    </main>
  );
};

export default Login;