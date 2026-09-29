import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to get ISO week string (e.g. "2023-W41")
function getWeekYearString(date: Date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

export async function GET() {
    try {
        const metrics = await prisma.healthMetric.findMany({
            orderBy: { date: 'asc' }
        });

        // Group by week
        const weeks = new Map<string, any[]>();
        
        metrics.forEach(m => {
            const weekStr = getWeekYearString(new Date(m.date));
            if (!weeks.has(weekStr)) weeks.set(weekStr, []);
            weeks.get(weekStr)!.push(m);
        });

        // Calculate aggregates per week
        const weeklySummary = Array.from(weeks.entries()).map(([week, days]) => {
            const count = days.length;
            const hrDays = days.filter(d => d.restingHeartRate != null);
            const sleepDays = days.filter(d => d.sleepHours != null && d.sleepHours > 0);

            return {
                week,
                daysRecorded: count,
                
                // Totals
                totalSteps: days.reduce((sum, d) => sum + (d.steps || 0), 0),
                totalCardioMinutes: days.reduce((sum, d) => sum + (d.cardioMinutes || 0), 0),
                totalCardioSessions: days.reduce((sum, d) => sum + (d.cardioSessions || 0), 0),
                totalStrengthSessions: days.reduce((sum, d) => sum + (d.strengthSessions || 0), 0),
                
                // Averages
                avgCaloriesBurned: count > 0 ? Math.round(days.reduce((sum, d) => sum + (d.caloriesBurned || 0), 0) / count) : 0,
                avgStepsPerDay: count > 0 ? Math.round(days.reduce((sum, d) => sum + (d.steps || 0), 0) / count) : 0,
                avgRestingHeartRate: hrDays.length > 0 ? Math.round(hrDays.reduce((sum, d) => sum + (d.restingHeartRate || 0), 0) / hrDays.length) : null,
                avgSleepHours: sleepDays.length > 0 ? parseFloat((sleepDays.reduce((sum, d) => sum + (d.sleepHours || 0), 0) / sleepDays.length).toFixed(1)) : 0
            };
        });

        return NextResponse.json({ success: true, data: weeklySummary });
    } catch (error) {
        console.error("Error generating weekly summary:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
