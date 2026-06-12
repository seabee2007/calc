import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useLegalAcceptance } from './useLegalAcceptance';

const authUser = vi.hoisted(() => ({
  id: 'user-123',
  email: 'user@example.com',
}));

const serviceMock = vi.hoisted(() => ({
  getCurrentLegalAcceptance: vi.fn(),
  getLatestLegalAcceptance: vi.fn(),
  acceptCurrentLegalDocuments: vi.fn(),
  readLegalAcceptanceSessionCache: vi.fn(),
  clearLegalAcceptanceSessionCache: vi.fn(),
  isJwtIssuedAtFutureError: vi.fn(),
}));

vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: authUser }),
}));

vi.mock('../services/legalAcceptanceService', () => ({
  getCurrentLegalAcceptance: (...args: unknown[]) => serviceMock.getCurrentLegalAcceptance(...args),
  getLatestLegalAcceptance: (...args: unknown[]) => serviceMock.getLatestLegalAcceptance(...args),
  acceptCurrentLegalDocuments: (...args: unknown[]) => serviceMock.acceptCurrentLegalDocuments(...args),
  readLegalAcceptanceSessionCache: (...args: unknown[]) => serviceMock.readLegalAcceptanceSessionCache(...args),
  clearLegalAcceptanceSessionCache: (...args: unknown[]) => serviceMock.clearLegalAcceptanceSessionCache(...args),
  isJwtIssuedAtFutureError: (...args: unknown[]) => serviceMock.isJwtIssuedAtFutureError(...args),
}));

describe('useLegalAcceptance', () => {
  beforeEach(() => {
    serviceMock.getCurrentLegalAcceptance.mockReset();
    serviceMock.getLatestLegalAcceptance.mockReset();
    serviceMock.acceptCurrentLegalDocuments.mockReset();
    serviceMock.readLegalAcceptanceSessionCache.mockReturnValue(false);
    serviceMock.clearLegalAcceptanceSessionCache.mockReset();
    serviceMock.isJwtIssuedAtFutureError.mockImplementation((error: unknown) =>
      error instanceof Error && error.message.includes('JWT issued at future'),
    );
  });

  it('reports not accepted when user has no current acceptance row', async () => {
    serviceMock.getCurrentLegalAcceptance.mockResolvedValue(null);
    serviceMock.getLatestLegalAcceptance.mockResolvedValue(null);

    const { result } = renderHook(() => useLegalAcceptance());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasAcceptedCurrentLegal).toBe(false);
    expect(result.current.latestAcceptance).toBeNull();
  });

  it('reports accepted when current versions are on file', async () => {
    const acceptance = {
      id: 'acc-1',
      userId: authUser.id,
      termsVersion: '2026-06-12',
      privacyVersion: '2026-06-12',
      termsAcceptedAt: '2026-06-12T10:00:00.000Z',
      privacyAcceptedAt: '2026-06-12T10:00:00.000Z',
      acceptedIp: null,
      acceptedUserAgent: 'vitest',
      createdAt: '2026-06-12T10:00:00.000Z',
    };

    serviceMock.getCurrentLegalAcceptance.mockResolvedValue(acceptance);
    serviceMock.getLatestLegalAcceptance.mockResolvedValue(acceptance);

    const { result } = renderHook(() => useLegalAcceptance());

    await waitFor(() => {
      expect(result.current.hasAcceptedCurrentLegal).toBe(true);
    });

    expect(result.current.latestAcceptance).toEqual(acceptance);
  });

  it('acceptLegalDocuments updates accepted state', async () => {
    serviceMock.getCurrentLegalAcceptance.mockResolvedValue(null);
    serviceMock.getLatestLegalAcceptance.mockResolvedValue(null);

    const accepted = {
      id: 'acc-2',
      userId: authUser.id,
      termsVersion: '2026-06-12',
      privacyVersion: '2026-06-12',
      termsAcceptedAt: '2026-06-12T11:00:00.000Z',
      privacyAcceptedAt: '2026-06-12T11:00:00.000Z',
      acceptedIp: null,
      acceptedUserAgent: 'vitest',
      createdAt: '2026-06-12T11:00:00.000Z',
    };

    serviceMock.acceptCurrentLegalDocuments.mockResolvedValue(accepted);

    const { result } = renderHook(() => useLegalAcceptance());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.acceptLegalDocuments();
    });

    expect(result.current.hasAcceptedCurrentLegal).toBe(true);
    expect(result.current.latestAcceptance).toEqual(accepted);
    expect(result.current.isAccepting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('accept after duplicate conflict sets hasAcceptedCurrentLegal true', async () => {
    serviceMock.getCurrentLegalAcceptance.mockResolvedValue(null);
    serviceMock.getLatestLegalAcceptance.mockResolvedValue(null);

    const existing = {
      id: 'acc-dup',
      userId: authUser.id,
      termsVersion: '2026-06-12',
      privacyVersion: '2026-06-12',
      termsAcceptedAt: '2026-06-12T10:00:00.000Z',
      privacyAcceptedAt: '2026-06-12T10:00:00.000Z',
      acceptedIp: null,
      acceptedUserAgent: 'vitest',
      createdAt: '2026-06-12T10:00:00.000Z',
    };

    serviceMock.acceptCurrentLegalDocuments.mockResolvedValue(existing);

    const { result } = renderHook(() => useLegalAcceptance());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.acceptLegalDocuments();
    });

    expect(result.current.hasAcceptedCurrentLegal).toBe(true);
    expect(result.current.latestAcceptance).toEqual(existing);
  });

  it('repeated JWT issued at future exposes session error state', async () => {
    serviceMock.getCurrentLegalAcceptance.mockRejectedValue(new Error('JWT issued at future'));
    serviceMock.getLatestLegalAcceptance.mockResolvedValue(null);

    const { result } = renderHook(() => useLegalAcceptance());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isSessionError).toBe(true);
    expect(result.current.error).toContain('JWT issued at future');
    expect(result.current.hasAcceptedCurrentLegal).toBe(false);
  });
});
