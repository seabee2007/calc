import type { PipeStockLengthKind, PipeStockLengthPreset, PlumbingMaterial, PlumbingRunSystem } from '../plumbingTypes';

export type PipeStockLengthOption = {
  preset: PipeStockLengthPreset;
  label: string;
  lengthFt: number;
  kind: PipeStockLengthKind;
};

const GENERAL_STICK_OPTIONS: PipeStockLengthOption[] = [
  { preset: '2ft', label: '2 ft stick', lengthFt: 2, kind: 'stick' },
  { preset: '5ft', label: '5 ft stick', lengthFt: 5, kind: 'stick' },
  { preset: '10ft', label: '10 ft stick', lengthFt: 10, kind: 'stick' },
  { preset: '20ft', label: '20 ft stick', lengthFt: 20, kind: 'stick' },
  { preset: 'custom', label: 'Custom', lengthFt: 10, kind: 'custom' },
];

const PEX_OPTIONS: PipeStockLengthOption[] = [
  { preset: '10ft_stick', label: '10 ft stick', lengthFt: 10, kind: 'stick' },
  { preset: '20ft_stick', label: '20 ft stick', lengthFt: 20, kind: 'stick' },
  { preset: '100ft_coil', label: '100 ft coil', lengthFt: 100, kind: 'coil' },
  { preset: '300ft_coil', label: '300 ft coil', lengthFt: 300, kind: 'coil' },
  { preset: '500ft_coil', label: '500 ft coil', lengthFt: 500, kind: 'coil' },
  { preset: '1000ft_coil', label: '1000 ft coil', lengthFt: 1000, kind: 'coil' },
  { preset: 'custom', label: 'Custom', lengthFt: 100, kind: 'custom' },
];

export function stockLengthOptionsForMaterial(material: PlumbingMaterial): PipeStockLengthOption[] {
  if (material === 'pex') return PEX_OPTIONS;
  if (material === 'cast_iron') {
    return GENERAL_STICK_OPTIONS.filter((option) => option.preset === '5ft' || option.preset === '10ft' || option.preset === 'custom');
  }
  if (material === 'cpvc' || material === 'copper' || material === 'pvc' || material === 'abs') {
    return GENERAL_STICK_OPTIONS.filter((option) => option.preset === '10ft' || option.preset === '20ft' || option.preset === 'custom');
  }
  return GENERAL_STICK_OPTIONS.filter((option) => option.preset === 'custom');
}

export function defaultStockLengthForPipe(params: {
  material: PlumbingMaterial;
  system: PlumbingRunSystem;
}): { stockLengthFt: number; stockLengthPreset: PipeStockLengthPreset; stockLengthKind: PipeStockLengthKind } {
  if (params.material === 'pex') {
    return { stockLengthFt: 100, stockLengthPreset: '100ft_coil', stockLengthKind: 'coil' };
  }
  if (params.material === 'cast_iron') {
    return { stockLengthFt: 5, stockLengthPreset: '5ft', stockLengthKind: 'stick' };
  }
  if (params.material === 'other') {
    return { stockLengthFt: 10, stockLengthPreset: 'custom', stockLengthKind: 'custom' };
  }
  return { stockLengthFt: 10, stockLengthPreset: '10ft', stockLengthKind: 'stick' };
}

export function stockLengthOptionForPreset(
  material: PlumbingMaterial,
  preset: PipeStockLengthPreset,
): PipeStockLengthOption | null {
  return stockLengthOptionsForMaterial(material).find((option) => option.preset === preset) ?? null;
}

