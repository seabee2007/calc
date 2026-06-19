import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BimModelUpload from '../ui/components/BimModelUpload';
import {
  GLTF_EXTERNAL_REFERENCE_ERROR,
  IFC_IMPORT_FUTURE_ERROR,
  INVALID_BIM_FILE_ERROR,
  REVIT_SKETCHUP_EXPORT_ERROR,
} from '../services/bimModelUploadValidation';

describe('BimModelUpload', () => {
  it('calls onUpload when a GLB file is selected', async () => {
    const onUpload = vi.fn();
    render(<BimModelUpload onUpload={onUpload} />);

    const input = screen.getByTestId('bim-model-file-input');
    const file = new File(['binary'], 'sample.glb', { type: 'model/gltf-binary' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith(file);
    });
  });

  it('rejects standalone .gltf with external scene.bin and shows a clear message', async () => {
    const onUpload = vi.fn();
    render(<BimModelUpload onUpload={onUpload} />);

    const gltf = JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 100, uri: 'scene.bin' }],
    });
    const file = new File([gltf], 'scene.gltf', { type: 'model/gltf+json' });
    const input = screen.getByTestId('bim-model-file-input');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('bim-upload-validation-error')).toHaveTextContent(
        GLTF_EXTERNAL_REFERENCE_ERROR,
      );
    });
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('shows MVP helper text for .glb-only uploads', () => {
    render(<BimModelUpload onUpload={vi.fn()} />);
    expect(screen.getByText(/Upload GLB Model/i)).toBeInTheDocument();
    expect(screen.getByText(/Supported now: single-file \.glb models/i)).toBeInTheDocument();
    expect(screen.getByText(/Coming later: IFC and zipped GLTF packages/i)).toBeInTheDocument();
  });

  it('rejects unsupported extensions with MVP guidance', async () => {
    const onUpload = vi.fn();
    render(<BimModelUpload onUpload={onUpload} />);

    const file = new File(['obj'], 'model.obj', { type: 'text/plain' });
    const input = screen.getByTestId('bim-model-file-input');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('bim-upload-validation-error')).toHaveTextContent(
        INVALID_BIM_FILE_ERROR,
      );
    });
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('rejects IFC uploads with future import guidance', async () => {
    const onUpload = vi.fn();
    render(<BimModelUpload onUpload={onUpload} />);

    fireEvent.change(screen.getByTestId('bim-model-file-input'), {
      target: { files: [new File(['ifc'], 'model.ifc', { type: 'application/octet-stream' })] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('bim-upload-validation-error')).toHaveTextContent(
        IFC_IMPORT_FUTURE_ERROR,
      );
    });
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('rejects Revit and SketchUp uploads with export guidance', async () => {
    const onUpload = vi.fn();
    render(<BimModelUpload onUpload={onUpload} />);

    fireEvent.change(screen.getByTestId('bim-model-file-input'), {
      target: { files: [new File(['rvt'], 'model.rvt', { type: 'application/octet-stream' })] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('bim-upload-validation-error')).toHaveTextContent(
        REVIT_SKETCHUP_EXPORT_ERROR,
      );
    });
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('shows compact file format help', () => {
    render(<BimModelUpload onUpload={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /File format help/i }));

    expect(screen.getByText('What can I upload?')).toBeInTheDocument();
    expect(screen.getByText(/Loose \.gltf files are not supported yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Revit and SketchUp users should export or convert to GLB/i)).toBeInTheDocument();
  });
});
