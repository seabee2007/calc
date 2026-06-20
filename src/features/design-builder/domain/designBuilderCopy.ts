// Contractor-grade Design Builder copy: concise construction terms, no tutorial cards, contextual help only.
export const DESIGN_BUILDER_COPY = {
  actions: {
    tools: 'Tools',
    estimate: 'Estimate',
    loadTemplate: 'Load CMU Template',
    newLayout: 'New Layout',
    saveDesign: 'Save Design',
    generatePreview: 'Estimate Preview',
    commitEstimate: 'Commit to Estimate',
  },
  hints: {
    blankPlan: 'Project origin is at 0,0. Select Draw Wall to begin your footprint.',
    drawWall: 'Click points to place segments · Right-click/Backspace undo · Esc exits',
    opening: 'Select a wall segment to place opening',
    help: 'Draw Wall places wall segments. CMU units generate automatically from the layout. Openings attach to a wall segment as rough openings. Verify quantities and structural requirements before pricing.',
  },
  status: {
    loadingTemplate: 'Loading CMU template...',
    templateLoadedLocal: 'CMU template loaded locally. Sign in to save and commit it to an estimate.',
    templateLoaded: 'CMU template loaded. Geometry and quantities are generated from saved parameters.',
    blankReady: 'Blank layout ready. Select Draw Wall to trace your wall lines.',
    footprintOpen: 'Footprint open — slab and roof generation unavailable.',
    estimateRequiresUpdate: 'Design revision pending — update linked estimate items before pricing.',
    quantitiesDisclaimer: 'Verify quantities and structural requirements before pricing.',
  },
} as const;
