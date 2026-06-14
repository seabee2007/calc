import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { updateProfile, CURRENT_AGREEMENT_VERSION } from '../../services/profileService';
import AuthLayout, {
  AuthAlert,
  authInputClassName,
  authLinkClassName,
  authPrimaryButtonClassName,
} from '../../components/auth/AuthLayout';
import { AUTH_ACCENT } from '../../components/auth/authBrandTheme';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import UserAgreement from '../../components/legal/UserAgreement';
import { resolvePostLoginDest } from './Login';

interface CompleteProfileForm {
  firstName: string;
  lastName: string;
  agreeToTerms: boolean;
}

export default function ProfileCompletePage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<CompleteProfileForm>({
    defaultValues: {
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      agreeToTerms: Boolean(profile?.agreementAcceptedAt),
    },
  });

  const onSubmit = async (data: CompleteProfileForm) => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      setIsLoading(true);

      const alreadyAccepted = Boolean(profile?.agreementAcceptedAt);
      await updateProfile(user.id, {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        acceptedAgreement: data.agreeToTerms && !alreadyAccepted ? true : undefined,
      });

      await refreshProfile();

      const dest = resolvePostLoginDest(profile?.role);
      navigate(dest, { replace: true });
    } catch {
      setError('root', { message: 'Could not save your profile. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const alreadyAccepted = Boolean(profile?.agreementAcceptedAt);

  return (
    <>
      <AuthLayout
        title="Complete your profile"
        subtitle="Just a couple more details before you get started."
      >
        <AuthAlert variant="info">
          Please provide your name to finish setting up your account.
        </AuthAlert>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="auth-page-inputs mt-6 space-y-5 [&_label]:text-slate-300"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              type="text"
              icon={<User className="h-5 w-5 text-slate-400" />}
              error={errors.firstName?.message}
              className={authInputClassName}
              placeholder="Bob"
              {...register('firstName', { required: 'First name is required' })}
              fullWidth
            />
            <Input
              label="Last name"
              type="text"
              icon={<User className="h-5 w-5 text-slate-400" />}
              error={errors.lastName?.message}
              className={authInputClassName}
              placeholder="Smith"
              {...register('lastName', { required: 'Last name is required' })}
              fullWidth
            />
          </div>

          {!alreadyAccepted && (
            <div className="flex items-start">
              <div className="flex h-5 items-center">
                <input
                  id="agreeToTermsComplete"
                  type="checkbox"
                  {...register('agreeToTerms', {
                    required: 'You must agree to the User Agreement to continue',
                  })}
                  className={AUTH_ACCENT.checkbox}
                />
              </div>
              <div className="ml-3">
                <label htmlFor="agreeToTermsComplete" className="text-sm text-slate-300">
                  I agree to the{' '}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAgreement(true)}
                    className={`!inline !h-auto !p-0 hover:!bg-transparent ${authLinkClassName}`}
                  >
                    User Agreement
                  </Button>{' '}
                  and{' '}
                  <a
                    href="/privacy-policy"
                    target="_blank"
                    rel="noreferrer"
                    className={authLinkClassName}
                  >
                    Privacy Policy
                  </a>
                </label>
                {errors.agreeToTerms && (
                  <p className="mt-1 text-sm text-red-300">{errors.agreeToTerms.message}</p>
                )}
              </div>
            </div>
          )}

          {alreadyAccepted && (
            <p className="text-xs text-slate-400">
              Agreement accepted on{' '}
              {new Date(profile!.agreementAcceptedAt!).toLocaleDateString()} (v
              {profile?.agreementVersion ?? CURRENT_AGREEMENT_VERSION}).
            </p>
          )}

          {errors.root && <AuthAlert variant="error">{errors.root.message}</AuthAlert>}

          <Button
            type="submit"
            fullWidth
            isLoading={isLoading}
            className={authPrimaryButtonClassName}
          >
            Save &amp; Continue
          </Button>
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
}
