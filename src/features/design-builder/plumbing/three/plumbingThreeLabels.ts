import * as THREE from 'three';
import { fittingDefinition } from '../domain/plumbingFittingCompatibility';
import { formatPipeDiameter } from '../domain/plumbingTakeoff';
import type { PlumbingEquipment, PlumbingFixture, PlumbingRun } from '../plumbingTypes';
import type { PlumbingFitting } from '../plumbingFittingTypes';
import type { TrackMaterial } from './plumbingThreeUtils';

function formatSlope(slopeInPerFt: number): string {
  if (Math.abs(slopeInPerFt - 0.25) < 0.0001) return '1/4"/FT';
  if (Math.abs(slopeInPerFt - 0.125) < 0.0001) return '1/8"/FT';
  if (Math.abs(slopeInPerFt - 0.5) < 0.0001) return '1/2"/FT';
  return `${slopeInPerFt}"/FT`;
}

function systemShortLabel(system: PlumbingRun['system']): string {
  if (system === 'cold_water') return 'CW';
  if (system === 'hot_water') return 'HW';
  if (system === 'sanitary') return 'SS';
  return 'V';
}

function materialLabel(run: PlumbingRun): string {
  const material = run.material.toUpperCase().replace('_', ' ');
  const schedule = run.schedule && run.schedule !== 'N/A' ? ` ${run.schedule}` : '';
  return `${material}${schedule}`;
}

export function formatPlumbingThreeRunLabel(run: PlumbingRun): string {
  const parts = [
    formatPipeDiameter(run.diameterInches),
    materialLabel(run),
    systemShortLabel(run.system),
  ].filter(Boolean);
  const slope =
    run.system === 'sanitary' && run.slopeInPerFt != null && Number.isFinite(run.slopeInPerFt)
      ? ` @ ${formatSlope(run.slopeInPerFt)}`
      : '';
  return `${parts.join(' ')}${slope}`;
}

export function formatPlumbingThreeFittingLabel(fitting: PlumbingFitting): string {
  if (fitting.type === 'floor_cleanout') return 'FCO';
  if (fitting.type === 'yard_cleanout') return 'YCO';
  if (fitting.type === 'cleanout_adapter' || fitting.type === 'cleanout_plug') return 'CO';
  if (fitting.type === 'roof_vent_boot') return 'VTR';
  return fittingDefinition(fitting.type)?.label ?? fitting.type.replace(/_/g, ' ');
}

export function formatPlumbingThreeFixtureLabel(fixture: PlumbingFixture): string {
  return fixture.mark;
}

export function formatPlumbingThreeEquipmentLabel(equipment: PlumbingEquipment): string {
  if (equipment.equipmentType === 'roof_vent_termination') return 'VTR';
  return equipment.label;
}

export function createPlumbingTextLabel(params: {
  text: string;
  position: THREE.Vector3;
  color?: number;
  trackMaterial?: TrackMaterial;
}): THREE.Sprite {
  if (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('jsdom')) {
    const sprite = new THREE.Sprite();
    sprite.name = `plumbing label ${params.text}`;
    sprite.position.copy(params.position);
    return sprite;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas.getContext('2d');
  } catch {
    context = null;
  }
  if (!context) {
    const sprite = new THREE.Sprite();
    sprite.position.copy(params.position);
    return sprite;
  }
  context.fillStyle = 'rgba(255,255,255,0.92)';
  context.strokeStyle = 'rgba(15,23,42,0.22)';
  context.lineWidth = 6;
  roundedRect(context, 18, 26, 476, 76, 18);
  context.fill();
  context.stroke();
  context.fillStyle = `#${(params.color ?? 0x0f172a).toString(16).padStart(6, '0')}`;
  context.font = '700 34px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(params.text, 256, 64, 456);

  const texture = new THREE.CanvasTexture(canvas);
  const material = params.trackMaterial?.(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  ) ?? new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.name = `plumbing label ${params.text}`;
  sprite.position.copy(params.position);
  sprite.scale.set(1.15, 0.29, 1);
  return sprite;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}
