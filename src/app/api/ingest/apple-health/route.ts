import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Health Auto Export (HAE) webhook.
 *
 * Expected payload (HAE "REST API", JSON, Export Version v2):
 * { data: { metrics: [{ name, units, data: [{ date, qty, ... }] }], workouts: [{ name, start, end, duration, ... }] } }
 *
 * Notes on HAE quirks handled here:
 *  - Dates look like "2026-10-04 00:00:00 -0400". We take the calendar date as written (the phone's local day)
 *    rather than converting through UTC, so late-evening data never shifts to the next day.
 *  - sleep_analysis (summarized) has no `qty`; it reports `totalSleep` / `asleep` (hours) instead.
 *  - active_energy may be reported in kJ depending on phone settings.
 *  - Workout `duration` is in seconds in v2.
 *  - "All Selected" sends dozens of metrics we don't use; they're counted and ignored.
 */

// Quick reachability test: open this URL in Safari on your phone.
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'HealthHUD Apple Health endpoint is reachable. Health Auto Export should send data here with POST.',
  });
}

type Day = {
  date: Date;
  steps?: number;
  caloriesBurned?: number;
  sleepHours?: number;
  hrSum: number;
  hrCount: number;
  cardioSessions?: number;
  cardioMinutes?: number;
  cardioHrSum: number;
  cardioHrCount: number;
  strengthSessions?: number;
};

function toDayDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

