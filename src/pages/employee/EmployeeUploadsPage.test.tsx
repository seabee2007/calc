import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmployeeUploadsPage from './EmployeeUploadsPage';

const mockUpload = vi.fn();
const mockAddRecord = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'field@example.com' } }),
}));

vi.mock('../../services/plannerService', () => ({
  fetchTasksForEmployee: vi.fn().mockResolvedValue([
    {
      id: 'task-1',
      projectId: 'proj-1',
      title: 'plan',
      status: 'In Progress',
    },
  ]),
}));

vi.mock('../../services/storageService', () => ({
  uploadFieldAttachment: (...args: unknown[]) => mockUpload(...args),
}));

vi.mock('../../services/taskActivityService', () => ({
  addTaskAttachmentRecord: (...args: unknown[]) => mockAddRecord(...args),
}));

describe('EmployeeUploadsPage upload feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:preview-1');
    URL.revokeObjectURL = vi.fn();
    mockUpload.mockResolvedValue({
      publicUrl: 'https://example.com/photo.jpg',
      path: 'user/proj/task/photo.jpg',
      fileName: 'photo.jpg',
    });
    mockAddRecord.mockResolvedValue(undefined);
  });

  it('shows strong success feedback after upload', async () => {
    const user = userEvent.setup();
    render(<EmployeeUploadsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Photos attach to/i)).toBeInTheDocument();
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getAllByText('Photo uploaded successfully').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('Attached to: plan')).toBeInTheDocument();
    expect(screen.getAllByText('✅ 1 photo uploaded').length).toBeGreaterThan(0);
    expect(mockUpload).toHaveBeenCalled();
    expect(mockAddRecord).toHaveBeenCalled();
  });

  it('shows error feedback when upload fails', async () => {
    mockUpload.mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();
    render(<EmployeeUploadsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Photos attach to/i)).toBeInTheDocument();
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getAllByText('Photo upload failed').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('Network error').length).toBeGreaterThan(0);
  });
});
