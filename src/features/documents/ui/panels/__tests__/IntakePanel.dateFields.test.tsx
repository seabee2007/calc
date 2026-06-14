import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntakePanel from '../IntakePanel';
import { qcReportQuestions } from '../../../packs/qcReport/questions';
import { punchListQuestions } from '../../../packs/punchList/questions';

vi.mock('../../../../services/rfiService', () => ({
  fetchRfisForProject: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../../services/fieldAdjustmentService', () => ({
  fetchAdjustmentsForProject: vi.fn().mockResolvedValue([]),
}));

describe('IntakePanel date fields', () => {
  const onAnswerChange = vi.fn();

  beforeEach(() => {
    onAnswerChange.mockClear();
  });

  it('renders report date and follow-up date as date inputs, not text inputs', () => {
    render(
      <IntakePanel
        packOptions={[{ value: 'qc_report', label: 'QC Report' }]}
        packKey="qc_report"
        mode="standard"
        groupedQuestions={[
          {
            group: 'schedule',
            questions: qcReportQuestions.filter((q) =>
              ['reportDate', 'reportNumber', 'followUpDate'].includes(q.questionKey),
            ),
          },
        ]}
        answers={{}}
        onPackChange={vi.fn()}
        onModeChange={vi.fn()}
        onAnswerChange={onAnswerChange}
      />,
    );

    const reportDate = screen.getByLabelText('Report date');
    const followUpDate = screen.getByLabelText('Follow-up date');
    const reportNumber = screen.getByLabelText('Report number');

    expect(reportDate).toHaveAttribute('type', 'date');
    expect(followUpDate).toHaveAttribute('type', 'date');
    expect(reportNumber).toHaveAttribute('type', 'text');
  });

  it('stores selected dates as YYYY-MM-DD and allows clearing optional dates', async () => {
    const user = userEvent.setup();

    render(
      <IntakePanel
        packOptions={[{ value: 'qc_report', label: 'QC Report' }]}
        packKey="qc_report"
        mode="standard"
        groupedQuestions={[
          {
            group: 'schedule',
            questions: qcReportQuestions.filter((q) => q.questionKey === 'reportDate'),
          },
        ]}
        answers={{ reportDate: '2026-06-03' }}
        onPackChange={vi.fn()}
        onModeChange={vi.fn()}
        onAnswerChange={onAnswerChange}
      />,
    );

    const reportDate = screen.getByLabelText('Report date') as HTMLInputElement;
    expect(reportDate.value).toBe('2026-06-03');

    await user.click(screen.getByRole('button', { name: 'Clear date' }));
    expect(onAnswerChange).toHaveBeenCalledWith('reportDate', '');
  });

  it('renders punch list date fields as date inputs', () => {
    render(
      <IntakePanel
        packOptions={[{ value: 'punch_list', label: 'Punch List' }]}
        packKey="punch_list"
        mode="advanced"
        groupedQuestions={[
          {
            group: 'schedule',
            questions: punchListQuestions.filter((q) =>
              ['listDate', 'inspectionDate', 'finalAcceptanceDate', 'signatureDate'].includes(
                q.questionKey,
              ),
            ),
          },
        ]}
        answers={{ listDate: 'June 3, 2026' }}
        onPackChange={vi.fn()}
        onModeChange={vi.fn()}
        onAnswerChange={onAnswerChange}
      />,
    );

    expect(screen.getByLabelText('List date')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Inspection date')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Final acceptance date')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Signature date')).toHaveAttribute('type', 'date');
    expect((screen.getByLabelText('List date') as HTMLInputElement).value).toBe('2026-06-03');
  });
});
