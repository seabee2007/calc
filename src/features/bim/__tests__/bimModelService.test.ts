import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createModel } from '../services/bimModelService';

const insertMock = vi.fn();
const singleMock = vi.fn();

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: insertMock.mockReturnValue({
        select: vi.fn(() => ({
          single: singleMock,
        })),
      }),
    })),
  },
}));

describe('bimModelService.createModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a bim_models row and maps the response', async () => {
    singleMock.mockResolvedValue({
      data: {
        id: 'model-1',
        project_id: 'proj-1',
        estimate_id: 'est-1',
        uploaded_by: 'user-1',
        file_name: 'deck.glb',
        file_type: 'glb',
        original_file_name: 'deck.glb',
        original_file_type: 'glb',
        viewer_file_type: 'glb',
        storage_path: 'user-1/proj-1/model-1/123-deck.glb',
        file_size: 1024,
        status: 'ready',
        processing_status: 'ready',
        unsupported_reason: null,
        metadata: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    });

    const result = await createModel({
      projectId: 'proj-1',
      estimateId: 'est-1',
      uploadedBy: 'user-1',
      fileName: 'deck.glb',
      fileType: 'glb',
      originalFileName: 'deck.glb',
      originalFileType: 'glb',
      viewerFileType: 'glb',
      storagePath: 'user-1/proj-1/model-1/123-deck.glb',
      fileSize: 1024,
      status: 'ready',
      processingStatus: 'ready',
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe('model-1');
    expect(result.data?.fileName).toBe('deck.glb');
    expect(result.data?.viewerFileType).toBe('glb');
    expect(result.data?.processingStatus).toBe('ready');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        original_file_name: 'deck.glb',
        original_file_type: 'glb',
        viewer_file_type: 'glb',
        processing_status: 'ready',
      }),
    );
  });
});
