import { isAdmin } from '../../../../lib/auth';
import { getMe, getChat, isConfigured } from '../../../../lib/telegram';
import { readDB } from '../../../../lib/store';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!isAdmin(request)) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!isConfigured()) {
    return Response.json(
      { success: false, error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not set' },
      { status: 500 }
    );
  }

  try {
    const me = await getMe();
    const chat = await getChat();
    const pinned = chat.pinned_message;
    const pinnedInfo = pinned
      ? {
          msgId: pinned.message_id,
          hasDocument: Boolean(pinned.document),
          fileName: pinned.document?.file_name || null,
          date: pinned.date,
        }
      : null;
    let dbState = 'empty (nothing pinned yet)';
    try {
      const { db } = await readDB();
      if (db) dbState = `ok — ${(db.photos || []).length} photo(s), ${(db.socials || []).length} social link(s)`;
    } catch (e) {
      dbState = `present but unreadable: ${e.message}`;
    }
    return Response.json({
      success: true,
      bot: `@${me.username}`,
      chat: { title: chat.title || chat.username || String(chat.id), type: chat.type },
      chatIdTail: String(chat.id).slice(-4),
      pinned: pinnedInfo,
      database: dbState,
    });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
