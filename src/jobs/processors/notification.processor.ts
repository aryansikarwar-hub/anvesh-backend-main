import { Types } from 'mongoose';
import { NotificationModel } from '../../lib/database';
import { notificationJobSchema } from '../../lib/validation';

export function notificationProcessor() {
  return async (payload: unknown): Promise<void> => {
    const job = notificationJobSchema.parse(payload);
    await NotificationModel.create([
      {
        userId: new Types.ObjectId(job.userId),
        type: job.type,
        title: job.title,
        body: job.body,
        href: job.href,
      },
    ]);
  };
}
