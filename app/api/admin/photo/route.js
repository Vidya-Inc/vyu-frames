import { isAdmin } from '../../../../lib/auth';
import { deleteMessage } from '../../../../lib/telegram';
import { readDB, writeDB } from '../../../../lib/store';

export const dynamic = 'force-dynamic';

async function withDB(request, fn) {
  if (!isAdmin(request)) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { db, msgId, rev } = await readDB();
    if (!db) {
      return Response.json({ success: false, error: 'Database is empty' }, { status: 404 });
    }
    return await fn(db, { msgId, rev });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  return withDB(request, async (db, prev) => {
    const { id, title, desc } = await request.json();
    const photo = (db.photos || []).find((p) => p.id === id);
    if (!photo) {
      return Response.json({ success: false, error: 'Photo not found' }, { status: 404 });
    }
    if (title !== undefined) photo.title = String(title).slice(0, 120);
    if (desc !== undefined) photo.desc = String(desc).slice(0, 500);
    await writeDB(db, prev);
    return Response.json({ success: true });
  });
}

export async function DELETE(request) {
  return withDB(request, async (db, prev) => {
    const id = new URL(request.url).searchParams.get('id');
    const photo = (db.photos || []).find((p) => p.id === id);
    if (!photo) {
      return Response.json({ success: false, error: 'Photo not found' }, { status: 404 });
    }
    await deleteMessage(photo.msgId); // best-effort; the index entry is the source of truth
    db.photos = db.photos.filter((p) => p.id !== id);
    await writeDB(db, prev);
    return Response.json({ success: true });
  });
}
