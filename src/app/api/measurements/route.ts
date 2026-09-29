import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { chest, waist, biceps } = body;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await prisma.bodyMeasurement.upsert({
      where: { date: today },
      update: { chest, waist, biceps },
      create: { date: today, chest, waist, biceps }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving measurements:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
