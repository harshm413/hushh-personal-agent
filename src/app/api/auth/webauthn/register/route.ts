import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const rpName = 'Hushh Agent';
const rpID = process.env.WEBAUTHN_RP_ID ?? 'localhost';
const origin = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const body = await req.json();

  // Phase 1: Generate registration options
  if (!body.response) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const existingCredentials = await prisma.webAuthnCredential.findMany({
      where: { userId },
    });

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: userId,
      userName: user.email,
      userDisplayName: user.name ?? user.email,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map((cred) => ({
        id: Buffer.from(cred.credentialId, 'base64url'),
        type: 'public-key',
        transports: cred.transports as AuthenticatorTransport[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    const res = NextResponse.json({ options });
    res.cookies.set('webauthn-challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 300, // 5 minutes
      path: '/',
    });

    return res;
  }

  // Phase 2: Verify registration response
  const challenge = req.cookies.get('webauthn-challenge')?.value;
  if (!challenge) {
    return NextResponse.json(
      { error: 'Challenge not found. Please restart registration.' },
      { status: 400 }
    );
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: 'Registration verification failed' },
        { status: 400 }
      );
    }

    const { credentialID, credentialPublicKey, counter } =
      verification.registrationInfo;

    await prisma.webAuthnCredential.create({
      data: {
        userId,
        credentialId: Buffer.from(credentialID).toString('base64url'),
        publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
        counter,
        transports: body.response.response?.transports ?? [],
      },
    });

    const res = NextResponse.json({ verified: true });
    res.cookies.delete('webauthn-challenge');
    return res;
  } catch (error) {
    return NextResponse.json(
      { error: 'Registration verification failed' },
      { status: 400 }
    );
  }
}
