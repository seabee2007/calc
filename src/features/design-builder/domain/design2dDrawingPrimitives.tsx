import type { ReactNode } from 'react';
import type { Design2dDrawingStyleMode } from '../types';

export type DrawingLineWeight = 'heavy' | 'medium' | 'light' | 'reference' | 'preview' | 'selection';

export type DrawingPrimitive =
  | {
      kind: 'line';
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      weight?: DrawingLineWeight;
      dashed?: boolean;
      opacity?: number;
      markerEnd?: string;
      data?: Record<string, string>;
    }
  | {
      kind: 'polyline';
      key: string;
      points: readonly { x: number; y: number }[];
      weight?: DrawingLineWeight;
      dashed?: boolean;
      closed?: boolean;
      fill?: string;
      opacity?: number;
      data?: Record<string, string>;
    }
  | {
      kind: 'rect';
      key: string;
      x: number;
      y: number;
      width: number;
      height: number;
      weight?: DrawingLineWeight;
      dashed?: boolean;
      fill?: string;
      opacity?: number;
      data?: Record<string, string>;
    }
  | {
      kind: 'arc';
      key: string;
      cx: number;
      cy: number;
      radius: number;
      startDegrees: number;
      endDegrees: number;
      weight?: DrawingLineWeight;
      dashed?: boolean;
      opacity?: number;
      data?: Record<string, string>;
    }
  | {
      kind: 'text';
      key: string;
      x: number;
      y: number;
      text: string;
      size?: number;
      anchor?: 'start' | 'middle' | 'end';
      weight?: 'regular' | 'medium' | 'bold';
      opacity?: number;
      data?: Record<string, string>;
    }
  | {
      kind: 'axisBubble';
      key: string;
      x: number;
      y: number;
      label: string;
      radius?: number;
      data?: Record<string, string>;
    }
  | {
      kind: 'levelMarker';
      key: string;
      x: number;
      y: number;
      label: string;
      direction?: 'left' | 'right';
      data?: Record<string, string>;
    }
  | {
      kind: 'dimension';
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      label: string;
      offsetX?: number;
      offsetY?: number;
      data?: Record<string, string>;
    };

export type Drawing2dStyle = {
  mode: Design2dDrawingStyleMode;
  viewportFill: string;
  sheetFill: string;
  sheetStroke: string;
  gridStroke: string;
  gridMajorStroke: string;
  referenceStroke: string;
  lineStroke: string;
  mutedStroke: string;
  structuralFill: string;
  concreteFill: string;
  openingStroke: string;
  textFill: string;
  selectionStroke: string;
  previewStroke: string;
  previewFill: string;
  weights: Record<DrawingLineWeight, number>;
};

export function resolve2dDrawingStyle(mode: Design2dDrawingStyleMode): Drawing2dStyle {
  if (mode === 'builder') {
    return {
      mode,
      viewportFill: '#0f172a',
      sheetFill: '#0f172a',
      sheetStroke: '#334155',
      gridStroke: '#64748b',
      gridMajorStroke: '#94a3b8',
      referenceStroke: '#64748b',
      lineStroke: '#94a3b8',
      mutedStroke: '#64748b',
      structuralFill: '#9ca3af',
      concreteFill: '#cbd5e1',
      openingStroke: '#67e8f9',
      textFill: '#cbd5e1',
      selectionStroke: '#22d3ee',
      previewStroke: '#67e8f9',
      previewFill: '#67e8f966',
      weights: {
        heavy: 4,
        medium: 2,
        light: 1.25,
        reference: 1,
        preview: 2,
        selection: 2.4,
      },
    };
  }

  return {
    mode,
    viewportFill: '#111827',
    sheetFill: '#f8fafc',
    sheetStroke: '#cbd5e1',
    gridStroke: '#d1d5db',
    gridMajorStroke: '#9ca3af',
    referenceStroke: '#9ca3af',
    lineStroke: '#111827',
    mutedStroke: '#4b5563',
    structuralFill: '#d4d4d4',
    concreteFill: '#e5e7eb',
    openingStroke: '#1f2937',
    textFill: '#111827',
    selectionStroke: '#0891b2',
    previewStroke: '#06b6d4',
    previewFill: '#06b6d433',
    weights: {
      heavy: 3,
      medium: 1.6,
      light: 0.95,
      reference: 0.75,
      preview: 1.8,
      selection: 2.2,
    },
  };
}

export function lineStrokeForWeight(style: Drawing2dStyle, weight: DrawingLineWeight = 'medium'): string {
  if (weight === 'preview') return style.previewStroke;
  if (weight === 'selection') return style.selectionStroke;
  if (weight === 'reference' || weight === 'light') return style.referenceStroke;
  return style.lineStroke;
}

function attrs(data?: Record<string, string>) {
  return data ?? {};
}

