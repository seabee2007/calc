import { useState } from 'react';
import Button from '../ui/Button';
import { signInWithProvider, type OAuthProvider } from '../../lib/oauthAuth';
import { AUTH_ACCENT } from './authBrandTheme';

interface SocialLoginButtonsProps {
  disabled?: boolean;
  onError?: (message: string) => void;
  appearance?: 'default' | 'auth-dark';
  /** Return false to cancel the sign-in (e.g. agreement not accepted). */
  onBeforeSignIn?: () => boolean | void;
}

export default function SocialLoginButtons({
  disabled = false,
  onError,
  appearance = 'default',
  onBeforeSignIn,
}: SocialLoginButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);
  const buttonClassName = appearance === 'auth-dark' ? AUTH_ACCENT.socialButtonDark : undefined;

  const handleProviderClick = async (provider: OAuthProvider) => {
    const proceed = onBeforeSignIn?.();
    if (proceed === false) return;
    try {
      setLoadingProvider(provider);
      await signInWithProvider(provider);
    } catch {
      onError?.('Social login failed. Please try again.');
      setLoadingProvider(null);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="secondary"
        fullWidth
        disabled={disabled || loadingProvider !== null}
        isLoading={loadingProvider === 'google'}
        className={buttonClassName}
        onClick={() => void handleProviderClick('google')}
      >
        Continue with Google
      </Button>
      <Button
        type="button"
        variant="secondary"
        fullWidth
        disabled={disabled || loadingProvider !== null}
        isLoading={loadingProvider === 'github'}
        className={buttonClassName}
        onClick={() => void handleProviderClick('github')}
      >
        Continue with GitHub
      </Button>
    </div>
  );
}
