import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
    
    if (!settings || !settings.withingsClientId || !settings.withingsClientSecret || !settings.withingsRefreshToken) {
      return NextResponse.json({ error: 'Withings is not fully configured. Missing credentials or refresh token.' }, { status: 400 });
    }

    console.log("Starting Withings Sync...");

    // 1. ALWAYS Refresh the Token first to guarantee we never time out
    // Withings access tokens expire quickly, but refresh tokens last up to a year.
    // Every time we use a refresh token, we get a NEW one. We MUST save it.
    const tokenResponse = await fetch('https://wbsapi.withings.net/v2/oauth2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action: 'requesttoken',
        grant_type: 'refresh_token',
        client_id: settings.withingsClientId,
        client_secret: settings.withingsClientSecret,
        refresh_token: settings.withingsRefreshToken,
      }),
    });
    
    const tokenData = await tokenResponse.json();

    if (tokenData.status !== 0 || !tokenData.body) {
      console.error("Token refresh failed:", tokenData);
      return NextResponse.json({ error: 'Failed to refresh token', details: tokenData }, { status: 401 });
    }

    const newAccessToken = tokenData.body.access_token;
    const newRefreshToken = tokenData.body.refresh_token;
    const expiresAt = Math.floor(Date.now() / 1000) + tokenData.body.expires_in;

    // 2. SAVE new tokens immediately to DB so we don't lose the chain!
    await prisma.settings.update({
      where: { id: 'global' },
      data: {
        withingsAccessToken: newAccessToken,
        withingsRefreshToken: newRefreshToken,
        withingsTokenExpiresAt: expiresAt
      }
    });

    console.log("Tokens refreshed and saved. Fetching measurements...");

    // 3. Fetch the latest weight measurement (last 24 hours)
    // meastype 1 = Weight
    const measResponse = await fetch('https://wbsapi.withings.net/measure', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${newAccessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        action: 'getmeas',
        meastype: '1', 
        category: '1',
        lastupdate: String(Math.floor(Date.now() / 1000) - 86400) // last 24h
      })
    });

    const measData = await measResponse.json();
    
    if (measData.status !== 0) {
       console.error("Failed to fetch measurements:", measData);
       return NextResponse.json({ error: 'Failed to fetch measurements' }, { status: 400 });
    }

    const measures = measData.body.measuregrps || [];

    let inserted = 0;
    // 4. Upsert into DB
    for (const grp of measures) {
        if (!grp.measures || grp.measures.length === 0) continue;

        const dateObj = new Date(grp.date * 1000);
        dateObj.setUTCHours(0,0,0,0);
        
        // Withings returns value and unit (value * 10^unit) in kg. Convert to lbs.
        const weightKg = grp.measures[0].value * Math.pow(10, grp.measures[0].unit);
        const weightLbs = weightKg * 2.20462;

        await prisma.weightLog.upsert({
            where: { date: dateObj },
            update: { weightLbs: parseFloat(weightLbs.toFixed(1)) },
            create: { date: dateObj, weightLbs: parseFloat(weightLbs.toFixed(1)) }
        });
        inserted++;
    }

    console.log(`Withings Sync Complete. Updated ${inserted} weight logs.`);
    return NextResponse.json({ success: true, message: `Withings sync completed. Updated ${inserted} logs.` });

  } catch (error) {
    console.error("Withings Cron Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
