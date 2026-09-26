'use client';

import { useEffect, useRef, useState } from 'react';

const MAX_RAW = 4 * 1024 * 1024; // Vercel request-body limit headroom

async function compressIfNeeded(file) {
  if (file.size <= MAX_RAW) return file;
  if (file.type === 'image/gif') {
    throw new Error(`${file.name}: GIFs over 4MB can't be compressed in the browser — please use a smaller one.`);
  }
  const img = await createImageBitmap(file);
  const maxSide = 2560;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  let q = 0.92;
  let blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));
  while (blob && blob.size > 3.8 * 1024 * 1024 && q > 0.55) {
    q -= 0.15;
    blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));
  }
  img.close?.();
  if (!blob) return file; // let the server return its own clear error
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

// token lives in React state only — never persisted — so a fresh visit to
// /admin always starts at the PIN screen.
async function api(path, opts = {}, token = null) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const data = await res.json().catch(() => ({ success: false, error: 'Unexpected server response' }));
  if (res.status === 401 && !path.endsWith('/login')) {
    window.dispatchEvent(new Event('vf-session-expired'));
  }
  return { status: res.status, ...data };
}

function Tile({ photo, token, onDeleted }) {
  const [title, setTitle] = useState(photo.title || '');
  const [desc, setDesc] = useState(photo.desc || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const r = await api('/api/admin/photo', {
      method: 'PATCH',
      body: JSON.stringify({ id: photo.id, title, desc }),
    }, token);
    setBusy(false);
    if (r.success) {
      setMsg({ ok: true, text: 'Saved' });
      setTimeout(() => setMsg(null), 2000);
    } else {
      setMsg({ ok: false, text: r.error || 'Failed to save' });
    }
  };

  const del = async () => {
    if (!window.confirm('Delete this photo? Its Telegram message is removed too.')) return;
    setBusy(true);
    setMsg(null);
    const r = await api(`/api/admin/photo?id=${encodeURIComponent(photo.id)}`, { method: 'DELETE' }, token);
    setBusy(false);
    if (r.success) onDeleted();
    else setMsg({ ok: false, text: r.error || 'Failed to delete' });
  };

  return (
    <div className="tile glass">
      <div className="thumb-wrap">
        <img src={photo.src} alt={photo.title || 'Photo'} loading="lazy" />
      </div>
      <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input
        className="input"
        placeholder="Description (optional)"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />
      <div className="t-actions">
        <button className="gbtn sm primary" onClick={save} disabled={busy}>
          Save
        </button>
        <button className="gbtn sm danger" onClick={del} disabled={busy}>
          Delete
        </button>
        {msg && <span className={msg.ok ? 'status-text ok' : 'status-text err'}>{msg.text}</span>}
      </div>
    </div>
  );
}

