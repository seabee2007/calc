import { describe, expect, it } from 'vitest';
import {
  PRE_POUR_ITEMS,
  DURING_PLACEMENT_ITEMS,
  POST_PLACEMENT_ITEMS,
  createDefaultInspectionItems,
  createEmptyInspectionChecklistItems,
} from './concreteInspectionChecklistItems';
import { TOOLBOX_TALK_TOPIC_OPTIONS, getToolboxTalk } from './toolboxTalkTopics';

describe('concreteInspectionChecklistItems', () => {
  it('has expected pre-pour item count', () => {
    expect(PRE_POUR_ITEMS.length).toBe(19);
  });

  it('has expected during and post item counts', () => {
    expect(DURING_PLACEMENT_ITEMS.length).toBe(14);
    expect(POST_PLACEMENT_ITEMS.length).toBe(12);
  });

  it('createDefaultInspectionItems initializes empty status and notes', () => {
    const items = createDefaultInspectionItems(['Test item']);
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Test item');
    expect(items[0].status).toBeNull();
    expect(items[0].notes).toBe('');
  });

  it('createEmptyInspectionChecklistItems totals 45 items', () => {
    const all = createEmptyInspectionChecklistItems();
    const total =
      all.prePourItems.length +
      all.duringPlacementItems.length +
      all.postPlacementItems.length;
    expect(total).toBe(45);
  });
});

describe('toolboxTalkTopics', () => {
  it('returns content for all topic keys', () => {
    for (const opt of TOOLBOX_TALK_TOPIC_OPTIONS) {
      const talk = getToolboxTalk(opt.value);
      expect(talk.title).toBeTruthy();
      expect(talk.keyHazards.length).toBeGreaterThan(0);
      expect(talk.safePractices.length).toBeGreaterThan(0);
    }
  });
});
