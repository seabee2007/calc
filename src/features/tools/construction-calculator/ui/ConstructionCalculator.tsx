import React, { useEffect, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import type { CalculatorFunctionTab } from '../domain/constructionCalculatorTypes';
import ConstructionDisplay from './ConstructionDisplay';
import ConstructionKeypad from './ConstructionKeypad';
import ConstructionTape from './ConstructionTape';
import ConstructionFunctionTabs from './ConstructionFunctionTabs';
import ConstructionCalculatorHelpModal from './ConstructionCalculatorHelpModal';
import { useCalculatorInputController } from './hooks/useCalculatorInputController';
import { CALCULATOR_SECTION } from '../../../../theme/appTheme';
import AreaPanel from './components/modules/AreaPanel';
import VolumePanel from './components/modules/VolumePanel';
import BoardFeetPanel from './components/modules/BoardFeetPanel';
import ConcretePanel from './components/modules/ConcretePanel';
import BlocksPanel from './components/modules/BlocksPanel';
import DrywallPanel from './components/modules/DrywallPanel';
import StairsPanel from './components/modules/StairsPanel';
import RightTrianglePanel from './components/modules/RightTrianglePanel';
import CirclePanel from './components/modules/CirclePanel';
import ConversionsPanel from './components/modules/ConversionsPanel';
import DimensionEntryHelp from './DimensionEntryHelp';
import type { CalculatorInputController } from './hooks/useCalculatorInputController';

interface ConstructionCalculatorProps {
  layout: 'desktop' | 'field';
  embedded?: boolean;
  /** Pre-select this tab when the calculator first mounts (e.g. from a dashboard widget button). */
  initialTab?: CalculatorFunctionTab;
  onControllerReady?: (controller: CalculatorInputController) => void;
}

function renderModulePanel(tab: CalculatorFunctionTab, controller: CalculatorInputController) {
  switch (tab) {
    case 'area':
      return <AreaPanel controller={controller} />;
    case 'volume':
      return <VolumePanel controller={controller} />;
    case 'board-feet':
      return <BoardFeetPanel controller={controller} />;
    case 'concrete':
      return <ConcretePanel controller={controller} />;
    case 'blocks':
      return <BlocksPanel controller={controller} />;
    case 'drywall':
      return <DrywallPanel controller={controller} />;
    case 'stairs':
      return <StairsPanel controller={controller} />;
    case 'triangle':
      return <RightTrianglePanel controller={controller} />;
    case 'circle':
      return <CirclePanel controller={controller} />;
    case 'conversions':
      return <ConversionsPanel />;
    default:
      return null;
  }
}

export default function ConstructionCalculator({
  layout,
  embedded = false,
  initialTab,
  onControllerReady,
}: ConstructionCalculatorProps) {
  const [activeTab, setActiveTab] = useState<CalculatorFunctionTab>(initialTab ?? 'core');
  const [helpOpen, setHelpOpen] = useState(false);
  const controller = useCalculatorInputController({
    enableKeyboard: layout === 'desktop' && !embedded,
  });
  const { state, pressKey, pickFraction, setPrecision, modeHint, activeSlot, memoryHasValue, convUnit } =
    controller;
  const isField = layout === 'field' || embedded;
  const isCore = activeTab === 'core';
  const showKeypad = isCore || activeSlot !== null;

  useEffect(() => {
    onControllerReady?.(controller);
  }, [controller, onControllerReady]);

  const helpButton = (
    <button
      type="button"
      onClick={() => setHelpOpen(true)}
      data-testid="calculator-help-button"
      className={
        isField
          ? 'flex h-10 min-w-[40px] items-center justify-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-3 text-sm font-medium text-slate-200 hover:border-cyan-500/50 hover:bg-slate-700'
          : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-cyan-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-cyan-500/50 dark:hover:bg-slate-700'
      }
      aria-label={isField ? 'Calculator help' : 'Help'}
    >
      <CircleHelp className="h-4 w-4 shrink-0" aria-hidden />
      {!isField && <span>Help</span>}
    </button>
  );

  const calculatorBody = (
    <>
      <div className={`mb-3 flex items-center justify-end ${isField ? 'px-0' : ''}`}>{helpButton}</div>
      <ConstructionCalculatorHelpModal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        layout={layout}
        stackAboveParent={embedded}
      />
      <ConstructionFunctionTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        layout={layout}
      />
      {(isCore || activeSlot) && (
        <ConstructionDisplay
          display={state.display}
          modeHint={modeHint}
          error={state.error}
          precision={state.precision}
          onPrecisionChange={setPrecision}
          layout={layout}
          activeSlotLabel={activeSlot?.label ?? null}
          memoryHasValue={memoryHasValue}
          convUnit={convUnit}
          convActive={state.convUnitIndex > 0}
        />
      )}
      {!isCore && (
        <div className={`${isField ? 'mb-4' : CALCULATOR_SECTION}`}>
          {renderModulePanel(activeTab, controller)}
        </div>
      )}
      {isCore && isField && <DimensionEntryHelp layout={layout} />}
      {showKeypad && (
        <ConstructionKeypad
          onKeyPress={pressKey}
          onPickFraction={pickFraction}
          layout={layout}
          memoryHasValue={memoryHasValue}
        />
      )}
      {isField && <ConstructionTape layout={layout} />}
    </>
  );

  if (isField || embedded) {
    return <div className={embedded ? '' : 'pb-20'}>{calculatorBody}</div>;
  }

  return (
    // `minmax(0, 1fr)` instead of plain `1fr` (= `minmax(auto, 1fr)`) so the
    // calculator column's minimum is 0 rather than its min-content width.
    // Without this, the flex tab row's shrink-0 buttons force the column to
    // ~850 px+, blowing out the grid and creating a horizontal scrollbar inside
    // the dashboard modal. `min-w-0` on the child ensures it also respects the
    // constrained track width. The full calculator page is unaffected — on wide
    // viewports `minmax(0, 1fr)` still gives the column all available space.
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className={`min-w-0 ${CALCULATOR_SECTION}`}>{calculatorBody}</div>
      <ConstructionTape layout={layout} />
    </div>
  );
}
