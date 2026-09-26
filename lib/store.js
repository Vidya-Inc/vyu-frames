// The site's database is a JSON document pinned in the Telegram channel.
// Reads: getChat -> pinned_message.document -> download. Writes: upload a new
// document and pin it (replacing the old pin), then delete the old message.

import { getChat, sendJsonDocument, pinMessage, unpinAllMessages, deleteMessage, fetchFile, isConfigured } from './telegram';

const DB_FILENAME = 'vyu-db.json';

export const EMPTY_DB = {
  siteName: 'vyu.frames',
  tagline: '',
  socials: [],
  photos: [],
};

// Returns { db: object|null, msgId: number|null }. db is null when nothing is
// pinned or the pinned file is not our database; msgId is still reported so
// the next write can delete a stray document.
export async function readDB() {
  if (!isConfigured()) throw new Error('Telegram storage is not configured');
  const chat = await getChat();
  const pinned = chat.pinned_message;
  const doc = pinned && pinned.document;
  if (!doc || doc.file_name !== DB_FILENAME) {
    return { db: null, msgId: pinned ? pinned.message_id : null };
  }

  const { response } = await fetchFile(doc.file_id);
  const text = await response.text();
  try {
    return { db: { ...EMPTY_DB, ...JSON.parse(text) }, msgId: pinned.message_id };
  } catch {
    // Corrupt database: treat as missing so the next write replaces it.
    return { db: null, msgId: pinned.message_id };
  }
}

export async function writeDB(db, oldMsgId) {
  const clean = { ...db };
  delete clean.msgId;
  const msg = await sendJsonDocument(JSON.stringify(clean, null, 2), DB_FILENAME);
  // Channels keep a LIST of pinned messages, and getChat may return any of
  // them depending on the API edge. Unpin everything so exactly one pin —
  // the current database — exists, then delete the superseded document.
  await unpinAllMessages();
  await pinMessage(msg.message_id);
  if (oldMsgId) await deleteMessage(oldMsgId);
  return msg.message_id;
}
