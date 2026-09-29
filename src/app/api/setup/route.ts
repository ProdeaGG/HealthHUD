import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.goals) {
      // Save goals
      for (const [metricName, targetValue] of Object.entries(body.goals)) {
        if (!isNaN(targetValue as number)) {
          await prisma.goal.upsert({
            where: { metricName },
            update: { targetValue: targetValue as number },
            create: { metricName, targetValue: targetValue as number }
          });
        }
      }
    } else {
      // Upsert the global settings record
      await prisma.settings.upsert({
        where: { id: 'global' },
        update: body,
        create: { id: 'global', ...body }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving setup:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
    try {
        const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
        return NextResponse.json(settings || { setupComplete: false });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
