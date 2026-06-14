import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  acceptInviteForCurrentUser,
  fetchEmployeeInvitePreview,
} from '../../services/employeeService';
import { supabase } from '../../lib/supabase';
import { setLoginIntent } from '../../lib/loginIntent';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';
import AuthLayout, {
  AuthAlert,
  AuthDivider,
  authInputClassName,
  authLinkClassName,
  authPrimaryButtonClassName,
} from '../../components/auth/AuthLayout';
import { AUTH_ACCENT } from '../../components/auth/authBrandTheme';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import UserAgreement from '../../components/legal/UserAgreement';

interface SignUpForm {
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
  verificationAnswer: number;
}

const SignUp: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const returnTo = searchParams.get('returnTo');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    setError,
  } = useForm<SignUpForm>({
    defaultValues: {
      agreeToTerms: false,
      email: '',
    },
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [invitePreview, setInvitePreview] = useState<{
    email: string;
    role: string;
    expired: boolean;
  } | null>(null);
  const [inviteLoadError, setInviteLoadError] = useState<string | null>(null);
  const [socialLoginError, setSocialLoginError] = useState<string | null>(null);

  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [operator, setOperator] = useState<'+' | '-' | 'x'>('x');

  useEffect(() => {
    generateVerificationQuestion();
  }, []);

  useEffect(() => {
    if (!inviteToken) return;
    void (async () => {
      try {
        const preview = await fetchEmployeeInvitePreview(inviteToken);
        if (!preview) {
          setInviteLoadError('This invite link is invalid or has already been used.');
          return;
        }
        if (preview.expired) {
          setInviteLoadError('This invite has expired. Ask your manager to send a new invite.');
          return;
        }
        setInvitePreview(preview);
        setValue('email', preview.email);
      } catch {
        setInviteLoadError('Could not load invite details. You can still sign up manually.');
      }
    })();
  }, [inviteToken, setValue]);

  const generateVerificationQuestion = () => {
    const operators: Array<'+' | '-' | 'x'> = ['+', '-', 'x'];
    const newOperator = operators[Math.floor(Math.random() * operators.length)];

    let n1: number;
    let n2: number;

    switch (newOperator) {
      case '+':
        n1 = Math.floor(Math.random() * 10) + 1;
        n2 = Math.floor(Math.random() * 10) + 1;
        break;
      case '-':
        n1 = Math.floor(Math.random() * 10) + 5;
        n2 = Math.floor(Math.random() * (n1 - 1)) + 1;
        break;
      case 'x':
        n1 = Math.floor(Math.random() * 5) + 1;
        n2 = Math.floor(Math.random() * 5) + 1;
        break;
      default:
        n1 = 1;
        n2 = 1;
    }

    setNum1(n1);
    setNum2(n2);
    setOperator(newOperator);
  };

  const getExpectedAnswer = (): number => {
    switch (operator) {
      case '+':
        return num1 + num2;
      case '-':
        return num1 - num2;
      case 'x':
        return num1 * num2;
      default:
        return 0;
    }
  };

  const onSubmit = async (data: SignUpForm) => {
    const expectedAnswer = getExpectedAnswer();

    if (data.verificationAnswer !== expectedAnswer) {
      setError('verificationAnswer', {
        type: 'manual',
        message: 'Incorrect answer. Please try again.',
      });
      generateVerificationQuestion();
      return;
    }

    try {
      setIsLoading(true);
      await signUp(data.email, data.password);

      const { data: sessionData } = await supabase.auth.getSession();
      if (inviteToken && sessionData.session?.user) {
        try {
          await acceptInviteForCurrentUser(inviteToken);
          navigate('/employee/dashboard', { replace: true });
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Could not accept invite';
          navigate(`/login?invite=${encodeURIComponent(inviteToken)}`, {
            state: { message: `Account created. Sign in to finish joining the team. ${msg}` },
          });
          return;
        }
      }

      const loginPath = inviteToken
        ? `/login?invite=${encodeURIComponent(inviteToken)}`
        : returnTo
          ? `/login?returnTo=${encodeURIComponent(returnTo)}`
          : '/login';

      navigate(loginPath, {
        state: {
          message: 'Account created successfully! Please sign in.',
          inviteToken: inviteToken ?? undefined,
        },
      });
    } catch {
      setError('root', {
        message: 'Error creating account. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AuthLayout
        title="Create your account"
        subtitle="Start building estimates, proposals, and schedules in one workspace."
      >
        {invitePreview && !invitePreview.expired && (
          <AuthAlert variant="info">
            You&apos;re joining as <strong>{invitePreview.role.replace('_', ' ')}</strong>. Use{' '}
            <strong>{invitePreview.email}</strong> to accept this invite.
          </AuthAlert>
        )}

        {inviteLoadError && <AuthAlert variant="warning">{inviteLoadError}</AuthAlert>}

        {socialLoginError && <AuthAlert variant="error">{socialLoginError}</AuthAlert>}

        <SocialLoginButtons
          appearance="auth-dark"
          disabled={isLoading}
          onError={(message) => setSocialLoginError(message)}
          onBeforeSignIn={() => {
            setLoginIntent(inviteToken ? 'field' : 'admin');
          }}
        />

        <AuthDivider label="or create an account with email" />

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

          <Input
            label="Confirm Password"
            type="password"
            icon={<Lock className="h-5 w-5 text-slate-400" />}
            error={errors.confirmPassword?.message}
            className={authInputClassName}
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: (val: string) => {
                if (watch('password') !== val) {
                  return 'Passwords do not match';
                }
                return true;
              },
            })}
            fullWidth
          />

          <div className="flex items-start">
            <div className="flex h-5 items-center">
              <input
                id="agreeToTerms"
                type="checkbox"
                {...register('agreeToTerms', {
                  required: 'You must agree to the User Agreement to continue',
                })}
                className={AUTH_ACCENT.checkbox}
              />
            </div>

            <div className="ml-3">
              <label htmlFor="agreeToTerms" className="text-sm text-slate-300">
                I agree to the{' '}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAgreement(true)}
                  className={`!inline !h-auto !p-0 hover:!bg-transparent ${authLinkClassName}`}
                >
                  User Agreement
                </Button>
              </label>

              {errors.agreeToTerms && (
                <p className="mt-1 text-sm text-red-300">{errors.agreeToTerms.message}</p>
              )}
            </div>
          </div>

          <div className={AUTH_ACCENT.verificationBox}>
            <div className="mb-2 flex items-center">
              <ShieldCheck className={AUTH_ACCENT.verificationIcon} />
              <h3 className={AUTH_ACCENT.verificationTitle}>Human Verification</h3>
            </div>

            <p className="mb-3 text-sm text-slate-300">
              Please solve this simple math problem:
            </p>

            <div className="mb-2 flex items-center gap-2">
              <span className="text-lg font-medium text-white">
                {num1} {operator} {num2} = ?
              </span>
            </div>

            <Input
              type="number"
              label="Your answer"
              error={errors.verificationAnswer?.message}
              className={authInputClassName}
              {...register('verificationAnswer', {
                required: 'Please answer the verification question',
                valueAsNumber: true,
              })}
              fullWidth
            />
          </div>

          {errors.root && <AuthAlert variant="error">{errors.root.message}</AuthAlert>}

          <Button
            type="submit"
            fullWidth
            isLoading={isLoading}
            className={authPrimaryButtonClassName}
          >
            Create Account
          </Button>

          <p className="text-center text-sm text-slate-300">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() =>
                navigate(inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : '/login')
              }
              className={authLinkClassName}
            >
              Sign in
            </button>
          </p>
        </form>
      </AuthLayout>

      <Modal
        isOpen={showAgreement}
        onClose={() => setShowAgreement(false)}
        title="User Agreement"
        size="lg"
      >
        <div className="max-h-[70dvh] overflow-y-auto overscroll-contain pr-1">
          <UserAgreement />
        </div>
      </Modal>
    </>
  );
};

export default SignUp;
