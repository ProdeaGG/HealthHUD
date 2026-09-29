import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST() {
    try {
        const today = new Date();
        today.setUTCHours(0,0,0,0);

        // Seed 14 days of HealthMetrics and WeightLogs
        let weight = 305.0;

        for (let i = 14; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            
            // Random fluctuations down (simulate weight loss)
            weight = weight - (Math.random() * 1.5) + (Math.random() * 0.5);

            await prisma.weightLog.upsert({
                where: { date: d },
                update: { weightLbs: parseFloat(weight.toFixed(1)) },
                create: { date: d, weightLbs: parseFloat(weight.toFixed(1)) }
            });

            await prisma.healthMetric.upsert({
                where: { date: d },
                update: {
                    steps: Math.floor(Math.random() * 5000) + 5000,
                    caloriesBurned: Math.floor(Math.random() * 1000) + 2000,
                    restingHeartRate: Math.floor(Math.random() * 15) + 60,
                    sleepHours: parseFloat((Math.random() * 3 + 5).toFixed(1)),
                    cardioSessions: Math.floor(Math.random() * 2), // 0 or 1
                    cardioMinutes: Math.floor(Math.random() * 45), // 0 to 45
                    strengthSessions: Math.random() > 0.5 ? 1 : 0 // 50% chance of strength workout
                },
                create: {
                    date: d,
                    steps: Math.floor(Math.random() * 5000) + 5000,
                    caloriesBurned: Math.floor(Math.random() * 1000) + 2000,
                    restingHeartRate: Math.floor(Math.random() * 15) + 60,
                    sleepHours: parseFloat((Math.random() * 3 + 5).toFixed(1)),
                    cardioSessions: Math.floor(Math.random() * 2),
                    cardioMinutes: Math.floor(Math.random() * 45),
                    strengthSessions: Math.random() > 0.5 ? 1 : 0
                }
            });
        }

        // Seed current body measurements
        await prisma.bodyMeasurement.create({
            data: {
                date: today,
                chest: 48.5,
                waist: 44.0,
                biceps: 16.0
            }
        });

        // Seed Goals
        await prisma.goal.upsert({ where: { metricName: 'Chest' }, update: { targetValue: 44.0 }, create: { metricName: 'Chest', targetValue: 44.0 }});
        await prisma.goal.upsert({ where: { metricName: 'Waist' }, update: { targetValue: 38.0 }, create: { metricName: 'Waist', targetValue: 38.0 }});
        await prisma.goal.upsert({ where: { metricName: 'Biceps' }, update: { targetValue: 18.0 }, create: { metricName: 'Biceps', targetValue: 18.0 }});

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to seed' }, { status: 500 });
    }
}
