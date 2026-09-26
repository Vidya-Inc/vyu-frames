import { readDB, EMPTY_DB } from '../../../lib/store';
import { isConfigured } from '../../../lib/telegram';

export const dynamic = 'force-dynamic';

// The gallery changes on every upload, so never let a CDN or browser cache it.
function jsonWithNoStore(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET() {
  if (!isConfigured()) {
    return jsonWithNoStore({
      success: true,
      data: { ...EMPTY_DB, warning: 'Storage is not configured yet (see README).' },
    });
  }
  try {
    const { db } = await readDB();
    const data = db || EMPTY_DB;
    return jsonWithNoStore({
      success: true,
      data: {
        siteName: data.siteName,
        tagline: data.tagline,
        socials: data.socials || [],
        photos: (data.photos || []).map((p) => ({
          id: p.id,
          title: p.title || '',
          desc: p.desc || '',
          ts: p.ts,
          src: `/api/img?f=${encodeURIComponent(p.fileId)}`,
        })),
      },
    });
  } catch (e) {
    return jsonWithNoStore({ success: false, error: e.message }, 500);
  }
}
