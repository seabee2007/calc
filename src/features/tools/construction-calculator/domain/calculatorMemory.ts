import type { DimensionValue, MemoryValue } from './constructionCalculatorTypes';

export const MEMORY_TYPE_MISMATCH_ERROR = 'Memory type does not match current entry mode.';

export function createEmptyMemory(): MemoryValue | null {
  return null;
}

export function memoryAdd(
  memory: MemoryValue | null,
  operand: { kind: 'dimension'; value: DimensionValue } | { kind: 'scalar'; value: number },
): MemoryValue {
  if (operand.kind === 'dimension') {
    const inches = operand.value.decimalInches;
    if (memory === null) {
      return { kind: 'dimension', decimalInches: inches };
    }
    if (memory.kind === 'scalar') {
      throw new Error(MEMORY_TYPE_MISMATCH_ERROR);
    }
    return { kind: 'dimension', decimalInches: memory.decimalInches + inches };
  }

  if (memory === null) {
    return { kind: 'scalar', value: operand.value };
  }
  if (memory.kind === 'dimension') {
    throw new Error(MEMORY_TYPE_MISMATCH_ERROR);
  }
  return { kind: 'scalar', value: memory.value + operand.value };
}

export function memorySubtract(
  memory: MemoryValue | null,
  operand: { kind: 'dimension'; value: DimensionValue } | { kind: 'scalar'; value: number },
): MemoryValue {
  if (operand.kind === 'dimension') {
    const inches = operand.value.decimalInches;
    if (memory === null) {
      return { kind: 'dimension', decimalInches: -inches };
    }
    if (memory.kind === 'scalar') {
      throw new Error(MEMORY_TYPE_MISMATCH_ERROR);
    }
    return { kind: 'dimension', decimalInches: memory.decimalInches - inches };
  }

  if (memory === null) {
    return { kind: 'scalar', value: -operand.value };
  }
  if (memory.kind === 'dimension') {
    throw new Error(MEMORY_TYPE_MISMATCH_ERROR);
  }
  return { kind: 'scalar', value: memory.value - operand.value };
}

export function memoryRecall(
  memory: MemoryValue | null,
  expectedKind: 'dimension' | 'scalar',
): MemoryValue {
  if (memory === null) {
    throw new Error('Memory is empty.');
  }
  if (memory.kind !== expectedKind) {
    throw new Error(MEMORY_TYPE_MISMATCH_ERROR);
  }
  return memory;
}

export function memoryClear(): null {
  return null;
}
