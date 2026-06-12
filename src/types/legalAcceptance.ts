export interface UserLegalAcceptance {
  id: string;
  userId: string;
  termsVersion: string;
  privacyVersion: string;
  termsAcceptedAt: string;
  privacyAcceptedAt: string;
  acceptedIp: string | null;
  acceptedUserAgent: string | null;
  createdAt: string;
}
