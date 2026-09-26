import { isAdmin } from '../../../../lib/auth';
import { readDB, writeDB, EMPTY_DB } from '../../../../lib/store';

export const dynamic = 'force-dynamic';

function cleanSocials(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => ({
      label: String(s.label || '').trim().slice(0, 40),
      url: String(s.url || '').trim().slice(0, 300),
    }))
    .filter((s) => s.label && /^https?:\/\//i.test(s.url))
    .slice(0, 12);
}

export async function PUT(request) {
  if (!isAdmin(request)) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { db, msgId } = await readDB();
    const data = db || { ...EMPTY_DB, photos: [], socials: [] };

    if (body.siteName !== undefined) {
      data.siteName = String(body.siteName).trim().slice(0, 60) || 'vyu.frames';
    }
    if (body.tagline !== undefined) {
      data.tagline = String(body.tagline).trim().slice(0, 200);
    }
    if (body.socials !== undefined) {
      data.socials = cleanSocials(body.socials);
    }

    await writeDB(data, msgId);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
