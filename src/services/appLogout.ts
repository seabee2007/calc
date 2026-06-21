import { clearPersistedAppAccessState } from '../lib/appAccessPersistence';
import { clearResolvedAppAccess } from '../lib/appAccessReset';

export async function logoutAndRedirect(
  signOut: () => Promise<void>,
  navigate: (path: string, options?: { replace?: boolean }) => void,
): Promise<void> {
  clearResolvedAppAccess();
  await signOut();
  clearPersistedAppAccessState();
  clearResolvedAppAccess();
  navigate('/login', { replace: true });
}
