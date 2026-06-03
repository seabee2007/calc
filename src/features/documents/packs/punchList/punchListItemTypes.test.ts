import { describe, expect, it } from 'vitest';
import {
  duplicatePunchListItem,
  emptyPunchListItem,
  legacyAnswersToPunchItems,
  parsePunchListItems,
} from './punchListItemTypes';

describe('punchListItemTypes', () => {
  it('parses valid punchItems array', () => {
    const rows = parsePunchListItems([
      { id: '1', description: 'Fix door', itemNumber: '2' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe('Fix door');
  });

  it('maps legacy flat answers to one item', () => {
    const rows = legacyAnswersToPunchItems({
      itemDescription: 'Old draft item',
      itemNumber: '5',
      priority: 'high',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe('Old draft item');
    expect(rows[0].itemNumber).toBe('5');
  });

  it('duplicate assigns new id', () => {
    const a = emptyPunchListItem();
    const b = duplicatePunchListItem({ ...a, itemNumber: '1' });
    expect(b.id).not.toBe(a.id);
    expect(b.itemNumber).toBe('1');
  });
});
