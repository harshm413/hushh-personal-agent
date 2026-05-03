import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import * as OTPAuth from 'otpauth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditService } from '@/lib/audit';

const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 3;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { code } = await req.json();

  if (!code || typeof code !== 'string') {
    return NextResponse.json(
      { error: 'Verification code is required' },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.twoFactorSecret) {
    return NextResponse.json(
      { error: 'Two-factor authentication is not set up' },
      { status: 400 }
    );
  }

  // Check lockout
  if (user.totpLockedUntil && user.totpLockedUntil > new Date()) {
    const remainingMs = user.totpLockedUntil.getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    return NextResponse.json(
      {
        error: `Account is temporarily locked. Try again in ${remainingMin} minute(s).`,
      },
      { status: 423 }
    );
  }

  const totp = new OTPAuth.TOTP({
    issuer: 'Hushh Agent',
    label: user.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret),
  });

  const delta = totp.validate({ token: code, window: 1 });

  if (delta !== null) {
    // Valid code
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        failedTotpAttempts: 0,
        totpLockedUntil: null,
      },
    });

    return NextResponse.json({ verified: true });
  }

  // Invalid code — increment failed attempts
  const newFailedAttempts = user.failedTotpAttempts + 1;
  const updateData: Record<string, unknown> = {
    failedTotpAttempts: newFailedAttempts,
  };

  if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
    updateData.totpLockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);

    await auditService.log({
      userId,
      actionType: 'auth_failed',
      resource: 'totp',
      metadata: {
        reason: 'max_failed_attempts',
        attempts: newFailedAttempts,
      },
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
    return NextResponse.json(
      { error: 'Too many failed attempts. Account locked for 15 minutes.' },
      { status: 423 }
    );
  }

  return NextResponse.json(
    { error: 'Invalid verification code' },
    { status: 400 }
  );
}
