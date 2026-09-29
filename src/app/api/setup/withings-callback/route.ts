import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return NextResponse.json({ error: 'No authorization code provided.' }, { status: 400 });
    }

    const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
    if (!settings || !settings.withingsClientId || !settings.withingsClientSecret) {
      return NextResponse.json({ error: 'Client ID or Secret missing in DB.' }, { status: 400 });
    }

    const redirectUri = `${new URL(request.url).origin}/api/setup/withings-callback`;

    // Exchange the authorization code for an access token & refresh token
    const tokenResponse = await fetch('https://wbsapi.withings.net/v2/oauth2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action: 'requesttoken',
        grant_type: 'authorization_code',
        client_id: settings.withingsClientId,
        client_secret: settings.withingsClientSecret,
        code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.status === 0 && tokenData.body) {
      // Success! Update the database
      const expiresAt = Math.floor(Date.now() / 1000) + tokenData.body.expires_in;

      await prisma.settings.update({
        where: { id: 'global' },
        data: {
          withingsAccessToken: tokenData.body.access_token,
          withingsRefreshToken: tokenData.body.refresh_token,
          withingsTokenExpiresAt: expiresAt
        }
      });

      // Redirect back to the setup wizard, step 3
      return NextResponse.redirect(`${new URL(request.url).origin}/setup?step=3`);
    } else {
      console.error("Withings OAuth Error:", tokenData);
      return NextResponse.json({ error: 'Failed to retrieve tokens from Withings', details: tokenData }, { status: 400 });
    }
  } catch (error) {
    console.error("Callback Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
