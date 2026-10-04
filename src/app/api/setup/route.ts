import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.goals) {
      // Save goals (supports number or { target, start })
      for (const [metricName, val] of Object.entries(body.goals)) {
        let targetValue: number | undefined;
        let startValue: number | undefined;

        if (typeof val === 'object' && val !== null) {
          const t = parseFloat((val as any).target);
          const s = parseFloat((val as any).start);
          if (!isNaN(t)) targetValue = t;
          if (!isNaN(s)) startValue = s;
        } else {
          const t = parseFloat(val as any);
          if (!isNaN(t)) targetValue = t;
        }

        if (targetValue !== undefined) {
          await prisma.goal.upsert({
            where: { metricName },
            update: {
              targetValue,
              startValue: startValue !== undefined ? startValue : undefined
            },
            create: {
              metricName,
              targetValue,
              startValue: startValue !== undefined ? startValue : null
            }
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
  } catch (error: any) {
    console.error("Error saving setup:", error);
    return NextResponse.json({ error: error?.message || String(error) || 'Internal Server Error' }, { status: 500 });
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
