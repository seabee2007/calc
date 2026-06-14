import { describe, expect, it } from 'vitest';
import { normalizeContractAnswers } from '../contractAnswersUtils';

describe('normalizeContractAnswers', () => {
  it('normalizes legacy readable date strings to ISO dates', () => {
    const result = normalizeContractAnswers({
      listDate: 'June 3, 2026',
      inspectionDate: '2026-06-14',
      summary: 'All good',
    });

    expect(result.listDate).toBe('2026-06-03');
    expect(result.inspectionDate).toBe('2026-06-14');
    expect(result.summary).toBe('All good');
  });

  it('normalizes punch list item date fields', () => {
    const result = normalizeContractAnswers({
      punchItems: [
        {
          id: '1',
          dueDate: 'July 1, 2026',
          completionDate: '',
          verificationDate: '2026-07-15',
        },
      ],
    });

    expect(result.punchItems).toEqual([
      {
        id: '1',
        dueDate: '2026-07-01',
        completionDate: '',
        verificationDate: '2026-07-15',
      },
    ]);
  });
});
