import { readDB, EMPTY_DB } from '../../../lib/store';
import { isConfigured } from '../../../lib/telegram';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isConfigured()) {
    return Response.json({
      success: true,
      data: { ...EMPTY_DB, warning: 'Storage is not configured yet (see README).' },
    });
  }
  try {
    const { db } = await readDB();
    const data = db || EMPTY_DB;
    return Response.json({
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
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