function BrandMark({ letter = 'Q' }) {
  return <div className="brand-mark">{letter}</div>;
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(null); // null = checking
  const [token, setToken] = useState(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  const [photos, setPhotos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [queue, setQueue] = useState([]); // { name, state: 'pending'|'up'|'ok'|'err', text }
  const [upBusy, setUpBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const [siteName, setSiteName] = useState('');
  const [tagline, setTagline] = useState('');
  const [socials, setSocials] = useState([]);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState(null);

  const [conn, setConn] = useState(null); // { ok, text, detail }

  useEffect(() => {
    api('/api/me').then((r) => setAuthed(Boolean(r.authed)));
    const onExpired = () => {
      setAuthed(false);
      setToken(null);
    };
    window.addEventListener('vf-session-expired', onExpired);
    return () => window.removeEventListener('vf-session-expired', onExpired);
  }, []);

  useEffect(() => {
    if (!authed || !token) return;
    api('/api/photos').then((r) => {
      setLoaded(true);
      if (r.success) {
        setPhotos(r.data.photos || []);
        setSiteName(r.data.siteName || '');
        setTagline(r.data.tagline || '');
        setSocials(r.data.socials || []);
      } else {
        setLoadError(r.error || 'Failed to load');
      }
    });
    api('/api/admin/test', {}, token).then((r) => {
      setConn(
        r.success
          ? { ok: true, text: `Connected — ${r.bot}`, detail: `${r.chat.title} · database: ${r.database}` }
          : { ok: false, text: 'Storage check failed', detail: r.error }
      );
    });
  }, [authed, token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setPinBusy(true);
    setPinError('');
    const r = await api('/api/login', { method: 'POST', body: JSON.stringify({ pin }) });
    setPinBusy(false);
    if (r.success && r.token) {
      setPin('');
      setToken(r.token);
      setAuthed(true);
    } else {
      setPinError(r.error || 'Login failed');
    }
  };

  const handleLogout = async () => {
    await api('/api/logout', { method: 'POST' }, token);
    setToken(null);
    setAuthed(false);
  };

  const uploadFiles = async (fileList) => {
    const list = Array.from(fileList || []);
    if (!list.length) return;
    setUpBusy(true);
    setQueue(list.map((f) => ({ name: f.name, state: 'pending', text: 'queued' })));
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      setQueue((q) => q.map((x, j) => (j === i ? { ...x, state: 'up', text: 'uploading…' } : x)));
      try {
        const prepared = await compressIfNeeded(list[i]);
        const fd = new FormData();
        fd.append('file', prepared);
        const r = await api('/api/admin/upload', { method: 'POST', body: fd }, token);
        if (r.success) {
          ok += 1;
          setPhotos((p) => [r.photo, ...p]);
          setQueue((q) => q.map((x, j) => (j === i ? { ...x, state: 'ok', text: 'uploaded' } : x)));
        } else {
          setQueue((q) => q.map((x, j) => (j === i ? { ...x, state: 'err', text: r.error || 'failed' } : x)));
        }
      } catch (e) {
        setQueue((q) => q.map((x, j) => (j === i ? { ...x, state: 'err', text: e.message } : x)));
      }
    }
    setUpBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    setTimeout(() => setQueue([]), 4000);
  };

  const saveSettings = async () => {
    setSettingsBusy(true);
    setSettingsMsg(null);
    const r = await api('/api/admin/data', {
      method: 'PUT',
      body: JSON.stringify({ siteName, tagline, socials }),
    }, token);
    setSettingsBusy(false);
    if (r.success) {
      setSettingsMsg({ ok: true, text: 'Saved and live.' });
      setTimeout(() => setSettingsMsg(null), 2500);
    } else {
      setSettingsMsg({ ok: false, text: r.error || 'Failed to save' });
    }
  };

  const runTest = async () => {
    setConn(null);
    const r = await api('/api/admin/test', {}, token);
    setConn(
      r.success
        ? { ok: true, text: `Connected — ${r.bot}`, detail: `${r.chat.title} · database: ${r.database}` }
        : { ok: false, text: 'Storage check failed', detail: r.error }
    );
  };

  if (authed === null) {
    return (
      <div className="admin-shell">
        <div className="admin-bg" aria-hidden="true" />
        <div className="login-stage">
          <div className="login-card glass">
            <BrandMark />
            <div className="who">QNXEITSG</div>
            <p className="hint">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="admin-shell">
        <div className="admin-bg" aria-hidden="true" />
        <div className="login-stage">
          <div className="login-card glass">
            <BrandMark />
            <div className="who">QNXEITSG</div>
            <p className="hint">Enter the editor PIN to manage the site.</p>
            <form onSubmit={handleLogin}>
              <input
                className="input pin-input"
                type="password"
                inputMode="numeric"
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
              />
              {pinError && <p className="status-text err">{pinError}</p>}
              <button className="gbtn primary btn-wide" type="submit" disabled={pinBusy || !pin} style={{ width: '100%', marginTop: 16 }}>
                {pinBusy ? 'Checking…' : 'Unlock editor'}
              </button>
            </form>
            <p className="login-foot">Editor access is URL-only · sessions end when this tab closes</p>
          </div>
        </div>
      </div>
    );
  }

  const connPillClass = !conn ? 'checking' : conn.ok ? 'ok' : 'bad';
  const connPillText = !conn ? 'Checking storage…' : conn.text;

  return (
    <div className="admin-shell">
      <div className="admin-bg" aria-hidden="true" />
      <div className="wrap">
        <div className="admin-hero">
          <div className="hero-id">
            <BrandMark />
            <div>
              <div className="kicker">Control Room</div>
              <div className="who">{siteName || 'QNXEITSG'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`pill ${connPillClass}`}>
              <span className="dot" />
              {connPillText}
            </span>
            <button className="gbtn sm" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>

        <div className="stat-row">
          <div className="stat-card glass">
            <div className="stat-num">{loaded ? photos.length : '…'}</div>
            <div className="stat-label">Photos live</div>
          </div>
          <div className="stat-card glass">
            <div className="stat-num">Telegram</div>
            <div className="stat-label">Storage</div>
            <div className="stat-sub">private channel · bot API</div>
          </div>
          <div className="stat-card glass">
            <div className="stat-num">Memory</div>
            <div className="stat-label">Session</div>
            <div className="stat-sub">PIN required each visit</div>
          </div>
        </div>

        {loadError && (
          <div className="panel glass span-2" style={{ marginBottom: 16 }}>
            <p className="status-text err">{loadError}</p>
          </div>
        )}

        <div className="admin-grid">
          <div className="panel glass">
            <h2>⬆ Upload photos</h2>
            <p className="sub">JPG, PNG, WEBP or GIF — large files are compressed automatically.</p>
            <div
              className={`dropzone${dragOver ? ' drag' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                uploadFiles(e.dataTransfer.files);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click();
              }}
            >
              <span className="dz-icon">🖼️</span>
              <span className="dz-main">Drag &amp; drop photos here</span>
              <div className="dz-hint">or click to browse from your device</div>
            </div>
            <input
              ref={fileRef}
              id="upload-input"
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => uploadFiles(e.target.files)}
            />
            {queue.length > 0 && (
              <div className="queue">
                {queue.map((q, i) => (
                  <div className="queue-item" key={i}>
                    <span>{q.name}</span>
                    <span className={`q-status ${q.state}`}>{q.text}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="gbtn primary" style={{ marginTop: 14 }} onClick={() => fileRef.current?.click()} disabled={upBusy}>
              {upBusy ? 'Uploading…' : 'Browse files'}
            </button>
          </div>

          <div className="panel glass">
            <h2>🎛 Site &amp; social links</h2>
            <p className="sub">Shown on the public homepage header.</p>
            <label className="field-label">Site name</label>
            <input className="input" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="QNXEITSG" />
            <label className="field-label">Tagline (optional)</label>
            <input
              className="input"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="One line about you or your work"
            />
            <label className="field-label">Social links</label>
            {socials.map((s, i) => (
              <div className="social-row" key={i}>
                <input
                  className="input"
                  style={{ maxWidth: '140px' }}
                  placeholder="Label"
                  value={s.label}
                  onChange={(e) => setSocials((list) => list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
                <input
                  className="input"
                  placeholder="https://…"
                  value={s.url}
                  onChange={(e) => setSocials((list) => list.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                />
                <button
                  className="gbtn sm danger"
                  onClick={() => setSocials((list) => list.filter((_, j) => j !== i))}
                  aria-label="Remove link"
                >
                  ×
                </button>
              </div>
            ))}
            <button className="gbtn sm" onClick={() => setSocials((l) => [...l, { label: '', url: '' }])}>
              + Add link
            </button>
            <div className="save-row">
              <button className="gbtn primary" onClick={saveSettings} disabled={settingsBusy}>
                {settingsBusy ? 'Saving…' : 'Save & publish'}
              </button>
              {settingsMsg && (
                <span className={settingsMsg.ok ? 'status-text ok' : 'status-text err'}>{settingsMsg.text}</span>
              )}
            </div>
          </div>

          <div className="panel glass span-2">
            <h2>🖼 Photo manager ({photos.length})</h2>
            <p className="sub">Titles and descriptions appear in the gallery and lightbox. Deleting also removes the Telegram message.</p>
            {!loaded ? (
              <p className="hint">Loading…</p>
            ) : photos.length === 0 ? (
              <p className="hint">No photos yet — upload your first one above.</p>
            ) : (
              <div className="photo-tiles">
                {photos.map((p) => (
                  <Tile
                    key={p.id}
                    photo={p}
                    token={token}
                    onDeleted={() => setPhotos((list) => list.filter((x) => x.id !== p.id))}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="panel glass span-2">
            <h2>📡 Telegram storage</h2>
            <p className="sub">
              Photos live as messages in your private channel; the site database is a JSON document whose pointer is
              published in the channel description.
            </p>
            <button className="gbtn" onClick={runTest}>
              Run storage check
            </button>
            {conn && (
              <p className="status-text" style={{ marginTop: 10, color: conn.ok ? 'var(--ok)' : 'var(--err)' }}>
                {conn.text}
                {conn.detail ? ` — ${conn.detail}` : ''}
              </p>
            )}
          </div>

          <p className="hint center span-2" style={{ gridColumn: '1 / -1' }}>
            <a href="/">← View live site</a>
          </p>
        </div>
      </div>
    </div>
  );
}
