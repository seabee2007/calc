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
    blankPlan: 'Select Draw Wall or a masonry tool to begin.',
    drawWall: 'Click points to place segments · Right-click/Backspace undo · Esc exits',
    opening: 'Select a wall segment to place opening',
    masonry: 'Click to place a unit. Drag to place a run. Right-click or Backspace to undo. Esc exits the active tool.',
    help: 'Draw Wall places Wall Segments. Openings attach to a Wall Segment as Rough Openings. Masonry Layout places CMU units and runs. Verify quantities and structural requirements before pricing.',
  },
  status: {
    loadingTemplate: 'Loading CMU template...',
    templateLoadedLocal: 'CMU template loaded locally. Sign in to save and commit it to an estimate.',
    templateLoaded: 'CMU template loaded. Geometry and quantities are generated from saved parameters.',
    blankReady: 'Blank layout ready. Select Draw Wall or a masonry tool to begin.',
    footprintOpen: 'Footprint open — slab and roof generation unavailable.',
    estimateRequiresUpdate: 'Design revision pending — update linked estimate items before pricing.',
    quantitiesDisclaimer: 'Verify quantities and structural requirements before pricing.',
  },
} as const;
