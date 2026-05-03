import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { vaultService } from '@/lib/vault';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get('q')?.toLowerCase() ?? '';

  if (!q) {
    return Response.json({ error: 'q query parameter is required' }, { status: 400 });
  }

  try {
    const entries = await vaultService.query(userId, {
      entryType: 'contact',
    });

    const filtered = entries.filter((entry) => {
      if (entry.decryptedData.type !== 'contact') return false;
      const { name, relationshipType, tags } = entry.decryptedData.data;

      if (name.toLowerCase().includes(q)) return true;
      if (relationshipType.toLowerCase().includes(q)) return true;
      if (tags.some((tag) => tag.toLowerCase().includes(q))) return true;

      return false;
    });

    return Response.json(filtered);
  } catch (error) {
    return Response.json({ error: 'Failed to search contacts' }, { status: 500 });
  }
}
