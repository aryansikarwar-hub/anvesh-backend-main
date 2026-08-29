import { type Trip, type TripActivity, type TripDay } from '../../lib/types';
import { type TripDocument } from '../../lib/database';

export function toTrip(doc: TripDocument): Trip {
  return {
    id: String(doc._id),
    userId: String(doc.userId),
    title: doc.title,
    destinationId: doc.destinationId ? String(doc.destinationId) : null,
    destinationName: doc.destinationName,
    startDate: doc.startDate ? doc.startDate.toISOString().slice(0, 10) : null,
    endDate: doc.endDate ? doc.endDate.toISOString().slice(0, 10) : null,
    travellers: doc.travellers,
    notes: doc.notes,
    ...(doc.coverImageUrl ? { coverImageUrl: doc.coverImageUrl } : {}),
    generatedByAi: doc.generatedByAi,
    days: doc.days
      .slice()
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map(toTripDay),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toTripDay(day: TripDocument['days'][number]): TripDay {
  return {
    id: String(day._id),
    dayNumber: day.dayNumber,
    date: day.date ? new Date(day.date).toISOString().slice(0, 10) : null,
    title: day.title,
    activities: day.activities
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(toTripActivity),
  };
}

function toTripActivity(activity: TripDocument['days'][number]['activities'][number]): TripActivity {
  return {
    id: String(activity._id),
    kind: activity.kind,
    ...(activity.placeId ? { placeId: String(activity.placeId) } : {}),
    ...(activity.experienceId ? { experienceId: String(activity.experienceId) } : {}),
    title: activity.title,
    ...(activity.note ? { note: activity.note } : {}),
    startTimeMin: activity.startTimeMin,
    durationMin: activity.durationMin,
    order: activity.order,
    location: activity.location ?? null,
  };
}
