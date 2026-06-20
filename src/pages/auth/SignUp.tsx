import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Phone, ShieldCheck, User } from 'lucide-react';
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
import { US_STATE_SELECT_OPTIONS } from '../../constants/usStatesTerritories';
import {
  signupSchema,
  type SignUpFormData,
  formatUsPhone,
  normalizeUsPhone,
} from './signupSchema';

// ── Auth-themed <select> matching input styling ───────────────────────────────

const authSelectClassName =
  `w-full appearance-none rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 ` +
  `text-slate-100 shadow-none focus:border-cyan-400 focus:outline-none focus:ring-1 ` +
  `focus:ring-cyan-400/30 disabled:opacity-50`;

// ── Section label used above address block ────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </p>
  );
}

// ── Field error helper ────────────────────────────────────────────────────────
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-xs text-red-300" role="alert">
      {message}
    </p>
  );
}

// ── Label used on raw <select> / custom blocks ────────────────────────────────
function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-sm font-medium text-slate-300"
    >
      {children}
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
    trigger,
    control,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onTouched',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      businessAddress: {
        street: '',
        street2: '',
        city: '',
        state: '',
        postalCode: '',
      },
      password: '',
      confirmPassword: '',
    },
  });

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
        if (preview.revoked) {
          setInviteLoadError(
            'This invitation has been revoked. Contact the company administrator for a new invitation.',
          );
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
    const ops: Array<'+' | '-' | 'x'> = ['+', '-', 'x'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let n1: number, n2: number;
    switch (op) {
      case '+':
        n1 = Math.floor(Math.random() * 10) + 1;
        n2 = Math.floor(Math.random() * 10) + 1;
        break;
      case '-':
        n1 = Math.floor(Math.random() * 10) + 5;
        n2 = Math.floor(Math.random() * (n1 - 1)) + 1;
        break;
      default:
        n1 = Math.floor(Math.random() * 5) + 1;
        n2 = Math.floor(Math.random() * 5) + 1;
    }
    setNum1(n1);
    setNum2(n2);
    setOperator(op);
  };

  const getExpectedAnswer = () => {
    if (operator === '+') return num1 + num2;
    if (operator === '-') return num1 - num2;
    return num1 * num2;
  };

  const onSubmit = async (data: SignUpFormData) => {
    if (data.verificationAnswer !== getExpectedAnswer()) {
      setError('verificationAnswer', {
        type: 'manual',
        message: 'Incorrect answer. Please try again.',
      });
      generateVerificationQuestion();
      setValue('verificationAnswer', undefined);
      return;
    }

    const addr = data.businessAddress;
    const hasAddress = [addr.street, addr.city, addr.state, addr.postalCode].some((f) =>
      f.trim(),
    );

    try {
      await signUp(data.email.trim().toLowerCase(), data.password, {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        phone: normalizeUsPhone(data.phone) ?? undefined,
        businessAddress: hasAddress
          ? {
              street: addr.street.trim(),
              street2: addr.street2.trim() || undefined,
              city: addr.city.trim(),
              state: addr.state.trim(),
              postalCode: addr.postalCode.trim(),
            }
          : undefined,
        acceptedAgreement: true,
      });

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
      setError('root', { message: 'Error creating account. Please try again.' });
    }
  };

  const agreeToTerms = watch('agreeToTerms');

  const handleSocialBeforeSignIn = (): boolean => {
    if (!agreeToTerms) {
      void trigger('agreeToTerms');
      setSocialLoginError(
        'You must accept the User Agreement and Privacy Policy before creating an account.',
      );
      return false;
    }
    setSocialLoginError(null);
    setLoginIntent(inviteToken ? 'field' : 'admin');
    return true;
  };

  const addrErrors = errors.businessAddress as
    | { street?: { message?: string }; street2?: { message?: string }; city?: { message?: string }; state?: { message?: string }; postalCode?: { message?: string } }
    | undefined;

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

        {/* Owner vs employee callout — only show when not on an invite */}
        {!inviteToken && (
          <p className="mb-2 text-center text-xs text-slate-400">
            Creating a company account? Sign up here.{' '}
            <span className="text-slate-500">
              Joining a team? Use the invite link from your company.
            </span>
          </p>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="auth-page-inputs space-y-5 [&_label]:text-slate-300"
        >
          {/* ── Agreement (must be accepted before OAuth or email submit) ── */}
          <div>
            <div className="flex items-start">
              <div className="flex h-5 items-center">
                <input
                  id="agreeToTerms"
                  type="checkbox"
                  {...register('agreeToTerms')}
                  className={AUTH_ACCENT.checkbox}
                />
              </div>
              <div className="ml-3">
                <label htmlFor="agreeToTerms" className="text-sm text-slate-300">
                  I agree to the{' '}
                  <Link
                    to="/terms"
                    target="_blank"
                    rel="noreferrer"
                    className={`${authLinkClassName} underline-offset-4 hover:underline`}
                  >
                    User Agreement
                  </Link>{' '}
                  and{' '}
                  <Link
                    to="/privacy-policy"
                    target="_blank"
                    rel="noreferrer"
                    className={`${authLinkClassName} underline-offset-4 hover:underline`}
                  >
                    Privacy Policy
                  </Link>
                </label>
                {errors.agreeToTerms && (
                  <p className="mt-1 text-sm text-red-300" role="alert">
                    {errors.agreeToTerms.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── OAuth (inside form so checkbox is in scope) ── */}
          {socialLoginError && <AuthAlert variant="error">{socialLoginError}</AuthAlert>}

          <SocialLoginButtons
            appearance="auth-dark"
            disabled={isSubmitting}
            onError={(message) => setSocialLoginError(message)}
            onBeforeSignIn={handleSocialBeforeSignIn}
          />

          <AuthDivider label="or create an account with email" />

          {/* ── Name + Phone + Email ── */}
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            <Input
              label="First name *"
              type="text"
              autoComplete="given-name"
              icon={<User className="h-5 w-5 text-slate-400" />}
              error={errors.firstName?.message}
              className={authInputClassName}
              placeholder="Bob"
              {...register('firstName')}
              fullWidth
            />
            <Input
              label="Last name *"
              type="text"
              autoComplete="family-name"
              icon={<User className="h-5 w-5 text-slate-400" />}
              error={errors.lastName?.message}
              className={authInputClassName}
              placeholder="Smith"
              {...register('lastName')}
              fullWidth
            />

            {/* Phone — live US mask */}
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <Input
                  label="Phone (optional)"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  icon={<Phone className="h-5 w-5 text-slate-400" />}
                  error={errors.phone?.message}
                  className={authInputClassName}
                  placeholder="(555) 123-4567"
                  maxLength={14}
                  value={field.value}
                  onChange={(e) => field.onChange(formatUsPhone(e.target.value))}
                  onBlur={() => { field.onBlur(); void trigger('phone'); }}
                  ref={field.ref}
                  fullWidth
                />
              )}
            />

            <Input
              label="Email address *"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              className={authInputClassName}
              placeholder="you@company.com"
              {...register('email')}
              fullWidth
            />
          </div>

          {/* ── Business address (optional, structured) ── */}
          <div className="space-y-3 rounded-xl border border-white/8 bg-white/[0.03] p-4">
            <SectionLabel>Business address (optional)</SectionLabel>

            {/* Street full width */}
            <div className="sm:col-span-2">
              <Input
                id="ba-street"
                label="Street address"
                type="text"
                autoComplete="address-line1"
                error={addrErrors?.street?.message}
                className={authInputClassName}
                placeholder="123 Main St"
                {...register('businessAddress.street')}
                fullWidth
              />
            </div>

            {/* Address line 2 full width */}
            <div className="sm:col-span-2">
              <Input
                id="ba-street2"
                label="Address line 2 (optional)"
                type="text"
                autoComplete="address-line2"
                error={addrErrors?.street2?.message}
                className={authInputClassName}
                placeholder="Suite 200"
                {...register('businessAddress.street2')}
                fullWidth
              />
            </div>

            {/* City | State */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <Input
                id="ba-city"
                label="City"
                type="text"
                autoComplete="address-level2"
                error={addrErrors?.city?.message}
                className={authInputClassName}
                placeholder="San Diego"
                {...register('businessAddress.city')}
                fullWidth
              />

              <div>
                <FieldLabel htmlFor="ba-state">State / territory</FieldLabel>
                <Controller
                  name="businessAddress.state"
                  control={control}
                  render={({ field }) => (
                    <select
                      id="ba-state"
                      {...field}
                      className={authSelectClassName}
                      autoComplete="address-level1"
                    >
                      <option value="">Select state…</option>
                      {US_STATE_SELECT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                />
                <FieldError message={addrErrors?.state?.message} />
              </div>
            </div>

            {/* ZIP | Country */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <Input
                id="ba-zip"
                label="ZIP / Postal code"
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                error={addrErrors?.postalCode?.message}
                className={authInputClassName}
                placeholder="92101"
                maxLength={10}
                {...register('businessAddress.postalCode')}
                fullWidth
              />

              <div>
                <FieldLabel>Country</FieldLabel>
                <input
                  type="text"
                  value="United States"
                  disabled
                  className={`${authSelectClassName} cursor-not-allowed opacity-50`}
                />
              </div>
            </div>
          </div>

          {/* ── Password ── */}
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            <Input
              id="signup-password"
              label="Password *"
              type="password"
              autoComplete="new-password"
              icon={<Lock className="h-5 w-5 text-slate-400" />}
              error={errors.password?.message}
              className={authInputClassName}
              {...register('password')}
              fullWidth
            />
            <Input
              id="signup-confirm-password"
              label="Confirm password *"
              type="password"
              autoComplete="new-password"
              icon={<Lock className="h-5 w-5 text-slate-400" />}
              error={errors.confirmPassword?.message}
              className={authInputClassName}
              {...register('confirmPassword')}
              fullWidth
            />
          </div>

          {/* ── Human verification ── */}
          <div className={AUTH_ACCENT.verificationBox}>
            <div className="mb-2 flex items-center">
              <ShieldCheck className={AUTH_ACCENT.verificationIcon} />
              <h3 className={AUTH_ACCENT.verificationTitle}>Human Verification</h3>
            </div>
            <p className="mb-3 text-sm text-slate-300">Please solve this simple math problem:</p>
            <div className="mb-2">
              <span className="text-lg font-medium text-white">
                {num1} {operator} {num2} = ?
              </span>
            </div>
            <Input
              type="number"
              label="Your answer"
              error={errors.verificationAnswer?.message}
              className={authInputClassName}
              {...register('verificationAnswer', { valueAsNumber: true })}
              fullWidth
            />
          </div>

          {errors.root && <AuthAlert variant="error">{errors.root.message}</AuthAlert>}

          <Button
            type="submit"
            fullWidth
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className={authPrimaryButtonClassName}
          >
            {isSubmitting ? 'Creating account…' : 'Create Account'}
          </Button>

          <p className="text-center text-sm text-slate-300">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() =>
                navigate(
                  inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : '/login',
                )
              }
              className={authLinkClassName}
            >
              Sign in
            </button>
          </p>
        </form>
      </AuthLayout>

      {/* Legacy modal kept in case UserAgreement is referenced elsewhere — but link now goes to /terms */}
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
