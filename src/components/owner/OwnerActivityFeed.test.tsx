import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OwnerActivityFeed, {
  DEFAULT_VISIBLE_ACTIVITY_COUNT,
} from './OwnerActivityFeed';
import type { FieldActivityItem } from '../../types/fieldPlanner';

const mockNavigate = vi.fn();

const { mockGetOwnerFieldActivity, fieldActivityStoreState, mockAuthUser } = vi.hoisted(() => ({
  mockGetOwnerFieldActivity: vi.fn(),
  mockAuthUser: { id: 'owner-1' },
  fieldActivityStoreState: {
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
    dismissedByOwner: {} as Record<string, string[]>,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag) =>
        function MotionStub({
          children,
          ...props
        }: React.PropsWithChildren<Record<string, unknown>>) {
          return React.createElement(String(tag), props, children);
        },
    },
  ),
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

vi.mock('../../services/fieldActivityService', () => ({
  getOwnerFieldActivity: mockGetOwnerFieldActivity,
}));

vi.mock('../../store/fieldActivityDismissStore', () => ({
  useFieldActivityDismissStore: (
    selector: (state: typeof fieldActivityStoreState) => unknown,
  ) => selector(fieldActivityStoreState),
}));

vi.mock('../../utils/plannerRecordsRefresh', () => ({
  subscribePlannerRecordsChanged: () => () => undefined,
}));

function buildItems(count: number): FieldActivityItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    type: 'comment',
    projectId: 'p1',
    projectName: 'Project Alpha',
    employeeName: 'Alex',
    summary: `Activity ${index}`,
    timestamp: new Date(Date.UTC(2026, 0, count - index)).toISOString(),
    status: 'New',
    href: '/planner/hub',
  }));
}

describe('OwnerActivityFeed', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetOwnerFieldActivity.mockReset();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width: 639px') ? false : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it('shows only the most recent activity rows by default', async () => {
    mockGetOwnerFieldActivity.mockResolvedValue(buildItems(8));

    render(
      <MemoryRouter>
        <OwnerActivityFeed />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Activity 0')).toBeInTheDocument();
      expect(screen.getByText('Activity 4')).toBeInTheDocument();
    });
    expect(screen.queryByText('Activity 5')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all' })).toBeInTheDocument();
  });

  it('expands and collapses the in-place activity list', async () => {
    mockGetOwnerFieldActivity.mockResolvedValue(buildItems(8));

    render(
      <MemoryRouter>
        <OwnerActivityFeed />
      </MemoryRouter>,
    );

    await screen.findByText('Activity 0');

    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(screen.getByText('Activity 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();

    const list = document.querySelector('ul');
    expect(list).toHaveClass('max-h-[520px]', 'overflow-y-auto');

    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.queryByText('Activity 5')).not.toBeInTheDocument();
  });

  it('keeps View all navigation to the owner review page', async () => {
    mockGetOwnerFieldActivity.mockResolvedValue(buildItems(2));

    render(
      <MemoryRouter>
        <OwnerActivityFeed />
      </MemoryRouter>,
    );

    await screen.findByText('Activity 0');
    fireEvent.click(screen.getByRole('button', { name: 'View all →' }));
    expect(mockNavigate).toHaveBeenCalledWith('/owner/review');
  });

  it('shows three items on small screens by default', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width: 639px'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    mockGetOwnerFieldActivity.mockResolvedValue(buildItems(6));

    render(
      <MemoryRouter>
        <OwnerActivityFeed />
      </MemoryRouter>,
    );

    await screen.findByText('Activity 0');
    expect(screen.getByText('Activity 2')).toBeInTheDocument();
    expect(screen.queryByText('Activity 3')).not.toBeInTheDocument();
    expect(DEFAULT_VISIBLE_ACTIVITY_COUNT).toBe(5);
  });
});
