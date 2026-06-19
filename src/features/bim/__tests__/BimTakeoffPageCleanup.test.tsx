import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BimTakeoffPage from '../ui/BimTakeoffPage';

const deleteModelMock = vi.fn();
const setActiveModelIdMock = vi.fn();

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../../estimating/ui/EstimateWorkspaceHeaderCollapseContext', () => ({
  useEstimateWorkspaceHeaderCollapse: () => null,
}));

vi.mock('../../estimating/ui/hooks/useProjectLaborRates', () => ({
  useProjectLaborRates: () => ({
    projectRates: [],
    ensureProjectLaborRatesReady: vi.fn(),
  }),
}));

vi.mock('../ui/components/BimViewer', () => ({
  default: ({ onCalibrationSampleChange }: { onCalibrationSampleChange?: (sample: unknown) => void }) => (
    <div data-testid="mock-bim-viewer">
      Viewer
      <button
        type="button"
        onClick={() =>
          onCalibrationSampleChange?.({
            points: [
              { x: 0, y: 0, z: 0 },
              { x: 6, y: 0, z: 0 },
            ],
            rawDistance: 6,
          })
        }
      >
        Pick calibration points
      </button>
    </div>
  ),
}));

vi.mock('../ui/hooks/useBimModels', () => ({
  useBimModels: () => ({
    models: [
      {
        id: 'model-glb',
        projectId: 'project-1',
        estimateId: 'estimate-1',
        uploadedBy: 'user-1',
        fileName: 'house.glb',
        fileType: 'glb',
        storagePath: 'user/project/model/house.glb',
        fileSize: 1,
        status: 'uploaded',
        metadata: {},
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'model-gltf',
        projectId: 'project-1',
        estimateId: 'estimate-1',
        uploadedBy: 'user-1',
        fileName: 'scene.gltf',
        fileType: 'gltf',
        storagePath: 'user/project/model/scene.gltf',
        fileSize: 1,
        status: 'uploaded',
        metadata: {},
        createdAt: '',
        updatedAt: '',
      },
    ],
    activeModelId: 'model-glb',
    setActiveModelId: setActiveModelIdMock,
    activeModel: null,
    objectIdByExternal: new Map(),
    objects: [],
    signedUrl: null,
    uploading: false,
    loading: false,
    error: null,
    selected: null,
    setSelected: vi.fn(),
    uploadModel: vi.fn(),
    deleteModel: deleteModelMock,
    persistParsedObjects: vi.fn(),
    markObjectAdded: vi.fn(),
  }),
}));

describe('BimTakeoffPage cleanup controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    deleteModelMock.mockResolvedValue({ ok: true });
  });

  it('selects supported model rows for loading', () => {
    render(<BimTakeoffPage projectId="project-1" estimateId="estimate-1" />);

    fireEvent.click(screen.getByRole('button', { name: /^house\.glb$/i }));

    expect(setActiveModelIdMock).toHaveBeenCalledWith('model-glb');
  });

  it('renders a delete button for model rows and confirms delete', async () => {
    render(<BimTakeoffPage projectId="project-1" estimateId="estimate-1" />);

    fireEvent.click(screen.getByLabelText('Delete scene.gltf'));
    expect(screen.getByText('Delete this model?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete model' }));

    await waitFor(() => {
      expect(deleteModelMock).toHaveBeenCalledWith('model-gltf');
    });
    expect(screen.getByText('Model deleted.')).toBeInTheDocument();
  });

  it('shows unsupported badge without bulk cleanup and allows individual unsupported delete', async () => {
    render(<BimTakeoffPage projectId="project-1" estimateId="estimate-1" />);

    expect(screen.getByText('Unsupported MVP format')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear unsupported' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Delete scene.gltf'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete model' }));

    await waitFor(() => {
      expect(deleteModelMock).toHaveBeenCalledWith('model-gltf');
    });
  });

  it('dismisses and persists the quantity warning banner for the project estimate', () => {
    const { unmount } = render(<BimTakeoffPage projectId="project-1" estimateId="estimate-1" />);

    expect(screen.getByText(/Verify model quantities before bidding/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText(/Verify model quantities before bidding/i)).not.toBeInTheDocument();

    unmount();
    render(<BimTakeoffPage projectId="project-1" estimateId="estimate-1" />);
    expect(screen.queryByText(/Verify model quantities before bidding/i)).not.toBeInTheDocument();
  });

  it('surfaces blocked delete messages from linked estimate takeoff items', async () => {
    deleteModelMock.mockResolvedValue({
      ok: false,
      error: 'This model has takeoff items linked to the estimate. Remove those links before deleting the model.',
    });
    render(<BimTakeoffPage projectId="project-1" estimateId="estimate-1" />);

    fireEvent.click(screen.getByLabelText('Delete house.glb'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete model' }));

    expect(
      await screen.findByText(
        'This model has takeoff items linked to the estimate. Remove those links before deleting the model.',
      ),
    ).toBeInTheDocument();
  });

  it('applies model scale calibration from a known distance', () => {
    render(<BimTakeoffPage projectId="project-1" estimateId="estimate-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Calibrate from known distance' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick calibration points' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply scale' }));

    expect(screen.getByText('Scale calibrated')).toBeInTheDocument();
    expect(screen.getByText(/1 model unit = 0\.5000 ft/i)).toBeInTheDocument();
    expect(localStorage.getItem('arden:3dTakeoff:modelCalibration:project-1:model-glb')).toContain(
      '"knownDistance":3',
    );
  });

  it('collapses and restores the 3D Takeoff left panel with persisted state', () => {
    const { unmount } = render(<BimTakeoffPage projectId="project-1" estimateId="estimate-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse 3D Takeoff panel' }));

    expect(localStorage.getItem('arden:3dTakeoff:leftPanelCollapsed:project-1:estimate-1')).toBe('true');
    expect(screen.getByRole('button', { name: 'Expand 3D Takeoff panel' })).toBeInTheDocument();

    unmount();
    render(<BimTakeoffPage projectId="project-1" estimateId="estimate-1" />);
    expect(screen.getByRole('button', { name: 'Expand 3D Takeoff panel' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand 3D Takeoff panel' }));
    expect(localStorage.getItem('arden:3dTakeoff:leftPanelCollapsed:project-1:estimate-1')).toBe('false');
    expect(screen.getByRole('button', { name: 'Collapse 3D Takeoff panel' })).toBeInTheDocument();
  });
});
