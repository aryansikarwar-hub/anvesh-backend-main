import { describe, expect, it } from 'vitest';
import { Schema, model } from 'mongoose';
import { softDeletePlugin } from './soft-delete';

describe('softDeletePlugin aggregate hook', () => {
  const schema = new Schema({ title: String });
  schema.plugin(softDeletePlugin);
  const Thing = model('SoftDeleteSpecThing', schema);

  it('keeps $text inside the first $match', () => {
    const agg = Thing.aggregate([{ $match: { $text: { $search: 'fort' } } }, { $limit: 5 }]);
    (schema as any).s.hooks.execPreSync?.('aggregate', agg);
    const pipeline = (agg.pipeline() as any[]);
    expect(pipeline[0].$match.$text).toBeDefined();
    expect(pipeline[0].$match.deletedAt).toBeNull();
    expect(pipeline).toHaveLength(2);
  });
});