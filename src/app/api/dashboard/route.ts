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

    // 3. Get latest body measurements
    const latestMeasurements = await prisma.bodyMeasurement.findFirst({
        orderBy: { date: 'desc' }
    });

    // 4. Get Goals
    const goals = await prisma.goal.findMany();
    const getGoal = (name: string) => goals.find(g => g.metricName === name)?.targetValue || 0;

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
            dailyBurnAvg: thisWeekMetrics.reduce((acc, m) => acc + (m.caloriesBurned || 0), 0) / (thisWeekMetrics.length || 1),
            heartRateAvg: thisWeekMetrics.reduce((acc, m) => acc + (m.restingHeartRate || 0), 0) / (thisWeekMetrics.length || 1),
            cardioSessions: thisWeekMetrics.reduce((acc, m) => acc + (m.cardioSessions || 0), 0),
            cardioMinutes: thisWeekMetrics.reduce((acc, m) => acc + (m.cardioMinutes || 0), 0)
        },
        recovery: {
            sleepHours: thisWeekMetrics[thisWeekMetrics.length - 1]?.sleepHours || 0, // Last recorded night
            sevenDayAvg: sleepAvg.toFixed(1),
            sleepData: sleepDataArray
        },
        measurements: [
            { name: 'Chest', current: latestMeasurements?.chest || 0, goal: getGoal('Chest') },
            { name: 'Waist (bb)', current: latestMeasurements?.waist || 0, goal: getGoal('Waist') },
            { name: 'Biceps', current: latestMeasurements?.biceps || 0, goal: getGoal('Biceps') }
        ].map(m => ({
            ...m,
            diff: Math.abs(m.current - m.goal).toFixed(1)
        }))
    };

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error("Dashboard Aggregation Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
