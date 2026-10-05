import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Use the server's local calendar day (TZ set in docker-compose), stored as UTC midnight
    // to match how the ingest endpoint saves dates.
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    // Current week bounds (Monday 00:00:00 UTC through next Monday 00:00:00 UTC)
    // In UTC: getUTCDay(): Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
    const dayOfWeek = today.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(today);
    startOfWeek.setUTCDate(today.getUTCDate() - diffToMonday);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 7); // next Monday midnight (exclusive)

    // Previous week bounds (for steps comparison)
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setUTCDate(startOfWeek.getUTCDate() - 7);

    // Rolling 7 days and 14 days (for rolling weight average & trend)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setUTCDate(today.getUTCDate() - 6);

    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setUTCDate(today.getUTCDate() - 13);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setUTCDate(today.getUTCDate() - 30);

    const settings = await prisma.settings.findUnique({ where: { id: 'global' } });

    // 1. Get recent health metrics (up to 30 days ago to cover previous weeks & rolling averages)
    const recentMetrics = await prisma.healthMetric.findMany({
        where: { date: { gte: thirtyDaysAgo } },
        orderBy: { date: 'asc' }
    });

    // 2. Get latest weight
    const latestWeight = await prisma.weightLog.findFirst({
        orderBy: { date: 'desc' }
    });

    // 3. Get latest and earliest body measurements (for baseline progress tracking)
    const latestMeasurements = await prisma.bodyMeasurement.findFirst({
        orderBy: { date: 'desc' }
    });
    const earliestMeasurements = await prisma.bodyMeasurement.findFirst({
        orderBy: { date: 'asc' }
    });

    // 4. Get Goals
    const goals = await prisma.goal.findMany();
    const getGoal = (name: string) => goals.find(g => g.metricName === name)?.targetValue || 0;
    const getGoalObj = (name: string) => goals.find(g => g.metricName === name);

    // 5. Get recent workouts for current week breakdown (Monday through Sunday)
    let recentWorkouts: any[] = [];
    try {
        recentWorkouts = await prisma.workout.findMany({
            where: { date: { gte: startOfWeek, lt: endOfWeek } },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
        });
    } catch {
        // Table might not exist yet if db push hasn't run
        recentWorkouts = [];
    }

    // Averages logic
    const thisWeekMetrics = recentMetrics.filter(m => m.date >= startOfWeek && m.date < endOfWeek);
    const lastWeekMetrics = recentMetrics.filter(m => m.date >= startOfLastWeek && m.date < startOfWeek);
    const rollingSevenDayMetrics = recentMetrics.filter(m => m.date >= sevenDaysAgo);

    const thisWeekStepsAvg = thisWeekMetrics.length > 0
        ? thisWeekMetrics.reduce((acc, m) => acc + (m.steps || 0), 0) / thisWeekMetrics.length
        : 0;
    const lastWeekStepsAvg = lastWeekMetrics.length > 0
        ? lastWeekMetrics.reduce((acc, m) => acc + (m.steps || 0), 0) / lastWeekMetrics.length
        : 0;
    
    const sleepAvg = rollingSevenDayMetrics.length > 0
        ? rollingSevenDayMetrics.reduce((acc, m) => acc + (m.sleepHours || 0), 0) / rollingSevenDayMetrics.length
        : 0;

    // Calculate 7-Day Weight Rolling Average
    const recentWeights = await prisma.weightLog.findMany({
        where: { date: { gte: sevenDaysAgo } }
    });
    const currentSevenDayAvg = recentWeights.length > 0 
        ? recentWeights.reduce((acc, w) => acc + w.weightLbs, 0) / recentWeights.length
        : latestWeight?.weightLbs || 0;
    
    const weightSevenDayAvg = currentSevenDayAvg.toFixed(1);

    // Calculate Trend (Previous 7 Days)
    const previousWeights = await prisma.weightLog.findMany({
        where: { date: { gte: fourteenDaysAgo, lt: sevenDaysAgo } }
    });
    
    let weightTrendStr = '';
    if (previousWeights.length > 0 && recentWeights.length > 0) {
        const prevSevenDayAvg = previousWeights.reduce((acc, w) => acc + w.weightLbs, 0) / previousWeights.length;
        const trend = currentSevenDayAvg - prevSevenDayAvg;
        weightTrendStr = trend > 0 ? `+${trend.toFixed(1)}` : trend.toFixed(1);
    }

    // Helper: format duration in MM:SS
    const formatDuration = (sec: number): string => {
        if (!sec || isNaN(sec) || sec <= 0) return '0:00';
        const totalSec = Math.round(sec);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Build 7-day arrays (Mon-Sun)
    // getDay() returns 0 for Sunday, 1 for Monday... 
    // We want Mon=0, Tue=1, ..., Sun=6
    const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const sleepMap = new Map(thisWeekMetrics.map(m => {
        let d = m.date.getUTCDay();
        d = d === 0 ? 6 : d - 1; // Convert to Mon=0, Sun=6
        return [d, m.sleepHours || 0];
    }));
    const sleepDataArray = [0, 1, 2, 3, 4, 5, 6].map(i => ({ day: dayNames[i], hours: sleepMap.get(i) || 0 }));

    // Array for Strength workouts logic (Mon-Sun)
    const strengthMap = new Map(thisWeekMetrics.map(m => {
        let d = m.date.getUTCDay();
        d = d === 0 ? 6 : d - 1; 
        return [d, (m.strengthSessions || 0) > 0]; 
    }));
    const strengthDaysArray = [0, 1, 2, 3, 4, 5, 6].map(i => strengthMap.get(i) || false);

    // Build cardio workouts list for hover popover
    let cardioWorkoutsList = recentWorkouts
        .filter(w => w.type === 'cardio')
        .map(w => {
            const d = new Date(w.date);
            const dateStr = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
            const totalSec = (w as any).durationSec ?? (w.durationMins ? Math.round(w.durationMins * 60) : 0);
            return {
                id: w.id,
                name: w.name,
                date: dateStr,
                durationFormatted: formatDuration(totalSec),
                durationMins: w.durationMins,
                avgHeartRate: w.avgHeartRate ? Math.round(w.avgHeartRate) : null,
                calories: w.calories
            };
        });

    // Fallback: If no individual workout rows exist yet in the Workout table for this week,
    // but thisWeekMetrics recorded cardio sessions (e.g. from earlier sync or metric-only export),
    // synthesize the entries so the hover breakdown displays accurately instead of being empty!
    if (cardioWorkoutsList.length === 0) {
        for (const m of thisWeekMetrics) {
            const count = m.cardioSessions || 0;
            if (count > 0) {
                const d = new Date(m.date);
                const dateStr = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
                const totalMins = m.cardioMinutes || 0;
                const minsPerSession = Math.round(totalMins / count);
                for (let i = 0; i < count; i++) {
                    cardioWorkoutsList.push({
                        id: `metric_cardio_${m.id}_${i}`,
                        name: 'Cardio',
                        date: dateStr,
                        durationFormatted: formatDuration(minsPerSession * 60),
                        durationMins: minsPerSession,
                        avgHeartRate: m.cardioHeartRateAvg ? Math.round(m.cardioHeartRateAvg) : null,
                        calories: null
                    });
                }
            }
        }
    }

    // Cardio Average Heart Rate (from workouts classified as cardio in the current week)
    const cardioWorkoutsWithHr = cardioWorkoutsList.filter(w => (w.avgHeartRate || 0) > 0);
    let cardioHrAvg: number | null = null;
    if (cardioWorkoutsWithHr.length > 0) {
        cardioHrAvg = Math.round(cardioWorkoutsWithHr.reduce((acc, w) => acc + w.avgHeartRate!, 0) / cardioWorkoutsWithHr.length);
    } else {
        const cardioMetricsWithHr = thisWeekMetrics.filter(m => (m.cardioHeartRateAvg || 0) > 0);
        if (cardioMetricsWithHr.length > 0) {
            cardioHrAvg = Math.round(cardioMetricsWithHr.reduce((acc, m) => acc + (m.cardioHeartRateAvg || 0), 0) / cardioMetricsWithHr.length);
        }
    }

    // Build strength workouts by day index (Mon=0 .. Sun=6)
    const strengthWorkoutsByDay = [0, 1, 2, 3, 4, 5, 6].map(dayIdx => {
        const dayDate = new Date(startOfWeek);
        dayDate.setUTCDate(startOfWeek.getUTCDate() + dayIdx);
        const dayDateStr = `${dayDate.getUTCMonth() + 1}/${dayDate.getUTCDate()}`;

        const dayWorkouts = recentWorkouts
            .filter(w => {
                if (w.type !== 'strength') return false;
                let d = new Date(w.date).getUTCDay();
                d = d === 0 ? 6 : d - 1;
                return d === dayIdx;
            })
            .map(w => {
                const totalSec = (w as any).durationSec ?? (w.durationMins ? Math.round(w.durationMins * 60) : 0);
                return {
                    id: w.id,
                    name: w.name,
                    date: dayDateStr,
                    durationFormatted: formatDuration(totalSec),
                    durationMins: w.durationMins,
                    calories: w.calories
                };
            });

        // Fallback for this specific day if HealthMetric recorded strengthSessions > 0
        if (dayWorkouts.length === 0 && strengthDaysArray[dayIdx]) {
            dayWorkouts.push({
                id: `fallback_${dayIdx}`,
                name: 'Strength Training',
                date: dayDateStr,
                durationFormatted: '30:00',
                durationMins: 30,
                calories: null
            });
        }

        return dayWorkouts;
    });

    // All strength workouts this week
    let allStrengthWorkouts = recentWorkouts
        .filter(w => w.type === 'strength')
        .map(w => {
            const d = new Date(w.date);
            const dateStr = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
            const totalSec = (w as any).durationSec ?? (w.durationMins ? Math.round(w.durationMins * 60) : 0);
            return {
                id: w.id,
                name: w.name,
                date: dateStr,
                durationFormatted: formatDuration(totalSec),
                durationMins: w.durationMins,
                calories: w.calories
            };
        });

    if (allStrengthWorkouts.length === 0) {
        for (const m of thisWeekMetrics) {
            const count = m.strengthSessions || 0;
            if (count > 0) {
                const d = new Date(m.date);
                const dateStr = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
                for (let i = 0; i < count; i++) {
                    allStrengthWorkouts.push({
                        id: `metric_str_${m.id}_${i}`,
                        name: 'Strength Training',
                        date: dateStr,
                        durationFormatted: '30:00',
                        durationMins: 30,
                        calories: null
                    });
                }
            }
        }
    }

    // Payload to frontend
    const dashboardData = {
        lastSynced: {
            appleHealth: settings?.lastAppleSyncAt || (recentMetrics.length > 0 ? recentMetrics[recentMetrics.length - 1].updatedAt : null),
            appleHealthStatus: settings?.lastAppleSyncStatus || null,
            withings: latestWeight?.createdAt || null
        },
        vitals: {
            weightLbs: latestWeight?.weightLbs || 0,
            weightSevenDayAvg,
            weightTrend: weightTrendStr,
            steps: {
                thisWeekDailyAvg: Math.round(thisWeekStepsAvg),
                lastWeekDailyAvg: Math.round(lastWeekStepsAvg),
                difference: Math.round(thisWeekStepsAvg - lastWeekStepsAvg)
            }
        },
        consistency: {
            strengthDays: strengthDaysArray,
            strengthSessions: thisWeekMetrics.reduce((acc, m) => acc + (m.strengthSessions || 0), 0),
            strengthTarget: getGoal('StrengthSessions') || 4,
            strengthWorkoutsByDay,
            strengthWorkouts: allStrengthWorkouts,
            dailyBurnAvg: thisWeekMetrics.length > 0 
                ? thisWeekMetrics.reduce((acc, m) => acc + (m.caloriesBurned || 0), 0) / thisWeekMetrics.length 
                : 0,
            heartRateAvg: cardioHrAvg,
            cardioSessions: thisWeekMetrics.reduce((acc, m) => acc + (m.cardioSessions || 0), 0),
            cardioMinutes: thisWeekMetrics.reduce((acc, m) => acc + (m.cardioMinutes || 0), 0),
            cardioWorkouts: cardioWorkoutsList
        },
        recovery: {
            sleepHours: thisWeekMetrics[thisWeekMetrics.length - 1]?.sleepHours || 0, // Last recorded night
            sevenDayAvg: sleepAvg.toFixed(1),
            sleepData: sleepDataArray
        },
        measurements: [
            { name: 'Chest', key: 'chest', goalName: 'Chest' },
            { name: 'Waist (bb)', key: 'waist', goalName: 'Waist' },
            { name: 'Biceps', key: 'biceps', goalName: 'Biceps' }
        ].map(spec => {
            const g = getGoalObj(spec.goalName);
            const target = g?.targetValue || 0;
            const current = (latestMeasurements as any)?.[spec.key] || 0;
            const fallbackStart = (earliestMeasurements as any)?.[spec.key] || current;
            const start = g?.startValue !== null && g?.startValue !== undefined ? g.startValue : fallbackStart;

            const totalSpan = Math.abs(target - start);
            let progressPercent = 0;

            if (totalSpan > 0 && current > 0) {
                let achieved = 0;
                if (target < start) {
                    // Cutting / reduction goal (e.g. Chest 53 -> 44)
                    achieved = start - current;
                } else {
                    // Growth goal (e.g. Biceps 19 -> 22)
                    achieved = current - start;
                }
                progressPercent = Math.max(0, Math.min(100, Math.round((achieved / totalSpan) * 100)));
            } else if (current > 0 && target > 0 && current === target) {
                progressPercent = 100;
            }

            return {
                name: spec.name,
                key: spec.key,
                goalName: spec.goalName,
                start: start || current,
                current,
                goal: target,
                diff: Math.abs(current - target).toFixed(1),
                progressPercent
            };
        })
    };

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error("Dashboard Aggregation Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
