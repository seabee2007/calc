import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BimViewer from '../ui/components/BimViewer';

const engineMethods = {
  dispose: vi.fn(),
  setMeasurementContext: vi.fn(),
  setMeasurementMode: vi.fn(),
  setSnapEnabled: vi.fn(),
  setCalibrationActive: vi.fn(),
  unloadModel: vi.fn(),
  selectByExternalId: vi.fn(),
  setObjectVisibility: vi.fn(),
  fitModel: vi.fn(),
  resetView: vi.fn(),
  hideSelected: vi.fn(),
  isolateSelected: vi.fn(),
  resetVisibility: vi.fn(),
  clearMeasurement: vi.fn(),
  closeMeasurement: vi.fn(),
  resize: vi.fn(),
};

vi.mock('../viewer/bimViewerEngine', () => ({
  BimViewerEngine: vi.fn().mockImplementation(function BimViewerEngineMock() {
    return engineMethods;
  }),
}));

describe('BimViewer measurement controls', () => {
  beforeEach(() => {
    Object.values(engineMethods).forEach((method) => method.mockClear());
  });

  it('shows the quick measure controls tooltip', () => {
    render(
      <BimViewer
        signedUrl={null}
        onSelect={() => undefined}
        modelUnit="feet"
        scaleConfirmed={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Measure controls' }));

    expect(screen.getByText('Measure controls')).toBeInTheDocument();
    expect(screen.getByText('Left click: add point')).toBeInTheDocument();
    expect(screen.getByText('Right click: undo last point')).toBeInTheDocument();
    expect(screen.getByText('Esc: stop measuring')).toBeInTheDocument();
  });

  it('toggles measure mode and snap controls', () => {
    render(
      <BimViewer
        signedUrl={null}
        onSelect={() => undefined}
        modelUnit="feet"
        scaleConfirmed={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'line' }));
    fireEvent.click(screen.getByRole('button', { name: /Snap: On/i }));

    expect(engineMethods.setMeasurementMode).toHaveBeenCalledWith('line');
    expect(engineMethods.setSnapEnabled).toHaveBeenLastCalledWith(false);
  });

  it('passes calibration state into the viewer engine', () => {
    render(
      <BimViewer
        signedUrl={null}
        onSelect={() => undefined}
        modelUnit="feet"
        scaleConfirmed={true}
        calibrationActive
        calibrationScaleFactor={0.5}
        calibrated
      />,
    );

    expect(engineMethods.setCalibrationActive).toHaveBeenCalledWith(true);
    expect(engineMethods.setMeasurementContext).toHaveBeenCalledWith('feet', true, 0.5, true);
  });
});
