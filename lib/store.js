// The site's database is a JSON document stored inside the private Telegram
// channel. Every write uploads a fresh document, then publishes a POINTER to
// it in the channel description ("DB:<file_id>") — the description is chat
// state, so unlike the consumable update queue it can never be destroyed by
// another getUpdates caller. The pinned copy is kept as a secondary pointer.
//
// Each document carries a monotonically increasing `rev`. Reads gather all
// three pointer candidates (description, newest update, pin) and keep the one
// with the highest rev, so a stale snapshot on one Telegram API edge can never
// overwrite newer data.

import {
  getChat,
  getLatestUpdate,
  setDescription,
  sendJsonDocument,
  pinMessage,
  unpinAllMessages,
  deleteMessage,
  fetchFile,
  isConfigured,
} from './telegram';

const DB_FILENAME = 'vyu-db.json';
const DESC_PREFIX = 'DB:';

export const EMPTY_DB = {
  siteName: 'QNXEITSG',
  tagline: '',
  socials: [],
  photos: [],
};

function pointerFromDescription(description) {
  const text = String(description || '').trim();
  return text.startsWith(DESC_PREFIX) ? text.slice(DESC_PREFIX.length) : null;
}

async function loadCandidate(fileId, msgId) {
  const { response } = await fetchFile(fileId);
  const parsed = JSON.parse(await response.text());
  return {
    db: { ...EMPTY_DB, ...parsed },
    msgId: msgId ?? null,
    rev: Number(parsed.rev) || 0,
  };
}

// Resolves to the newest known database state, or db:null when nothing valid
// is stored yet. Never throws for missing pointers — only for a truly broken
// connection (all candidates failed).
export async function readDB() {
  if (!isConfigured()) throw new Error('Telegram storage is not configured');

  const attempts = await Promise.allSettled([
    (async () => {
      const chat = await getChat();
      return {
        fileId: pointerFromDescription(chat.description),
        pinnedDoc: chat.pinned_message?.document || null,
        pinnedMsgId: chat.pinned_message?.message_id ?? null,
      };
    })(),
    (async () => {
      const post = await getLatestUpdate();
      if (!post) return null;
      return { updateDoc: post.pinned_message?.document || post.document || null, updateMsgId: post.message_id };
    })(),
  ]);

  let best = null;
  const seenFileIds = new Set();

  const consider = async (fileId, msgId) => {
    if (!fileId || seenFileIds.has(fileId)) return;
    seenFileIds.add(fileId);
    try {
      const loaded = await loadCandidate(fileId, msgId);
      if (!best || loaded.rev > best.rev) best = loaded;
    } catch {
      // unreadable candidate (expired download link, corrupt json) — skip
    }
  };

  if (attempts[0].status === 'fulfilled' && attempts[0].value) {
    const a = attempts[0].value;
    await consider(a.fileId, null);
    if (a.pinnedDoc?.file_name === DB_FILENAME) await consider(a.pinnedDoc.file_id, a.pinnedMsgId);
  }
  if (attempts[1].status === 'fulfilled' && attempts[1].value?.updateDoc?.file_name === DB_FILENAME) {
    await consider(attempts[1].value.updateDoc.file_id, attempts[1].value.updateMsgId);
  }

  if (best) return { db: best.db, msgId: best.msgId, rev: best.rev };
  return { db: null, msgId: null, rev: 0 };
}

export async function writeDB(db, prev) {
  const rev = Number(prev?.rev || 0) + 1;
  const clean = { ...db, rev };
  delete clean.msgId;

  const msg = await sendJsonDocument(JSON.stringify(clean, null, 2), DB_FILENAME);
  const newFileId = msg.document?.file_id;
  if (!newFileId) throw new Error('Telegram did not return the database document id');

  // Durable pointer first — even if pinning below fails, reads still recover.
  let pointerOk = true;
  try {
    await setDescription(`${DESC_PREFIX}${newFileId}`);
  } catch {
    pointerOk = false;
  }

  try {
    await unpinAllMessages();
    await pinMessage(msg.message_id);
  } catch {
    // pin is a secondary pointer; the description already carries the state
  }

  if (prev?.msgId) await deleteMessage(prev.msgId);

  if (!pointerOk) {
    // fall back to the pin we just made — reads still work, warn the caller
    console.warn('setChatDescription failed; database pointer relies on the pinned message');
  }
  return { msgId: msg.message_id, rev };
}
