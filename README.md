# vyu.frames v4 — Telegram-powered photo portfolio

A single-page photography portfolio where **everything is stored on Telegram** — no database,
no GitHub storage, no CMS. Your photos live as messages in a private Telegram channel and the
site's data (photo index, social links, site name) is a pinned JSON file in the same channel.

```
Browser ──> Vercel (Next.js) ──> Telegram Bot API ──> your private channel
                                     ▲
        photos + data all live here ─┘
```

## Features

- Masonry photo gallery with lightbox (keyboard navigation included).
- `/admin` dashboard protected by a PIN:
  - Upload photos (multi-select; large files are auto-compressed in the browser to fit
    Vercel's 4.5 MB request limit — originals under 4 MB are stored untouched).
  - Edit title / description per photo, delete photos (removes the Telegram message too).
  - Edit site name, tagline and social links (Instagram, X, YouTube, Telegram, email, …).
  - "Test connection" button to verify your bot + channel setup.
- Images are proxied through `/api/img` so your **bot token is never exposed** to visitors.
- Signed HttpOnly session cookie + login rate limiting.

## Setup

### 1. Create the Telegram bot

1. Open Telegram, talk to [@BotFather](https://t.me/BotFather).
2. Send `/newbot`, choose a name and username.
3. Copy the **bot token** — this is `TELEGRAM_BOT_TOKEN`.

### 2. Create the storage channel

1. Create a **private channel** (e.g. `vyu storage`). A private group works too.
2. Add your bot as an **administrator** with at least:
   - *Post Messages*
   - *Edit Messages* (not strictly required, but useful)
   - *Pin Messages* (required — the site's database is a pinned file)
3. Post any message in the channel, then open this URL in a browser:

   ```
   https://api.telegram.org/bot<BOT_TOKEN>/getUpdates
   ```

   Find `"channel_post": { "chat": { "id": ... } }` — that `id` (a negative number like
   `-1001234567890`) is your `TELEGRAM_CHAT_ID`.

> Don't unpin or delete the pinned `vyu-db.json` file — that IS the website's database.
> To reset the site completely: unpin it, then save anything from `/admin` to start fresh.

### 3. Run locally

```bash
npm install
cp .env.example .env.local   # fill in the 4 values
npm run dev                  # http://localhost:3000
```

Open `/admin`, enter your PIN (default `150106`), hit **Test connection** — it should show
your bot username and channel title. Then upload your first photo.

### 4. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Import the repo in Vercel (framework preset: Next.js — auto-detected).
3. In **Project Settings → Environment Variables**, add all 4 vars from `.env.example`.
   Vercel does not read `.env.local` — they must be added in the dashboard.
4. Deploy. Done.

## How storage works

| Data | Where it lives on Telegram |
|---|---|
| Each photo | One channel message per photo (sent by the bot via `sendPhoto`) |
| Photo index, titles, descriptions, social links, site name | `vyu-db.json` document, always pinned in the channel |

Every change re-uploads the JSON database and re-pins it; the previous database message is
deleted. Deleting a photo also deletes its Telegram message.

## Security notes

- `POST /api/login` is rate-limited (5 failed attempts → 10-minute lock, per server instance).
- The PIN is compared in constant time; sessions are HMAC-signed cookies valid for 7 days.
- Uploaded files are validated by **magic bytes**, not by filename or claimed MIME type.
- Change `ADMIN_PIN` and `SESSION_SECRET` before deploying.

## Notes & limits

- Uploads are capped at 4 MB server-side (Vercel request limit). Files above 4 MB are
  automatically downscaled to ≤2560 px JPEG in the browser before uploading.
- Keep the bot a quiet admin: if you manually pin something else in the channel, the site
  will treat the database as missing and create a new one on the next change.
- iPhone HEIC photos are converted to JPEG automatically by iOS when picking files.
