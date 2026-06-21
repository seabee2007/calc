/** Cast-in-place concrete preview roles mapped to distinct texture packs. */
export type CastConcreteMaterialRole = 'structural' | 'beam';

/**
 * Concrete042A — vertical / shell members: columns, footings, lintels, raked caps.
 * Concrete044D — horizontal framing: tie, plinth, grade, roof, and ring beams.
 */
export const CAST_CONCRETE_ROLE_LABELS: Record<CastConcreteMaterialRole, string> = {
  structural: 'Concrete042A (structural)',
  beam: 'Concrete044D (beams)',
};
