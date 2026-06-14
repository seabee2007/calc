import React, { useState } from 'react';
import type { CalculatorFunctionTab } from '../domain/constructionCalculatorTypes';
import ConstructionDisplay from './ConstructionDisplay';
import ConstructionKeypad from './ConstructionKeypad';
import ConstructionTape from './ConstructionTape';
import ConstructionFunctionTabs from './ConstructionFunctionTabs';
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
  const { state, pressKey, setPrecision } = useConstructionCalculator({
    enableKeyboard: layout === 'desktop',
  });
  const isField = layout === 'field';
  const isCore = activeTab === 'core';

  const calculatorBody = (
    <>
      <ConstructionFunctionTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        layout={layout}
      />
      {isCore ? (
        <>
          <ConstructionDisplay
            display={state.display}
            expression={state.expressionDisplay || undefined}
            error={state.error}
            precision={state.precision}
            onPrecisionChange={setPrecision}
            layout={layout}
          />
          <ConstructionKeypad onKeyPress={pressKey} layout={layout} />
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
