import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, weightLbs } = body;

    if (!date || !weightLbs) {
      return NextResponse.json({ error: 'Missing date or weightLbs' }, { status: 400 });
    }

    const parsedDate = new Date(date);
    // Ensure the date is saved at midnight UTC to prevent time zone shifting
    parsedDate.setUTCHours(0, 0, 0, 0);

    await prisma.weightLog.upsert({
      where: { date: parsedDate },
      update: { weightLbs: parseFloat(weightLbs) },
      create: { date: parsedDate, weightLbs: parseFloat(weightLbs) }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error saving manual weight:", error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