function arcPath(primitive: Extract<DrawingPrimitive, { kind: 'arc' }>): string {
  const startRadians = (primitive.startDegrees * Math.PI) / 180;
  const endRadians = (primitive.endDegrees * Math.PI) / 180;
  const start = {
    x: primitive.cx + Math.cos(startRadians) * primitive.radius,
    y: primitive.cy + Math.sin(startRadians) * primitive.radius,
  };
  const end = {
    x: primitive.cx + Math.cos(endRadians) * primitive.radius,
    y: primitive.cy + Math.sin(endRadians) * primitive.radius,
  };
  const largeArc = Math.abs(primitive.endDegrees - primitive.startDegrees) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${primitive.radius} ${primitive.radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function renderDrawingPrimitive(primitive: DrawingPrimitive, style: Drawing2dStyle): ReactNode {
  if (primitive.kind === 'line') {
    return (
      <line
        key={primitive.key}
        x1={primitive.x1}
        y1={primitive.y1}
        x2={primitive.x2}
        y2={primitive.y2}
        stroke={lineStrokeForWeight(style, primitive.weight)}
        strokeWidth={style.weights[primitive.weight ?? 'medium']}
        strokeDasharray={primitive.dashed ? '7 5' : undefined}
        strokeOpacity={primitive.opacity}
        markerEnd={primitive.markerEnd}
        pointerEvents="none"
        {...attrs(primitive.data)}
      />
    );
  }
  if (primitive.kind === 'polyline') {
    const points = primitive.points.map((point) => `${point.x},${point.y}`).join(' ');
    const Element = primitive.closed ? 'polygon' : 'polyline';
    return (
      <Element
        key={primitive.key}
        points={points}
        fill={primitive.fill ?? 'none'}
        stroke={lineStrokeForWeight(style, primitive.weight)}
        strokeWidth={style.weights[primitive.weight ?? 'medium']}
        strokeDasharray={primitive.dashed ? '7 5' : undefined}
        opacity={primitive.opacity}
        pointerEvents="none"
        {...attrs(primitive.data)}
      />
    );
  }
  if (primitive.kind === 'rect') {
    return (
      <rect
        key={primitive.key}
        x={primitive.x}
        y={primitive.y}
        width={primitive.width}
        height={primitive.height}
        fill={primitive.fill ?? 'none'}
        stroke={lineStrokeForWeight(style, primitive.weight)}
        strokeWidth={style.weights[primitive.weight ?? 'medium']}
        strokeDasharray={primitive.dashed ? '7 5' : undefined}
        opacity={primitive.opacity}
        pointerEvents="none"
        {...attrs(primitive.data)}
      />
    );
  }
  if (primitive.kind === 'arc') {
    return (
      <path
        key={primitive.key}
        d={arcPath(primitive)}
        fill="none"
        stroke={lineStrokeForWeight(style, primitive.weight)}
        strokeWidth={style.weights[primitive.weight ?? 'medium']}
        strokeDasharray={primitive.dashed ? '7 5' : undefined}
        strokeOpacity={primitive.opacity}
        pointerEvents="none"
        {...attrs(primitive.data)}
      />
    );
  }
  if (primitive.kind === 'text') {
    return (
      <text
        key={primitive.key}
        x={primitive.x}
        y={primitive.y}
        textAnchor={primitive.anchor ?? 'start'}
        fill={style.textFill}
        fontSize={primitive.size ?? 11}
        fontWeight={primitive.weight === 'bold' ? 800 : primitive.weight === 'medium' ? 650 : 500}
        opacity={primitive.opacity}
        pointerEvents="none"
        {...attrs(primitive.data)}
      >
        {primitive.text}
      </text>
    );
  }
  if (primitive.kind === 'axisBubble') {
    const radius = primitive.radius ?? 12;
    return (
      <g key={primitive.key} pointerEvents="none" {...attrs(primitive.data)}>
        <circle cx={primitive.x} cy={primitive.y} r={radius} fill={style.sheetFill} stroke={style.lineStroke} strokeWidth={1.2} />
        <text x={primitive.x} y={primitive.y + 4} textAnchor="middle" fill={style.textFill} fontSize={10} fontWeight={800}>
          {primitive.label}
        </text>
      </g>
    );
  }
  if (primitive.kind === 'levelMarker') {
    const direction = primitive.direction ?? 'right';
    const sign = direction === 'right' ? 1 : -1;
    return (
      <g key={primitive.key} pointerEvents="none" {...attrs(primitive.data)}>
        <path d={`M ${primitive.x} ${primitive.y} l ${sign * 10} -6 v 12 Z`} fill={style.lineStroke} />
        <line x1={primitive.x} y1={primitive.y} x2={primitive.x + sign * 86} y2={primitive.y} stroke={style.lineStroke} strokeWidth={1} />
        <text x={primitive.x + sign * 14} y={primitive.y - 5} textAnchor={direction === 'right' ? 'start' : 'end'} fill={style.textFill} fontSize={10} fontWeight={700}>
          {primitive.label}
        </text>
      </g>
    );
  }

  const ox = primitive.offsetX ?? 0;
  const oy = primitive.offsetY ?? 0;
  const lx1 = primitive.x1 + ox;
  const ly1 = primitive.y1 + oy;
  const lx2 = primitive.x2 + ox;
  const ly2 = primitive.y2 + oy;
  return (
    <g key={primitive.key} pointerEvents="none" {...attrs(primitive.data)}>
      <line x1={primitive.x1} y1={primitive.y1} x2={lx1} y2={ly1} stroke={style.referenceStroke} strokeWidth={0.8} />
      <line x1={primitive.x2} y1={primitive.y2} x2={lx2} y2={ly2} stroke={style.referenceStroke} strokeWidth={0.8} />
      <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={style.lineStroke} strokeWidth={1} />
      <text x={(lx1 + lx2) / 2} y={(ly1 + ly2) / 2 - 4} textAnchor="middle" fill={style.textFill} fontSize={10} fontWeight={700}>
        {primitive.label}
      </text>
    </g>
  );
}

