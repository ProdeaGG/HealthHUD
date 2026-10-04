import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Use the server's local calendar day (TZ set in docker-compose), stored as UTC midnight
    // to match how the ingest endpoint saves dates.
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setUTCDate(today.getUTCDate() - 6); // 7 days inclusive (today + 6 previous days)

    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setUTCDate(today.getUTCDate() - 13); // 7 days prior to that

    const settings = await prisma.settings.findUnique({ where: { id: 'global' } });

    // 1. Get recent health metrics
    const recentMetrics = await prisma.healthMetric.findMany({
        where: { date: { gte: fourteenDaysAgo } },
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

    // 5. Get recent workouts for current week breakdown
    let recentWorkouts: any[] = [];
    try {
        recentWorkouts = await prisma.workout.findMany({
            where: { date: { gte: sevenDaysAgo } },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
        });
    } catch {
        // Table might not exist yet if db push hasn't run
        recentWorkouts = [];
    }

    // Averages logic
    const thisWeekMetrics = recentMetrics.filter(m => m.date >= sevenDaysAgo);
    const lastWeekMetrics = recentMetrics.filter(m => m.date >= fourteenDaysAgo && m.date < sevenDaysAgo);

    const thisWeekStepsAvg = thisWeekMetrics.reduce((acc, m) => acc + (m.steps || 0), 0) / (thisWeekMetrics.length || 1);
    const lastWeekStepsAvg = lastWeekMetrics.reduce((acc, m) => acc + (m.steps || 0), 0) / (lastWeekMetrics.length || 1);
    
    const sleepAvg = thisWeekMetrics.reduce((acc, m) => acc + (m.sleepHours || 0), 0) / (thisWeekMetrics.length || 1);

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

    // Cardio Average Heart Rate (only from workouts classified as cardio)
    const cardioMetricsWithHr = thisWeekMetrics.filter(m => (m.cardioHeartRateAvg || 0) > 0);
    const cardioHrAvg = cardioMetricsWithHr.length > 0
        ? Math.round(cardioMetricsWithHr.reduce((acc, m) => acc + (m.cardioHeartRateAvg || 0), 0) / cardioMetricsWithHr.length)
        : null;

    // Build cardio workouts list for hover popover
    const cardioWorkoutsList = recentWorkouts
        .filter(w => w.type === 'cardio')
        .map(w => {
            const d = new Date(w.date).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
            return {
                name: w.name,
                date: d,
                durationMins: w.durationMins,
                avgHeartRate: w.avgHeartRate,
                calories: w.calories
            };
        });

    // Build strength workouts by day index (Mon=0 .. Sun=6)
    const strengthWorkoutsByDay = [0, 1, 2, 3, 4, 5, 6].map(dayIdx => {
        return recentWorkouts
            .filter(w => {
                if (w.type !== 'strength') return false;
                let d = new Date(w.date).getUTCDay();
                d = d === 0 ? 6 : d - 1;
                return d === dayIdx;
            })
            .map(w => ({
                name: w.name,
                durationMins: w.durationMins,
                calories: w.calories,
                avgHeartRate: w.avgHeartRate
            }));
    });

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
            dailyBurnAvg: thisWeekMetrics.reduce((acc, m) => acc + (m.caloriesBurned || 0), 0) / (thisWeekMetrics.length || 1),
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
