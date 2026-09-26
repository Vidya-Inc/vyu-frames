// Thin wrapper around the Telegram Bot API. Runs only server-side.

const CHAT_ID = () => process.env.TELEGRAM_CHAT_ID;

function apiUrl(method) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  return `https://api.telegram.org/bot${token}/${method}`;
}

export function isConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function call(method, params) {
  const isForm = params instanceof FormData;
  const res = await fetch(apiUrl(method), {
    method: 'POST',
    ...(isForm
      ? { body: params }
      : { body: JSON.stringify(params), headers: { 'Content-Type': 'application/json' } }),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Telegram returned an invalid response (HTTP ${res.status})`);
  }
  if (!data.ok) {
    const err = new Error(data.description || `Telegram API error (${data.error_code || res.status})`);
    err.code = data.error_code;
    throw err;
  }
  return data.result;
}

export const getMe = () => call('getMe', {});
export const getChat = () => call('getChat', { chat_id: CHAT_ID() });
export const pinMessage = (messageId) => call('pinChatMessage', { chat_id: CHAT_ID(), message_id: messageId });
export const unpinAllMessages = () => call('unpinAllChatMessages', { chat_id: CHAT_ID() });

// The last few channel messages. getChat's pinned_message can serve stale
// snapshots for hours on some API edges, but the update stream is live —
// the negative offset returns recent updates WITHOUT consuming them.
export async function getRecentChannelPosts(limit = 10) {
  const updates = await call('getUpdates', { offset: -limit, limit });
  return updates.map((u) => u.channel_post).filter(Boolean);
}

// Deleting is always best-effort: an expired or already-gone message must not fail a save.
export async function deleteMessage(messageId) {
  try {
    await call('deleteMessage', { chat_id: CHAT_ID(), message_id: messageId });
    return true;
  } catch {
    return false;
  }
}

export async function sendPhoto(fileBlob, filename, caption) {
  const form = new FormData();
  form.append('chat_id', CHAT_ID());
  if (caption) form.append('caption', caption.slice(0, 1000));
  form.append('photo', fileBlob, filename || 'photo.jpg');
  const msg = await call('sendPhoto', form);
  const sizes = msg.photo || [];
  const best = sizes[sizes.length - 1]; // Telegram returns sizes ascending; last is the original
  if (!best) throw new Error('Telegram did not return the uploaded photo');
  return { msgId: msg.message_id, fileId: best.file_id };
}

export async function sendJsonDocument(text, name) {
  const form = new FormData();
  form.append('chat_id', CHAT_ID());
  form.append('document', new Blob([text], { type: 'application/json' }), name);
  return call('sendDocument', form);
}

// Downloads a file's bytes server-side. Callers must never hand the resulting
// bot-token URL to a client — that would leak the token.
export async function fetchFile(fileId) {
  const file = await call('getFile', { file_id: fileId });
  if (!file.file_path) throw new Error('Telegram did not return a file path');
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  if (!res.ok) throw new Error(`Telegram file download failed (HTTP ${res.status})`);
  return { response: res, filePath: file.file_path };
}
