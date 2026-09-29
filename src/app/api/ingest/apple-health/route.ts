import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const apiKey = request.headers.get('x-api-key');
    const EXPECTED_API_KEY = process.env.APPLE_HEALTH_API_KEY;

    if (EXPECTED_API_KEY && apiKey !== EXPECTED_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const metrics = body?.data?.metrics || [];
    const workouts = body?.data?.workouts || [];

    // Temporary map to aggregate daily data
    const dailyData = new Map<string, any>();

    const getDayObj = (dateStr: string) => {
      const d = new Date(dateStr);
      d.setUTCHours(0, 0, 0, 0);
      const key = d.toISOString();
      if (!dailyData.has(key)) dailyData.set(key, { date: d, steps: 0, caloriesBurned: 0, sleepHours: 0, restingHeartRate: null, hrCount: 0, cardioSessions: 0, cardioMinutes: 0, strengthSessions: 0 });
      return dailyData.get(key);
    };

    // 1. Process Metrics
    for (const metric of metrics) {
      const name = metric.name; 
      for (const dataPoint of metric.data) {
        const day = getDayObj(dataPoint.date);
        const qty = parseFloat(dataPoint.qty);

        if (name === 'step_count') {
            day.steps += qty;
        } else if (name === 'active_energy') {
            day.caloriesBurned += qty;
        } else if (name === 'resting_heart_rate') {
            day.restingHeartRate = (day.restingHeartRate * day.hrCount + qty) / (day.hrCount + 1);
            day.hrCount++;
        } else if (name === 'sleep_analysis') {
            // HAE typically exports sleep as hours. If qty is too large, it might be minutes. We assume hours if < 24.
            const hours = qty > 24 ? qty / 60 : qty;
            day.sleepHours += hours;
        }
      }
    }

    // 2. Process Workouts
    for (const w of workouts) {
        const day = getDayObj(w.start);
        const name = (w.name || '').toLowerCase();
        
        let durationMins = w.duration || 0;
        if (!durationMins && w.start && w.end) {
            durationMins = (new Date(w.end).getTime() - new Date(w.start).getTime()) / 60000;
        }

        if (name.includes('strength') || name.includes('weight') || name.includes('functional')) {
            day.strengthSessions += 1;
        } else {
            day.cardioSessions += 1;
            day.cardioMinutes += Math.round(durationMins);
        }
    }

    // 3. Upsert into Database
    for (const [key, day] of Array.from(dailyData.entries())) {
        const { hrCount, ...updateData } = day;
        
        // Fetch existing to add to totals if needed, but HAE typically exports "Daily" aggregates.
        // Assuming HAE is configured to export "Daily" aggregates, so we just overwrite.
        await prisma.healthMetric.upsert({
            where: { date: day.date },
            update: {
                steps: day.steps > 0 ? Math.round(day.steps) : undefined,
                caloriesBurned: day.caloriesBurned > 0 ? Math.round(day.caloriesBurned) : undefined,
                restingHeartRate: day.restingHeartRate ? Math.round(day.restingHeartRate) : undefined,
                sleepHours: day.sleepHours > 0 ? parseFloat(day.sleepHours.toFixed(1)) : undefined,
                cardioSessions: day.cardioSessions > 0 ? day.cardioSessions : undefined,
                cardioMinutes: day.cardioMinutes > 0 ? day.cardioMinutes : undefined,
                strengthSessions: day.strengthSessions > 0 ? day.strengthSessions : undefined
            },
            create: {
                date: day.date,
                steps: Math.round(day.steps),
                caloriesBurned: Math.round(day.caloriesBurned),
                restingHeartRate: day.restingHeartRate ? Math.round(day.restingHeartRate) : null,
                sleepHours: parseFloat(day.sleepHours.toFixed(1)),
                cardioSessions: day.cardioSessions,
                cardioMinutes: day.cardioMinutes,
                strengthSessions: day.strengthSessions
            }
        });
    }

    return NextResponse.json({ success: true, message: `Ingested ${dailyData.size} days of data` }, { status: 200 });
  } catch (error) {
    console.error("Error ingesting Apple Health data:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
