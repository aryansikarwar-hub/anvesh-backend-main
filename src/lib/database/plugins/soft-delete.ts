// import type { Schema, Query } from 'mongoose';

// /** Queries that must exclude soft-deleted documents unless told otherwise. */
// const READ_HOOKS = [
//   'find',
//   'findOne',
//   'findOneAndUpdate',
//   'findOneAndDelete',
//   'findOneAndReplace',
//   'countDocuments',
//   'distinct',
//   'updateOne',
//   'updateMany',
//   'replaceOne',
// ] as const;

// export interface SoftDeleteOptions {
//   /** Set to false for append-only collections such as auditlogs. */
//   index?: boolean;
// }

// /**
//  * Adds `deletedAt` and makes every ordinary query skip deleted documents.
//  * An explicit `.setOptions({ withDeleted: true })` opts a single query out;
//  * this is used by admin restore flows and by the cleanup worker only.
//  */
// export function softDeletePlugin(schema: Schema, options: SoftDeleteOptions = {}): void {
//   schema.add({ deletedAt: { type: Date, default: null } });
//   if (options.index !== false) schema.index({ deletedAt: 1 });

//   for (const hook of READ_HOOKS) {
//     schema.pre(hook, function (this: Query<unknown, unknown>) {
//       const opts = this.getOptions() as { withDeleted?: boolean };
//       if (opts.withDeleted) return;
//       const filter = this.getFilter();
//       if (Object.prototype.hasOwnProperty.call(filter, 'deletedAt')) return;
//       this.where({ deletedAt: null });
//     });
//   }

//   schema.pre('aggregate', function () {
//     const pipeline = this.pipeline() as unknown as Record<string, unknown>[];
//     const first = pipeline[0];
//     const stage = { $match: { deletedAt: null } };
//     // $geoNear must remain the first stage, so the filter goes after it.
//     if (first && Object.prototype.hasOwnProperty.call(first, '$geoNear')) {
//       pipeline.splice(1, 0, stage);
//       return;
//     }
//     pipeline.unshift(stage);
//   });

//   schema.statics.softDelete = async function softDelete(id: unknown) {
//     return this.findOneAndUpdate({ _id: id }, { $set: { deletedAt: new Date() } }, { new: true });
//   };

//   schema.statics.restore = async function restore(id: unknown) {
//     return this.findOneAndUpdate(
//       { _id: id },
//       { $set: { deletedAt: null } },
//       { new: true, withDeleted: true },
//     );
//   };
// }
import type { Schema, Query } from 'mongoose';

/** Queries that must exclude soft-deleted documents unless told otherwise. */
const READ_HOOKS = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'countDocuments',
  'distinct',
  'updateOne',
  'updateMany',
  'replaceOne',
] as const;

export interface SoftDeleteOptions {
  /** Set to false for append-only collections such as auditlogs. */
  index?: boolean;
}

/**
 * Adds `deletedAt` and makes every ordinary query skip deleted documents.
 * An explicit `.setOptions({ withDeleted: true })` opts a single query out;
 * this is used by admin restore flows and by the cleanup worker only.
 */
export function softDeletePlugin(schema: Schema, options: SoftDeleteOptions = {}): void {
  schema.add({ deletedAt: { type: Date, default: null } });
  if (options.index !== false) schema.index({ deletedAt: 1 });

  for (const hook of READ_HOOKS) {
    schema.pre(hook, function (this: Query<unknown, unknown>) {
      const opts = this.getOptions() as { withDeleted?: boolean };
      if (opts.withDeleted) return;
      const filter = this.getFilter();
      if (Object.prototype.hasOwnProperty.call(filter, 'deletedAt')) return;
      this.where({ deletedAt: null });
    });
  }

  schema.pre('aggregate', function () {
    const pipeline = this.pipeline() as unknown as Record<string, unknown>[];
    const first = pipeline[0];
    const stage = { $match: { deletedAt: null } };
    // $text is only legal inside a $match that is the FIRST stage, so the
    // filter is merged into that stage instead of being put in front of it.
    const firstMatch = first?.$match as Record<string, unknown> | undefined;
    if (firstMatch && Object.prototype.hasOwnProperty.call(firstMatch, '$text')) {
      if (!Object.prototype.hasOwnProperty.call(firstMatch, 'deletedAt')) {
        firstMatch.deletedAt = null;
      }
      return;
    }
    // $geoNear must remain the first stage, so the filter goes after it.
    if (first && Object.prototype.hasOwnProperty.call(first, '$geoNear')) {
      pipeline.splice(1, 0, stage);
      return;
    }
    pipeline.unshift(stage);
  });

  schema.statics.softDelete = async function softDelete(id: unknown) {
    return this.findOneAndUpdate({ _id: id }, { $set: { deletedAt: new Date() } }, { new: true });
  };

  schema.statics.restore = async function restore(id: unknown) {
    return this.findOneAndUpdate(
      { _id: id },
      { $set: { deletedAt: null } },
      { new: true, withDeleted: true },
    );
  };
}