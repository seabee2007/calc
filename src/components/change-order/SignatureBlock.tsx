import React, { useCallback, useEffect, useRef } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface SignatureBlockProps {
  title: string;
  name: string;
  signature: string;
  signedAt?: string | null;
  onNameChange: (value: string) => void;
  onSignatureChange: (value: string) => void;
  readOnly?: boolean;
  helperText?: string;
}

function formatSignedAt(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export default function SignatureBlock({
  title,
  name,
  signature,
  signedAt,
  onNameChange,
  onSignatureChange,
  readOnly = false,
  helperText,
}: SignatureBlockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  const syncCanvasFromSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (signature.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = signature;
    }
  }, [signature]);

  useEffect(() => {
    syncCanvasFromSignature();
  }, [syncCanvasFromSignature]);

  const getCanvasDataUrl = (): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return;
    drawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const point = 'touches' in e ? e.touches[0] : e;
    const x = (point.clientX - rect.left) * scaleX;
    const y = (point.clientY - rect.top) * scaleY;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current || readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const point = 'touches' in e ? e.touches[0] : e;
    const x = (point.clientX - rect.left) * scaleX;
    const y = (point.clientY - rect.top) * scaleY;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onSignatureChange(getCanvasDataUrl());
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onSignatureChange('');
  };

  const useTypedSignature = () => {
    const typed = name.trim();
    if (!typed) return;
    onSignatureChange(typed);
  };

  const displaySignature =
    signature && !signature.startsWith('data:image') ? (
      <p className="font-serif text-lg italic text-gray-900 dark:text-white">{signature}</p>
    ) : signature.startsWith('data:image') ? (
      <img src={signature} alt="Signature" className="max-h-16 max-w-full object-contain" />
    ) : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
      {helperText && (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{helperText}</p>
      )}
      {readOnly ? (
        <div className="mt-2 space-y-2">
          {name && (
            <p className="text-sm text-gray-800 dark:text-slate-200">
              <span className="font-medium">Name:</span> {name}
            </p>
          )}
          {displaySignature && <div>{displaySignature}</div>}
          {signedAt && (
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Signed {formatSignedAt(signedAt)}
            </p>
          )}
          {!name && !signature && (
            <p className="text-xs text-gray-400 dark:text-slate-500">Not signed yet</p>
          )}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <Input
            label="Printed name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            fullWidth
          />
          <p className="text-xs font-medium text-gray-600 dark:text-slate-400">Signature</p>
          <canvas
            ref={canvasRef}
            width={400}
            height={120}
            className="w-full touch-none rounded border border-slate-300 bg-white dark:border-slate-600"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={clearCanvas}>
              Clear
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={useTypedSignature}>
              Use typed name
            </Button>
          </div>
          {signedAt && (
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Signed {formatSignedAt(signedAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
