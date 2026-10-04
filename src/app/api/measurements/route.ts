import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, chest, waist, biceps } = body;

    let targetDate: Date;
    if (date) {
      const m = String(date).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        targetDate = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
      } else {
        const d = new Date(date);
        targetDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      }
    } else {
      const now = new Date();
      targetDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    }

    const c = chest !== undefined && chest !== '' ? parseFloat(chest) : undefined;
    const w = waist !== undefined && waist !== '' ? parseFloat(waist) : undefined;
    const b = biceps !== undefined && biceps !== '' ? parseFloat(biceps) : undefined;

    const existing = await prisma.bodyMeasurement.findUnique({
      where: { date: targetDate }
    });

    const finalChest = c !== undefined && !isNaN(c) ? c : existing?.chest ?? null;
    const finalWaist = w !== undefined && !isNaN(w) ? w : existing?.waist ?? null;
    const finalBiceps = b !== undefined && !isNaN(b) ? b : existing?.biceps ?? null;

    const result = await prisma.bodyMeasurement.upsert({
      where: { date: targetDate },
      update: {
        chest: finalChest,
        waist: finalWaist,
        biceps: finalBiceps
      },
      create: {
        date: targetDate,
        chest: finalChest,
        waist: finalWaist,
        biceps: finalBiceps
      }
    });

    return NextResponse.json({ success: true, measurement: result });
  } catch (error: any) {
    console.error("Error saving measurements:", error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const latest = await prisma.bodyMeasurement.findFirst({
      orderBy: { date: 'desc' }
    });
    return NextResponse.json(latest || {});
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
