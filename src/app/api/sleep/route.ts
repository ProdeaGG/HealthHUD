import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, sleepHours, isManual = true } = body;

    if (!date || typeof date !== 'string') {
      return NextResponse.json({ ok: false, error: 'Valid date (YYYY-MM-DD) is required.' }, { status: 400 });
    }

    const parsedHours = parseFloat(sleepHours);
    if (isNaN(parsedHours) || parsedHours < 0 || parsedHours > 24) {
      return NextResponse.json({ ok: false, error: 'Sleep hours must be a number between 0 and 24.' }, { status: 400 });
    }

    const [year, month, day] = date.split('-').map(Number);
    if (!year || !month || !day) {
      return NextResponse.json({ ok: false, error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }

    const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ ok: false, error: 'Invalid date.' }, { status: 400 });
    }

    const roundedHours = parseFloat(parsedHours.toFixed(1));

    const updated = await prisma.healthMetric.upsert({
      where: { date: targetDate },
      update: {
        sleepHours: roundedHours,
        sleepManual: Boolean(isManual),
      },
      create: {
        date: targetDate,
        sleepHours: roundedHours,
        sleepManual: Boolean(isManual),
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Sleep hours for ${date} set to ${roundedHours} hrs (manual: ${Boolean(isManual)}).`,
      metric: updated,
    });
  } catch (error: any) {
    console.error('Error saving sleep hours:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Failed to save sleep hours.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');

    if (!dateStr) {
      return NextResponse.json({ ok: false, error: 'date query parameter is required.' }, { status: 400 });
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    const existing = await prisma.healthMetric.findUnique({ where: { date: targetDate } });
    if (!existing) {
      return NextResponse.json({ ok: true, message: 'No metric found to reset.' });
    }

    const updated = await prisma.healthMetric.update({
      where: { date: targetDate },
      data: {
        sleepManual: false,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Manual sleep override removed for ${dateStr}.`,
      metric: updated,
    });
  } catch (error: any) {
    console.error('Error resetting manual sleep status:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Failed to reset manual sleep.' }, { status: 500 });
  }
}
