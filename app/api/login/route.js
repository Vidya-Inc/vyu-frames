import {
  createToken,
  pinMatches,
  checkRateLimit,
  recordFailure,
  clearFailures,
} from '../../../lib/auth';

export const dynamic = 'force-dynamic';

function clientIp(request) {
  const fwd = request.headers.get('x-forwarded-for') || '';
  return fwd.split(',')[0].trim() || 'local';
}

export async function POST(request) {
  const ip = clientIp(request);
  if (!checkRateLimit(ip)) {
    return Response.json(
      { success: false, error: 'Too many attempts. Try again in 10 minutes.' },
      { status: 429 }
    );
  }

  let pin = '';
  try {
    const body = await request.json();
    pin = body.pin;
  } catch {
    // fall through to the mismatch branch
  }

  if (!pinMatches(pin)) {
    recordFailure(ip);
    return Response.json({ success: false, error: 'Incorrect PIN.' }, { status: 401 });
  }

  clearFailures(ip);
  // Token goes back in the response body; the client keeps it in memory only,
  // so every fresh visit to /admin requires the PIN again.
  return Response.json({ success: true, token: createToken() });
}
