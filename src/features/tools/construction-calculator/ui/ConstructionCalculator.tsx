import React, { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import type { CalculatorFunctionTab } from '../domain/constructionCalculatorTypes';
import ConstructionDisplay from './ConstructionDisplay';
import ConstructionKeypad from './ConstructionKeypad';
import ConstructionTape from './ConstructionTape';
import ConstructionFunctionTabs from './ConstructionFunctionTabs';
import ConstructionCalculatorHelpModal from './ConstructionCalculatorHelpModal';
import { useConstructionCalculator } from './useConstructionCalculator';
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

interface ConstructionCalculatorProps {
  layout: 'desktop' | 'field';
}

function renderModulePanel(tab: CalculatorFunctionTab) {
  switch (tab) {
    case 'area':
      return <AreaPanel />;
    case 'volume':
      return <VolumePanel />;
    case 'board-feet':
      return <BoardFeetPanel />;
    case 'concrete':
      return <ConcretePanel />;
    case 'blocks':
      return <BlocksPanel />;
    case 'drywall':
      return <DrywallPanel />;
    case 'stairs':
      return <StairsPanel />;
    case 'triangle':
      return <RightTrianglePanel />;
    case 'circle':
      return <CirclePanel />;
    case 'conversions':
      return <ConversionsPanel />;
    default:
      return null;
  }
}

export default function ConstructionCalculator({ layout }: ConstructionCalculatorProps) {
  const [activeTab, setActiveTab] = useState<CalculatorFunctionTab>('core');
  const [helpOpen, setHelpOpen] = useState(false);
  const { state, pressKey, pickFraction, setPrecision, modeHint } = useConstructionCalculator({
    enableKeyboard: layout === 'desktop',
  });
  const isField = layout === 'field';
  const isCore = activeTab === 'core';

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
      />
      <ConstructionFunctionTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        layout={layout}
      />
      {isCore ? (
        <>
          <ConstructionDisplay
            display={state.display}
            modeHint={modeHint}
            error={state.error}
            precision={state.precision}
            onPrecisionChange={setPrecision}
            layout={layout}
          />
          {isField && <DimensionEntryHelp layout={layout} />}
          <ConstructionKeypad onKeyPress={pressKey} onPickFraction={pickFraction} layout={layout} />
        </>
      ) : (
        <div className={isField ? '' : CALCULATOR_SECTION}>{renderModulePanel(activeTab)}</div>
      )}
      {isField && <ConstructionTape layout={layout} />}
    </>
  );

  if (isField) {
    return <div className="pb-20">{calculatorBody}</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className={CALCULATOR_SECTION}>{calculatorBody}</div>
      <ConstructionTape layout={layout} />
    </div>
  );
}
