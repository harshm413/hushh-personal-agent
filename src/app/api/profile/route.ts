import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditService } from '@/lib/audit';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  return Response.json({
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    timezone: user.timezone,
    preferredLanguage: user.preferredLanguage,
    riskTolerance: user.profile?.riskTolerance ?? null,
    investmentGoals: user.profile?.investmentGoals ?? null,
    incomeRange: user.profile?.incomeRange ?? null,
    wellnessInterests: user.profile?.wellnessInterests ?? [],
    dietaryPreferences: user.profile?.dietaryPreferences ?? [],
    favoriteCategories: user.profile?.favoriteCategories ?? [],
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const body = await req.json();

  const { name, avatar, timezone, preferredLanguage } = body;
  const { riskTolerance, investmentGoals, incomeRange, wellnessInterests, dietaryPreferences, favoriteCategories } = body;

  // Update User fields
  const userUpdates: Record<string, unknown> = {};
  if (name !== undefined) userUpdates.name = name;
  if (avatar !== undefined) userUpdates.avatar = avatar;
  if (timezone !== undefined) userUpdates.timezone = timezone;
  if (preferredLanguage !== undefined) userUpdates.preferredLanguage = preferredLanguage;

  if (Object.keys(userUpdates).length > 0) {
    await prisma.user.update({ where: { id: userId }, data: userUpdates });
  }

  // Update/create UserProfile fields
  const profileUpdates: Record<string, unknown> = {};
  if (riskTolerance !== undefined) profileUpdates.riskTolerance = riskTolerance;
  if (investmentGoals !== undefined) profileUpdates.investmentGoals = investmentGoals;
  if (incomeRange !== undefined) profileUpdates.incomeRange = incomeRange;
  if (wellnessInterests !== undefined) profileUpdates.wellnessInterests = wellnessInterests;
  if (dietaryPreferences !== undefined) profileUpdates.dietaryPreferences = dietaryPreferences;
  if (favoriteCategories !== undefined) profileUpdates.favoriteCategories = favoriteCategories;

  if (Object.keys(profileUpdates).length > 0) {
    await prisma.userProfile.upsert({
      where: { userId },
      update: profileUpdates,
      create: { userId, ...profileUpdates },
    });
  }

  // Log to audit trail
  await auditService.log({
    userId,
    actionType: 'data_write',
    resource: 'user_profile',
  });

  // Return updated profile
  const updatedUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  return Response.json({
    name: updatedUser!.name,
    email: updatedUser!.email,
    avatar: updatedUser!.avatar,
    timezone: updatedUser!.timezone,
    preferredLanguage: updatedUser!.preferredLanguage,
    riskTolerance: updatedUser!.profile?.riskTolerance ?? null,
    investmentGoals: updatedUser!.profile?.investmentGoals ?? null,
    incomeRange: updatedUser!.profile?.incomeRange ?? null,
    wellnessInterests: updatedUser!.profile?.wellnessInterests ?? [],
    dietaryPreferences: updatedUser!.profile?.dietaryPreferences ?? [],
    favoriteCategories: updatedUser!.profile?.favoriteCategories ?? [],
  });
}
