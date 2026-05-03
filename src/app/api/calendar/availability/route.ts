import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { vaultService } from '@/lib/vault';

const SLOT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const BUSINESS_HOUR_START = 9; // 9am
const BUSINESS_HOUR_END = 18; // 6pm

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return Response.json(
      { error: 'startDate and endDate query params are required' },
      { status: 400 }
    );
  }

  const rangeStart = new Date(startDate);
  const rangeEnd = new Date(endDate);

  if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
    return Response.json({ error: 'Invalid date format' }, { status: 400 });
  }

  if (rangeEnd <= rangeStart) {
    return Response.json(
      { error: 'endDate must be after startDate' },
      { status: 400 }
    );
  }

  try {
    const entries = await vaultService.query(userId, {
      entryType: 'calendar_event',
    });

    // Extract busy intervals from calendar events within the range
    const busyIntervals = entries
      .filter((e) => e.decryptedData.type === 'calendar_event')
      .map((e) => {
        const data = e.decryptedData.data as { startTime: string; endTime: string };
        return { start: new Date(data.startTime), end: new Date(data.endTime) };
      })
      .filter((interval) => interval.start < rangeEnd && interval.end > rangeStart);

    // Generate 30-min business-hour slots and filter out busy ones
    const availableSlots: { start: string; end: string }[] = [];
    const current = new Date(rangeStart);
    current.setHours(0, 0, 0, 0);

    while (current < rangeEnd) {
      const hour = current.getHours();

      if (hour >= BUSINESS_HOUR_START && hour < BUSINESS_HOUR_END) {
        const slotStart = new Date(current);
        const slotEnd = new Date(current.getTime() + SLOT_DURATION_MS);

        // Only include slots within the requested range
        if (slotStart >= rangeStart && slotEnd <= rangeEnd) {
          const isBusy = busyIntervals.some(
            (busy) => slotStart < busy.end && slotEnd > busy.start
          );

          if (!isBusy) {
            availableSlots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
            });
          }
        }
      }

      current.setTime(current.getTime() + SLOT_DURATION_MS);
    }

    return Response.json({ availableSlots });
  } catch (error) {
    return Response.json(
      { error: 'Failed to compute availability' },
      { status: 500 }
    );
  }
}
