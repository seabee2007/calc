import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ToolsModal from '../../../../../components/workflow/ToolsModal';
import EmployeeQuickActions from '../../../../../components/employee/EmployeeQuickActions';
import ConstructionCalculator from '../ConstructionCalculator';
import ArdenFieldCalculatorPage from '../../../../../pages/tools/ArdenFieldCalculatorPage';
import EmployeeCalculatorPage from '../../../../../pages/employee/EmployeeCalculatorPage';
import { CALCULATOR_HELP_MODAL_TITLE } from '../constructionCalculatorHelpContent';
import { CALCULATOR_MODULES } from '../../domain/constructionCalculatorModules';

vi.mock('../../../../../services/soundService', () => ({
  soundService: { play: vi.fn() },
}));

vi.mock('../../../../../services/hapticService', () => ({
  hapticService: { button: vi.fn(), modal: vi.fn() },
}));

vi.mock('../../../../../store/toolsModalStore', () => ({
  useToolsModalStore: () => ({ isOpen: true, close: vi.fn() }),
}));

vi.mock('../../../../../store', () => ({
  useProjectStore: (selector: (s: { projects: never[]; currentProject: null }) => unknown) =>
    selector({ projects: [], currentProject: null }),
}));

vi.mock('../../../../../store/constructionCalculatorTapeStore', () => ({
  useConstructionCalculatorTapeStore: (selector: (s: {
    entries: never[];
    addEntry: () => void;
    clearTape: () => void;
  }) => unknown) =>
    selector({
      entries: [],
      addEntry: vi.fn(),
      clearTape: vi.fn(),
    }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('ToolsModal', () => {
  it('shows Arden Field Calculator tile', () => {
    render(
      <MemoryRouter>
        <ToolsModal />
      </MemoryRouter>,
    );
    expect(screen.getByText('Arden Field Calculator')).toBeInTheDocument();
  });
});

describe('EmployeeQuickActions', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('navigates to /employee/calculator', () => {
    render(
      <MemoryRouter>
        <EmployeeQuickActions userId="u1" />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Calculator'));
    expect(mockNavigate).toHaveBeenCalledWith('/employee/calculator');
  });
});

describe('ConstructionCalculator UI', () => {
  it('renders keypad and display', () => {
    render(<ConstructionCalculator layout="desktop" />);
    expect(screen.getByTestId('construction-keypad')).toBeInTheDocument();
    expect(screen.getByTestId('calculator-display')).toBeInTheDocument();
  });

  it('renders side tape on desktop', () => {
    render(<ConstructionCalculator layout="desktop" />);
    expect(screen.getByTestId('construction-tape')).toBeInTheDocument();
  });

  it('enters dimension via keypad taps', () => {
    render(<ConstructionCalculator layout="field" />);
    fireEvent.click(screen.getByLabelText('1'));
    fireEvent.click(screen.getByLabelText('2'));
    fireEvent.click(screen.getByText('FT'));
    fireEvent.click(screen.getByLabelText('6'));
    fireEvent.click(screen.getByText('IN'));
    expect(screen.getByTestId('calculator-display')).toHaveTextContent(`12' 6"`);
  });

  it('shows copy button on tape', () => {
    render(<ConstructionCalculator layout="desktop" />);
    expect(screen.getByTestId('tape-copy')).toBeInTheDocument();
    expect(screen.getByTestId('tape-clear')).toBeInTheDocument();
  });
});

describe('ConstructionCalculator Help modal', () => {
  it('shows Help button on desktop calculator', () => {
    render(<ConstructionCalculator layout="desktop" />);
    expect(screen.getByTestId('calculator-help-button')).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  it('shows help icon button on field calculator', () => {
    render(<ConstructionCalculator layout="field" />);
    expect(screen.getByTestId('calculator-help-button')).toBeInTheDocument();
    expect(screen.getByLabelText('Calculator help')).toBeInTheDocument();
  });

  it('opens help modal with core and module sections', () => {
    render(<ConstructionCalculator layout="desktop" />);
    fireEvent.click(screen.getByTestId('calculator-help-button'));
    expect(screen.getByTestId('calculator-help-modal')).toBeInTheDocument();
    expect(screen.getByText(CALCULATOR_HELP_MODAL_TITLE)).toBeInTheDocument();
    expect(screen.getByTestId('help-section-core-dimension-math')).toBeInTheDocument();
    expect(screen.getByTestId('help-section-stairs')).toBeInTheDocument();
    expect(screen.getByTestId('help-section-cylinder-column-volume')).toBeInTheDocument();
    expect(screen.getByTestId('help-section-cone-volume')).toBeInTheDocument();
    expect(screen.getByTestId('help-section-cost-per-unit')).toBeInTheDocument();
  });

  it('closes help modal', async () => {
    render(<ConstructionCalculator layout="desktop" />);
    fireEvent.click(screen.getByTestId('calculator-help-button'));
    expect(screen.getByTestId('calculator-help-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close modal'));
    await waitFor(() => {
      expect(screen.queryByTestId('calculator-help-modal')).not.toBeInTheDocument();
    });
  });

  it('renders a help section for every implemented calculator tab', () => {
    render(<ConstructionCalculator layout="desktop" />);
    fireEvent.click(screen.getByTestId('calculator-help-button'));
    for (const mod of CALCULATOR_MODULES) {
      for (const helpId of mod.helpSectionIds) {
        expect(
          screen.getByTestId(`help-section-${helpId}`),
          `missing help section for tab "${mod.tab}" (${helpId})`,
        ).toBeInTheDocument();
      }
    }
  });

  it('selecting Blocks / Masonry shows block help and not cone volume content', () => {
    render(<ConstructionCalculator layout="field" />);
    fireEvent.click(screen.getByTestId('calculator-help-button'));

    // Focus Cone Volume first to simulate the previously mismatched state.
    fireEvent.click(screen.getByTestId('help-nav-cone-volume'));
    expect(screen.getByText('Volume = (π × radius² × height) ÷ 3')).toBeInTheDocument();
    expect(screen.getByTestId('help-nav-cone-volume')).toHaveAttribute('aria-current', 'true');

    // Now select Blocks / Masonry.
    fireEvent.click(screen.getByTestId('help-nav-blocks-masonry'));
    expect(screen.getByText('Base block count = wall area ÷ block face area')).toBeInTheDocument();

    // Selection state and displayed content must agree.
    expect(screen.getByTestId('help-nav-blocks-masonry')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('help-nav-cone-volume')).not.toHaveAttribute('aria-current');
    expect(screen.queryByText('Volume = (π × radius² × height) ÷ 3')).not.toBeInTheDocument();
  });

  it('shows drywall sheet-count help when Drywall / Sheet Goods is selected', () => {
    render(<ConstructionCalculator layout="field" />);
    fireEvent.click(screen.getByTestId('calculator-help-button'));
    fireEvent.click(screen.getByTestId('help-nav-drywall-sheet-goods'));
    expect(screen.getByText('Base sheet count = total area ÷ sheet area')).toBeInTheDocument();
  });
});

describe('ArdenFieldCalculatorPage Help', () => {
  it('includes help button on desktop page', () => {
    render(
      <MemoryRouter>
        <ArdenFieldCalculatorPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('calculator-help-button')).toBeInTheDocument();
  });
});

describe('EmployeeCalculatorPage Help', () => {
  it('includes help button on employee page', () => {
    render(
      <MemoryRouter>
        <EmployeeCalculatorPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('calculator-help-button')).toBeInTheDocument();
  });
});
