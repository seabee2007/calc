import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ToolsModal from '../../../../../components/workflow/ToolsModal';
import EmployeeQuickActions from '../../../../../components/employee/EmployeeQuickActions';
import ConstructionCalculator from '../ConstructionCalculator';

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
