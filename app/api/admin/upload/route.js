import { isAdmin } from '../../../../lib/auth';
import { sendPhoto } from '../../../../lib/telegram';
import { ensureDB, writeDB } from '../../../../lib/store';

export const dynamic = 'force-dynamic';

// Vercel caps serverless request bodies at 4.5 MB — stay under it. The browser
// compresses anything larger before uploading.
const MAX_SIZE = 4 * 1024 * 1024;

const MAGIC = [
  { type: 'image/jpeg', ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/png', ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: 'image/gif', ext: 'gif', bytes: [0x47, 0x49, 0x46] },
  { type: 'image/webp', ext: 'webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF....WEBP
];

function sniffImage(buf) {
  for (const m of MAGIC) {
    if (!m.bytes.every((b, i) => buf[i] === b)) continue;
    if (m.type === 'image/webp' && buf.slice(8, 12).toString('ascii') !== 'WEBP') continue;
    return m;
  }
  return null;
}

export async function POST(request) {
  if (!isAdmin(request)) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    const title = String(form.get('title') || '').slice(0, 120);

    if (!file || typeof file === 'string') {
      return Response.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return Response.json(
        { success: false, error: 'File too large (max 4MB after compression)' },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffImage(buf);
    if (!sniffed) {
      return Response.json(
        { success: false, error: 'Only JPG, PNG, WEBP or GIF images are allowed' },
        { status: 400 }
      );
    }

    const { msgId, fileId } = await sendPhoto(
      new Blob([buf], { type: sniffed.type }),
      `photo-${Date.now()}.${sniffed.ext}`,
      title
    );

    const { db, msgId: dbMsgId } = await ensureDB();
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      msgId,
      fileId,
      title,
      desc: '',
      ts: Date.now(),
    };
    db.photos = [entry, ...(db.photos || [])]; // newest first
    await writeDB(db, dbMsgId);

    return Response.json({
      success: true,
      photo: { ...entry, src: `/api/img?f=${encodeURIComponent(fileId)}` },
    });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
