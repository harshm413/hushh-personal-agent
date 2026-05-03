import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { auditService } from '@/lib/audit';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const searchParams = request.nextUrl.searchParams;

  const actionType = searchParams.get('actionType') || undefined;
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const personaId = searchParams.get('personaId') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

  const filters = {
    actionType,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    personaId,
  };

  const [paginatedResult, chainVerification] = await Promise.all([
    auditService.getEntries(userId, filters, { page, pageSize }),
    auditService.verifyChain(userId),
  ]);

  return Response.json({
    ...paginatedResult,
    chainValid: chainVerification.valid,
  });
}
