import type {
  BuilderViewMode,
  DesignComponentCategory,
  DesignComponentDivision,
  DesignComponentType,
  PlacedDesignComponent,
} from '../types';

export type ComponentParameterKind = 'number' | 'text' | 'select';

export interface ComponentParameterDefinition {
  key: string;
  label: string;
  kind: ComponentParameterKind;
  unit?: 'm' | 'type';
  min?: number;
  options?: Array<{ value: string; label: string }>;
}

export interface DesignComponentDefinition {
  type: DesignComponentType;
  displayName: string;
  division: DesignComponentDivision;
  category: DesignComponentCategory;
  supportedViews: BuilderViewMode[];
  defaultParameters: Record<string, unknown>;
  parameterSchema: ComponentParameterDefinition[];
  validate: (parameters: Record<string, unknown>) => string[];
  derive: (params: {
    parameters: Record<string, unknown>;
    placement: PlacedDesignComponent['viewPlacement'];
  }) => Record<string, unknown>;
}

function numberParam(
  key: string,
  label: string,
  fallback: number,
  options?: Pick<ComponentParameterDefinition, 'min' | 'unit'>,
): ComponentParameterDefinition {
  return {
    key,
    label,
    kind: 'number',
    unit: options?.unit ?? 'm',
    min: options?.min ?? 0,
  };
}

function positiveNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function elevationValue(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function validatePositiveParameters(
  parameters: Record<string, unknown>,
  keys: readonly string[],
): string[] {
  return keys.flatMap((key) => (positiveNumber(parameters[key], 0) > 0 ? [] : [`${key} must be greater than 0.`]));
}

const columnDefinition: DesignComponentDefinition = {
  type: 'column',
  displayName: 'Column',
  division: 'Structure',
  category: 'structure',
  supportedViews: ['plan', 'elevation'],
  defaultParameters: {
    widthMeters: 0.3,
    depthMeters: 0.3,
    heightMeters: 3,
    baseElevationMeters: 0,
    materialType: 'cast_concrete',
  },
  parameterSchema: [
    numberParam('widthMeters', 'Width', 0.3),
    numberParam('depthMeters', 'Depth', 0.3),
    numberParam('heightMeters', 'Height', 3),
    numberParam('baseElevationMeters', 'Base elevation', 0, { min: -20, unit: 'm' }),
  ],
  validate: (parameters) => validatePositiveParameters(parameters, ['widthMeters', 'depthMeters', 'heightMeters']),
  derive: ({ parameters }) => {
    const baseElevationMeters = elevationValue(parameters.baseElevationMeters);
    const heightMeters = positiveNumber(parameters.heightMeters, 3);
    return { topElevationMeters: baseElevationMeters + heightMeters };
  },
};

const footerDefinition: DesignComponentDefinition = {
  type: 'footer',
  displayName: 'Footer',
  division: 'Structure',
  category: 'structure',
  supportedViews: ['elevation'],
  defaultParameters: {
    widthMeters: 0.7,
    lengthMeters: 1,
    thicknessMeters: 0.25,
    bottomElevationMeters: -0.45,
    topElevationMeters: -0.2,
  },
  parameterSchema: [
    numberParam('widthMeters', 'Width', 0.7),
    numberParam('lengthMeters', 'Length', 1),
    numberParam('thicknessMeters', 'Depth / thickness', 0.25),
    numberParam('bottomElevationMeters', 'Bottom elevation', -0.45, { min: -20 }),
    numberParam('topElevationMeters', 'Top elevation', -0.2, { min: -20 }),
  ],
  validate: (parameters) => validatePositiveParameters(parameters, ['widthMeters', 'lengthMeters', 'thicknessMeters']),
  derive: ({ parameters }) => ({
    centerElevationMeters:
      (elevationValue(parameters.bottomElevationMeters, -0.45) + elevationValue(parameters.topElevationMeters, -0.2)) / 2,
  }),
};

function beamDefinition(
  type: Extract<DesignComponentType, 'tie_beam' | 'plinth_beam' | 'roof_beam'>,
  displayName: string,
  elevationMeters: number,
): DesignComponentDefinition {
  return {
    type,
    displayName,
    division: 'Structure',
    category: 'structure',
    supportedViews: ['elevation'],
    defaultParameters: {
      widthMeters: 0.25,
      depthMeters: 0.3,
      lengthMeters: 1.2,
      elevationMeters,
      materialType: 'cast_concrete',
    },
    parameterSchema: [
      numberParam('widthMeters', 'Width', 0.25),
      numberParam('depthMeters', 'Depth', 0.3),
      numberParam('lengthMeters', 'Start/end length', 1.2),
      numberParam('elevationMeters', 'Elevation', elevationMeters, { min: -20 }),
    ],
    validate: (parameters) => validatePositiveParameters(parameters, ['widthMeters', 'depthMeters', 'lengthMeters']),
    derive: ({ parameters }) => {
      const elevationMeters = elevationValue(parameters.elevationMeters);
      const depthMeters = positiveNumber(parameters.depthMeters, 0.3);
      return {
        baseElevationMeters: elevationMeters,
        topElevationMeters: elevationMeters + depthMeters,
      };
    },
  };
}

const slabDefinition: DesignComponentDefinition = {
  type: 'slab',
  displayName: 'Slab',
  division: 'Structure',
  category: 'structure',
  supportedViews: ['plan', 'elevation'],
  defaultParameters: {
    thicknessMeters: 0.1,
    widthMeters: 2,
    lengthMeters: 2,
    topElevationMeters: 0,
  },
  parameterSchema: [
    numberParam('thicknessMeters', 'Thickness', 0.1),
    numberParam('widthMeters', 'Width', 2),
    numberParam('lengthMeters', 'Length', 2),
    numberParam('topElevationMeters', 'Top elevation', 0, { min: -20 }),
  ],
  validate: (parameters) => validatePositiveParameters(parameters, ['thicknessMeters', 'widthMeters', 'lengthMeters']),
  derive: ({ parameters }) => {
    const topElevationMeters = elevationValue(parameters.topElevationMeters);
    const thicknessMeters = positiveNumber(parameters.thicknessMeters, 0.1);
    return { bottomElevationMeters: topElevationMeters - thicknessMeters };
  },
};

function openingDefinition(type: Extract<DesignComponentType, 'door' | 'window'>): DesignComponentDefinition {
  const isDoor = type === 'door';
  return {
    type,
    displayName: isDoor ? 'Door' : 'Window',
    division: 'Openings',
    category: 'openings',
    supportedViews: ['plan', 'elevation'],
    defaultParameters: isDoor
      ? {
          widthMeters: 0.9,
          heightMeters: 2.1,
          sillHeightMeters: 0,
          swingDirection: 'left',
        }
      : {
          widthMeters: 1.2,
          heightMeters: 1.2,
          sillHeightMeters: 0.9,
        },
    parameterSchema: [
      numberParam('widthMeters', 'Width', isDoor ? 0.9 : 1.2),
      numberParam('heightMeters', 'Height', isDoor ? 2.1 : 1.2),
      numberParam('sillHeightMeters', isDoor ? 'Base elevation' : 'Sill height', isDoor ? 0 : 0.9, { min: 0 }),
      ...(isDoor
        ? [{
            key: 'swingDirection',
            label: 'Swing direction',
            kind: 'select' as const,
            options: [
              { value: 'left', label: 'Left' },
              { value: 'right', label: 'Right' },
            ],
          }]
        : []),
    ],
    validate: (parameters) => validatePositiveParameters(parameters, ['widthMeters', 'heightMeters']),
    derive: ({ parameters }) => {
      const sillHeightMeters = elevationValue(parameters.sillHeightMeters);
      const heightMeters = positiveNumber(parameters.heightMeters, isDoor ? 2.1 : 1.2);
      return { headHeightMeters: sillHeightMeters + heightMeters };
    },
  };
}

export const DESIGN_COMPONENT_DEFINITIONS: DesignComponentDefinition[] = [
  columnDefinition,
  footerDefinition,
  beamDefinition('tie_beam', 'Tie Beam', 0.45),
  beamDefinition('plinth_beam', 'Plinth Beam', 0),
  slabDefinition,
  beamDefinition('roof_beam', 'Roof Beam', 3),
  openingDefinition('door'),
  openingDefinition('window'),
];

export function getDesignComponentDefinition(type: DesignComponentType): DesignComponentDefinition {
  const definition = DESIGN_COMPONENT_DEFINITIONS.find((item) => item.type === type);
  if (!definition) throw new Error(`Unknown design component type: ${type}`);
  return definition;
}

export function listDesignComponentDefinitionsForView(viewMode: BuilderViewMode): DesignComponentDefinition[] {
  return DESIGN_COMPONENT_DEFINITIONS.filter((definition) => definition.supportedViews.includes(viewMode));
}

export function groupDesignComponentDefinitions(
  definitions: readonly DesignComponentDefinition[] = DESIGN_COMPONENT_DEFINITIONS,
): Array<{ division: DesignComponentDivision; definitions: DesignComponentDefinition[] }> {
  const groups: Array<{ division: DesignComponentDivision; definitions: DesignComponentDefinition[] }> = [];
  definitions.forEach((definition) => {
    const group = groups.find((item) => item.division === definition.division);
    if (group) {
      group.definitions.push(definition);
    } else {
      groups.push({ division: definition.division, definitions: [definition] });
    }
  });
  return groups;
}
