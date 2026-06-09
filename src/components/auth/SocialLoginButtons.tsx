import { useState } from 'react';
import Button from '../ui/Button';
import { signInWithProvider, type OAuthProvider } from '../../lib/oauthAuth';

interface SocialLoginButtonsProps {
  disabled?: boolean;
  onError?: (message: string) => void;
}

export default function SocialLoginButtons({
  disabled = false,
  onError,
}: SocialLoginButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);

  const handleProviderClick = async (provider: OAuthProvider) => {
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
        onClick={() => void handleProviderClick('github')}
      >
        Continue with GitHub
      </Button>
    </div>
  );
}
