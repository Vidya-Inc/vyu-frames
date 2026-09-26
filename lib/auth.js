import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
export const COOKIE_NAME = 'vf_admin';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

export function createToken() {
  const exp = String(Date.now() + TTL_MS);
  return `${exp}.${sign(exp)}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [exp, sig] = token.split('.');
  const expNum = Number(exp);
  if (!expNum || Number.isNaN(expNum) || Date.now() > expNum) return false;
  const expected = sign(exp);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// The admin token travels in the Authorization header and lives only in the
// browser tab's memory (React state) — no persistent cookie — so /admin asks
// for the PIN on every fresh visit.
export function getAdminToken(request) {
  const header = request.headers.get('authorization') || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();

  const cookie = request.headers.get('cookie') || '';
  const c = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return c ? decodeURIComponent(c[1]) : null;
}

export function isAdmin(request) {
  return verifyToken(getAdminToken(request));
}

export function cookieHeader(token) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${Math.floor(TTL_MS / 1000)}`,
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function pinMatches(input) {
  const expected = process.env.ADMIN_PIN || '150106';
  const a = crypto.createHash('sha256').update(String(input ?? '')).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// Best-effort rate limiting: lives per serverless instance, so it raises the
// bar against PIN brute-forcing without being a hard guarantee.
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;

export function checkRateLimit(ip) {
  const rec = attempts.get(ip);
  if (rec && rec.lockedUntil && Date.now() < rec.lockedUntil) return false;
  return true;
}

export function recordFailure(ip) {
  const now = Date.now();
  const rec = attempts.get(ip) || { count: 0, firstAt: now };
  if (now - rec.firstAt > WINDOW_MS) {
    rec.count = 0;
    rec.firstAt = now;
  }
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) rec.lockedUntil = now + LOCK_MS;
  attempts.set(ip, rec);
}

export function clearFailures(ip) {
  attempts.delete(ip);
}
