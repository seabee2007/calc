import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus, Mail, Lock, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  acceptInviteForCurrentUser,
  fetchEmployeeInvitePreview,
} from '../../services/employeeService';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import UserAgreement from '../../components/legal/UserAgreement';
import backgroundImage from '../../assets/images/bkgrnd.jpg';

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

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    setError
  } = useForm<SignUpForm>({
    defaultValues: {
      agreeToTerms: false,
      email: '',
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [invitePreview, setInvitePreview] = useState<{
    email: string;
    role: string;
    expired: boolean;
  } | null>(null);
  const [inviteLoadError, setInviteLoadError] = useState<string | null>(null);

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
        message: 'Incorrect answer. Please try again.'
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

      navigate(
        inviteToken
          ? `/login?invite=${encodeURIComponent(inviteToken)}`
          : '/login',
        {
          state: {
            message: 'Account created successfully! Please sign in.',
            inviteToken: inviteToken ?? undefined,
          },
        },
      );
    } catch {
      setError('root', {
        message: 'Error creating account. Please try again.'
      });
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
          <Card className="mx-auto w-full max-w-md p-6 sm:p-8">
            <div className="mb-8 text-center">
              <UserPlus className="mx-auto h-12 w-12 text-blue-600 dark:text-blue-400" />

              <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
                Create your account
              </h2>

              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Or{' '}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    navigate(inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : '/login')
                  }
                  className="!inline !h-auto !p-0 !font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  sign in to existing account
                </Button>
              </p>
            </div>

            {invitePreview && !invitePreview.expired && (
              <div className="mb-6 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100">
                You&apos;re joining as <strong>{invitePreview.role.replace('_', ' ')}</strong>.
                Use <strong>{invitePreview.email}</strong> to accept this invite.
              </div>
            )}

            {inviteLoadError && (
              <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                {inviteLoadError}
              </div>
            )}

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

              <Input
                label="Confirm Password"
                type="password"
                icon={<Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />}
                error={errors.confirmPassword?.message}
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  validate: (val: string) => {
                    if (watch('password') !== val) {
                      return 'Passwords do not match';
                    }
                    return true;
                  }
                })}
                fullWidth
              />

              <div className="flex items-start">
                <div className="flex h-5 items-center">
                  <input
                    id="agreeToTerms"
                    type="checkbox"
                    {...register('agreeToTerms', {
                      required: 'You must agree to the User Agreement to continue'
                    })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                </div>

                <div className="ml-3">
                  <label htmlFor="agreeToTerms" className="text-sm text-gray-600 dark:text-gray-300">
                    I agree to the{' '}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowAgreement(true)}
                      className="!inline !h-auto !p-0 !font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      User Agreement
                    </Button>
                  </label>

                  {errors.agreeToTerms && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.agreeToTerms.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/30">
                <div className="mb-2 flex items-center">
                  <ShieldCheck className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />

                  <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200">
                    Human Verification
                  </h3>
                </div>

                <p className="mb-3 text-sm text-blue-700 dark:text-blue-300">
                  Please solve this simple math problem:
                </p>

                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg font-medium text-blue-900 dark:text-blue-200">
                    {num1} {operator} {num2} = ?
                  </span>
                </div>

                <Input
                  type="number"
                  label="Your answer"
                  error={errors.verificationAnswer?.message}
                  {...register('verificationAnswer', {
                    required: 'Please answer the verification question',
                    valueAsNumber: true
                  })}
                  fullWidth
                />
              </div>

              {errors.root && (
                <p className="text-center text-sm text-red-600 dark:text-red-400">
                  {errors.root.message}
                </p>
              )}

              <Button
                type="submit"
                fullWidth
                isLoading={isLoading}
                icon={<UserPlus size={18} />}
              >
                Create Account
              </Button>
            </form>
          </Card>
        </div>
      </div>

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
    </main>
  );
};

export default SignUp;