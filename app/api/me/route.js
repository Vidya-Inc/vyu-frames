import { isAdmin } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  return Response.json({ success: true, authed: isAdmin(request) });
}
