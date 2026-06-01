import type { DocumentPack } from '../../types';

/**
 * State-specific legal packs (CA, FL, NY, TX, GA, GU, ...) land here in a
 * later phase. Each will carry locked statutory notice blocks and its own
 * attorney-review status. Empty during Phase 0.1.
 */
export const statePacks: DocumentPack[] = [];
