'use client';

import { useEffect, useState } from 'react';

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

function PhotoRow({ photo, token, onDeleted }) {
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
    <div className="photo-row">
      <img className="photo-thumb" src={photo.src} alt={photo.title || 'Photo'} />
      <div className="photo-fields">
        <input
          className="input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="input"
          placeholder="Description (optional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <div className="photo-actions">
          <button className="btn btn-sm" onClick={save} disabled={busy}>
            Save
          </button>
          <button className="btn btn-sm btn-danger" onClick={del} disabled={busy}>
            Delete
          </button>
          {msg && <span className={msg.ok ? 'status-text ok' : 'status-text err'}>{msg.text}</span>}
        </div>
      </div>
    </div>
  );
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

  const [uploadFiles, setUploadFiles] = useState(null);
  const [upBusy, setUpBusy] = useState(false);
  const [upStatus, setUpStatus] = useState(null);

  const [siteName, setSiteName] = useState('');
  const [tagline, setTagline] = useState('');
  const [socials, setSocials] = useState([]);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState(null);

  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState(null);

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

  const handleUpload = async () => {
    const list = Array.from(uploadFiles || []);
    if (!list.length) return;
    setUpBusy(true);
    setUpStatus(null);
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      setUpStatus({ ok: null, text: `Uploading ${i + 1} / ${list.length} — ${list[i].name}` });
      try {
        const prepared = await compressIfNeeded(list[i]);
        const fd = new FormData();
        fd.append('file', prepared);
        const r = await api('/api/admin/upload', { method: 'POST', body: fd }, token);
        if (r.success) {
          ok += 1;
          setPhotos((p) => [r.photo, ...p]);
        } else {
          setUpStatus({ ok: false, text: `Failed: ${r.error}` });
          break;
        }
      } catch (e) {
        setUpStatus({ ok: false, text: `Failed: ${e.message}` });
        break;
      }
    }
    if (ok === list.length) {
      setUpStatus({ ok: true, text: `Uploaded ${ok} photo${ok === 1 ? '' : 's'}.` });
    }
    setUpBusy(false);
    setUploadFiles(null);
    const el = document.getElementById('upload-input');
    if (el) el.value = '';
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
    setTestBusy(true);
    setTestResult(null);
    const r = await api('/api/admin/test', {}, token);
    setTestResult(
      r.success
        ? { ok: true, text: `${r.bot} → ${r.chat.title} (${r.chat.type}) — database: ${r.database}` }
        : { ok: false, text: r.error || 'Connection failed' }
    );
    setTestBusy(false);
  };

  if (authed === null) {
    return <div className="empty">Loading…</div>;
  }

  if (!authed) {
    return (
      <div className="admin-wrap">
        <div className="card login-box">
          <h1 className="name small">QNXEITSG</h1>
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
            <button className="btn btn-wide" type="submit" disabled={pinBusy || !pin}>
              {pinBusy ? 'Checking…' : 'Unlock'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-wrap">
      <div className="topline">
        <h1 className="name small">QNXEITSG</h1>
        <button className="btn btn-sm btn-ghost" onClick={handleLogout}>
          Log out
        </button>
      </div>

      {loadError && <div className="card"><p className="status-text err">{loadError}</p></div>}

      <div className="card">
        <h2>Upload photos</h2>
        <p className="hint">JPG, PNG, WEBP or GIF. Files over 4MB are compressed automatically.</p>
        <div className="upload-row">
          <input
            id="upload-input"
            type="file"
            accept="image/*"
            multiple
            disabled={upBusy}
            onChange={(e) => setUploadFiles(e.target.files)}
          />
          <button className="btn" onClick={handleUpload} disabled={upBusy || !uploadFiles?.length}>
            {upBusy ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        {upStatus && <p className={upStatus.ok === false ? 'status-text err' : 'status-text ok'}>{upStatus.text}</p>}
      </div>

      <div className="card">
        <h2>Photos ({photos.length})</h2>
        {!loaded ? (
          <p className="hint">Loading…</p>
        ) : photos.length === 0 ? (
          <p className="hint">No photos yet — upload your first one above.</p>
        ) : (
          <div className="photo-list">
            {photos.map((p) => (
              <PhotoRow
                key={p.id}
                photo={p}
                token={token}
                onDeleted={() => setPhotos((list) => list.filter((x) => x.id !== p.id))}
              />
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Site &amp; social links</h2>
        <label className="field-label">Site name</label>
        <input
          className="input"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          placeholder="QNXEITSG"
        />
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
              style={{ maxWidth: '150px' }}
              placeholder="Label"
              value={s.label}
              onChange={(e) =>
                setSocials((list) => list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
              }
            />
            <input
              className="input"
              placeholder="https://…"
              value={s.url}
              onChange={(e) =>
                setSocials((list) => list.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
              }
            />
            <button
              className="btn btn-sm btn-danger"
              onClick={() => setSocials((list) => list.filter((_, j) => j !== i))}
              aria-label="Remove link"
            >
              ×
            </button>
          </div>
        ))}
        <button className="btn btn-sm btn-ghost" onClick={() => setSocials((l) => [...l, { label: '', url: '' }])}>
          + Add link
        </button>

        <div className="save-row">
          <button className="btn" onClick={saveSettings} disabled={settingsBusy}>
            {settingsBusy ? 'Saving…' : 'Save site settings'}
          </button>
          {settingsMsg && (
            <span className={settingsMsg.ok ? 'status-text ok' : 'status-text err'}>{settingsMsg.text}</span>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Telegram storage</h2>
        <p className="hint">
          Checks that the bot token works, the bot can reach your channel, and the database file is
          readable.
        </p>
        <button className="btn btn-ghost" onClick={runTest} disabled={testBusy}>
          {testBusy ? 'Testing…' : 'Test connection'}
        </button>
        {testResult && (
          <p className={testResult.ok ? 'status-text ok' : 'status-text err'}>{testResult.text}</p>
        )}
      </div>

      <p className="hint center">
        <a href="/">← Back to the site</a>
      </p>
    </div>
  );
}
