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
  setMeasurementDisplayFormat: vi.fn(),
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

    fireEvent.click(screen.getByRole('button', { name: /Measure: Off/i }));
    fireEvent.click(screen.getByRole('button', { name: /line/i }));
    fireEvent.click(screen.getByRole('button', { name: /Snap On/i }));

    expect(engineMethods.setMeasurementMode).toHaveBeenCalledWith('line');
    expect(engineMethods.setSnapEnabled).toHaveBeenLastCalledWith(false);
  });

  it('styles snap on and off state text distinctly', () => {
    render(
      <BimViewer
        signedUrl={null}
        onSelect={() => undefined}
        modelUnit="feet"
        scaleConfirmed={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Measure: Off/i }));
    expect(screen.getByText('On')).toHaveClass('text-cyan-600');
    expect(screen.getByText('On')).toHaveClass('dark:text-cyan-300');

    fireEvent.click(screen.getByRole('button', { name: /Snap On/i }));
    expect(screen.getByText('Off')).toHaveClass('text-slate-500');
  });

  it('closes the measure dropdown on outside viewer click and Escape without changing mode', () => {
    render(
      <BimViewer
        signedUrl={null}
        onSelect={() => undefined}
        modelUnit="feet"
        scaleConfirmed={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Measure: Off/i }));
    fireEvent.click(screen.getByRole('button', { name: /line/i }));
    expect(screen.getByText('Measurement format')).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByTestId('bim-viewer-canvas'));
    expect(screen.queryByText('Measurement format')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Measure: Line/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Measure: Line/i }));
    expect(screen.getByText('Measurement format')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Measurement format')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Measure: Line/i })).toBeInTheDocument();
  });

  it('shows view actions inside the View dropdown', () => {
    render(
      <BimViewer
        signedUrl={null}
        onSelect={() => undefined}
        modelUnit="feet"
        scaleConfirmed={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /View/i }));

    expect(screen.getByRole('button', { name: 'Fit view' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset view' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide selected' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Isolate selected' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all' })).toBeInTheDocument();
  });

  it('clears measurement and changes display format from the Measure dropdown', () => {
    const onFormatChange = vi.fn();
    render(
      <BimViewer
        signedUrl={null}
        onSelect={() => undefined}
        modelUnit="feet"
        scaleConfirmed={false}
        onMeasurementDisplayFormatChange={onFormatChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Measure: Off/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear measurement' }));
    fireEvent.click(screen.getByRole('button', { name: /Feet-inch fraction/i }));

    expect(engineMethods.clearMeasurement).toHaveBeenCalled();
    expect(onFormatChange).toHaveBeenCalledWith('feet_inches_fraction');
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
