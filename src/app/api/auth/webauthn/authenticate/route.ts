import { NextRequest, NextResponse } from 'next/server';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';

const rpID = process.env.WEBAUTHN_RP_ID ?? 'localhost';
const origin = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Phase 1: Generate authentication options
  if (!body.response) {
    const { email } = body;
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { webauthnCreds: true },
    });

    if (!user || user.webauthnCreds.length === 0) {
      return NextResponse.json(
        { error: 'No WebAuthn credentials found' },
        { status: 404 }
      );
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: user.webauthnCreds.map((cred) => ({
        id: Buffer.from(cred.credentialId, 'base64url'),
        type: 'public-key',
        transports: cred.transports as AuthenticatorTransport[],
      })),
      userVerification: 'preferred',
    });

    const res = NextResponse.json({ options, userId: user.id });
    res.cookies.set('webauthn-auth-challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 300,
      path: '/',
    });
    res.cookies.set('webauthn-auth-user', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 300,
      path: '/',
    });

    return res;
  }

  // Phase 2: Verify authentication response
  const challenge = req.cookies.get('webauthn-auth-challenge')?.value;
  const userId = req.cookies.get('webauthn-auth-user')?.value;

  if (!challenge || !userId) {
    return NextResponse.json(
      { error: 'Challenge not found. Please restart authentication.' },
      { status: 400 }
    );
  }

  const credentialIdFromResponse = body.response.id;

  const credential = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: credentialIdFromResponse },
  });

  if (!credential || credential.userId !== userId) {
    return NextResponse.json(
      { error: 'Credential not found' },
      { status: 400 }
    );
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: Buffer.from(credential.credentialId, 'base64url'),
        credentialPublicKey: Buffer.from(credential.publicKey, 'base64url'),
        counter: credential.counter,
        transports: credential.transports as AuthenticatorTransport[],
      },
    });

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Authentication verification failed' },
        { status: 400 }
      );
    }

    // Update counter to prevent replay attacks
    await prisma.webAuthnCredential.update({
      where: { id: credential.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });

    // Return user info for client-side session establishment
    const user = await prisma.user.findUnique({ where: { id: userId } });

    const res = NextResponse.json({
      verified: true,
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
      },
    });
    res.cookies.delete('webauthn-auth-challenge');
    res.cookies.delete('webauthn-auth-user');

    return res;
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication verification failed' },
      { status: 400 }
    );
  }
}