async function recordSync(status: string) {
  try {
    await prisma.settings.upsert({
      where: { id: 'global' },
      update: { lastAppleSyncAt: new Date(), lastAppleSyncStatus: status },
      create: { id: 'global', lastAppleSyncAt: new Date(), lastAppleSyncStatus: status },
    });
  } catch (e) {
    console.error('[apple-health] Could not record sync status:', e);
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let body: any;

  try {
    body = await request.json();
  } catch (e: any) {
    const msg = `Payload was not valid JSON (${e?.message}). Check Export Format = JSON in Health Auto Export.`;
    console.error('[apple-health]', msg);
    await recordSync(`Error: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const apiKey = request.headers.get('x-api-key');
    const EXPECTED_API_KEY = process.env.APPLE_HEALTH_API_KEY;
    if (EXPECTED_API_KEY && apiKey !== EXPECTED_API_KEY) {
      await recordSync('Error: Unauthorized (wrong x-api-key header)');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const metrics: any[] = Array.isArray(body?.data?.metrics) ? body.data.metrics : [];
    const workouts: any[] = Array.isArray(body?.data?.workouts) ? body.data.workouts : [];

    console.log(`[apple-health] Received ${metrics.length} metrics, ${workouts.length} workouts. Names: ${metrics.map(m => m?.name).join(', ')}`);

    const days = new Map<string, Day>();
    const getDay = (dateStr: unknown): Day | null => {
      const d = toDayDate(dateStr);
      if (!d) return null;
      const key = d.toISOString();
      if (!days.has(key)) days.set(key, { date: d, hrSum: 0, hrCount: 0, cardioHrSum: 0, cardioHrCount: 0 });
      return days.get(key)!;
    };

    const used: Record<string, number> = {};
    const ignored = new Set<string>();

    // 1. Metrics
    for (const metric of metrics) {
      const name: string = metric?.name || '';
      const units: string = (metric?.units || '').toLowerCase();
      const points: any[] = Array.isArray(metric?.data) ? metric.data : [];

      const handled = ['step_count', 'active_energy', 'resting_heart_rate', 'sleep_analysis'].includes(name);
      if (!handled) { ignored.add(name); continue; }

      for (const p of points) {
        const day = getDay(p?.date ?? p?.sleepStart ?? p?.startDate);
        if (!day) continue;

        if (name === 'step_count') {
          const q = num(p.qty); if (q === null) continue;
          day.steps = (day.steps || 0) + q;
        } else if (name === 'active_energy') {
          let q = num(p.qty); if (q === null) continue;
          if (units === 'kj') q = q / 4.184;
          day.caloriesBurned = (day.caloriesBurned || 0) + q;
        } else if (name === 'resting_heart_rate') {
          const q = num(p.qty); if (q === null) continue;
          day.hrSum += q; day.hrCount += 1;
        } else if (name === 'sleep_analysis') {
          // Summarized v2: totalSleep / asleep in hours. Fallback to qty for older formats.
          let h = num(p.totalSleep) ?? num(p.asleep) ?? num(p.qty);
          if (h === null) {
            const core = num(p.core) || 0, deep = num(p.deep) || 0, rem = num(p.rem) || 0;
            h = core + deep + rem || null;
          }
          if (h === null) continue;
          if (h > 24) h = h / 60; // reported in minutes
          day.sleepHours = (day.sleepHours || 0) + h;
        }
        used[name] = (used[name] || 0) + 1;
      }
    }

    // 2. Workouts (only present if an automation uses Data Type = Workouts)
    for (const w of workouts) {
      const day = getDay(w?.start);
      if (!day) continue;
      const rawName = String(w?.name || 'Workout');
      const name = rawName.toLowerCase();

      let minutes = 0;
      const s = w?.start ? new Date(String(w.start).replace(' ', 'T').replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2')) : null;
      const e = w?.end ? new Date(String(w.end).replace(' ', 'T').replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2')) : null;
      if (s && e && !isNaN(s.getTime()) && !isNaN(e.getTime())) minutes = (e.getTime() - s.getTime()) / 60000;
      else if (num(w?.duration) !== null) minutes = num(w.duration)! / 60; // v2: seconds

      // Extract workout average heart rate if provided by HAE
      const workoutHr = num(w?.avgHeartRate) ?? num(w?.avg_heart_rate) ?? num(w?.averageHeartRate) ?? num(w?.heartRate?.avg) ?? num(w?.heartRate) ?? num(w?.heart_rate?.avg) ?? num(w?.heart_rate);
      const cals = num(w?.activeEnergy) ?? num(w?.active_energy) ?? num(w?.calories) ?? num(w?.totalEnergyBurned);

      const isStrength = name.includes('strength') || name.includes('weight') || name.includes('functional') || name.includes('core');
      const workoutType = isStrength ? 'strength' : 'cardio';

      if (isStrength) {
        day.strengthSessions = (day.strengthSessions || 0) + 1;
      } else {
        day.cardioSessions = (day.cardioSessions || 0) + 1;
        day.cardioMinutes = (day.cardioMinutes || 0) + Math.round(minutes);
        if (workoutHr && workoutHr > 40 && workoutHr < 240) {
          day.cardioHrSum += workoutHr;
          day.cardioHrCount += 1;
        }
      }

      // Save individual workout record for detailed inspection/hover lists
      try {
        const extId = String(w?.id || w?.uuid || `${day.date.toISOString()}_${s ? s.toISOString() : ''}_${rawName}_${Math.round(minutes)}`);
        await prisma.workout.upsert({
          where: { externalId: extId },
          update: {
            date: day.date,
            startTime: s && !isNaN(s.getTime()) ? s : null,
            name: rawName,
            type: workoutType,
            durationMins: Math.round(minutes),
            calories: cals ? Math.round(cals) : null,
            avgHeartRate: workoutHr ? Math.round(workoutHr) : null,
          },
          create: {
            externalId: extId,
            date: day.date,
            startTime: s && !isNaN(s.getTime()) ? s : null,
            name: rawName,
            type: workoutType,
            durationMins: Math.round(minutes),
            calories: cals ? Math.round(cals) : null,
            avgHeartRate: workoutHr ? Math.round(workoutHr) : null,
          }
        });
      } catch (err) {
        console.error('[apple-health] Could not save individual workout:', err);
      }

      used['workouts'] = (used['workouts'] || 0) + 1;
    }

    // 3. Save. Only overwrite fields that were actually present in this export,
    //    so a metrics-only export never wipes workout counts (and vice versa).
    for (const day of Array.from(days.values())) {
      const data: any = {};
      if (day.steps !== undefined) data.steps = Math.round(day.steps);
      if (day.caloriesBurned !== undefined) data.caloriesBurned = Math.round(day.caloriesBurned);
      if (day.hrCount > 0) data.restingHeartRate = Math.round(day.hrSum / day.hrCount);
      if (day.sleepHours !== undefined) data.sleepHours = parseFloat(day.sleepHours.toFixed(1));
      if (day.cardioSessions !== undefined) data.cardioSessions = day.cardioSessions;
      if (day.cardioMinutes !== undefined) data.cardioMinutes = day.cardioMinutes;
      if (day.cardioHrCount > 0) data.cardioHeartRateAvg = Math.round(day.cardioHrSum / day.cardioHrCount);
      if (day.strengthSessions !== undefined) data.strengthSessions = day.strengthSessions;
      if (Object.keys(data).length === 0) continue;

      await prisma.healthMetric.upsert({
        where: { date: day.date },
        update: data,
        create: { date: day.date, ...data },
      });
    }

    const usedSummary = Object.entries(used).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none';
    const status = `OK: ${days.size} day(s) saved (${usedSummary}) in ${Date.now() - startedAt}ms`;
    console.log(`[apple-health] ${status}. Ignored metrics: ${ignored.size}`);
    await recordSync(status);

    return NextResponse.json({ success: true, message: status, ignoredMetrics: Array.from(ignored) }, { status: 200 });
  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error('[apple-health] Error ingesting:', error);
    await recordSync(`Error: ${msg.slice(0, 300)}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
