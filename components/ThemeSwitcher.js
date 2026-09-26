'use client';

import { useEffect, useState } from 'react';
import { THEMES, DEFAULT_THEME, THEME_STORAGE_KEY, themeName } from '../lib/themes';

// Floating theme picker, available on every page section. The initial theme is
// applied before first paint by the inline script in app/layout.js; this
// component only reflects and changes it.
export default function ThemeSwitcher() {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const applied = document.documentElement.dataset.theme;
    if (applied) setTheme(applied);
  }, []);

  const choose = (key) => {
    setTheme(key);
    setOpen(false);
    document.documentElement.dataset.theme = key;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, key);
    } catch {
      // private mode etc. — theme just won't persist
    }
  };

  return (
    <>
      {open && <div className="theme-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
      <div className="theme-switcher">
        <button className="theme-fab" onClick={() => setOpen(!open)} aria-expanded={open} title="Change theme">
          <span
            className="theme-dot-sm"
            style={{ background: THEMES.find((t) => t.key === theme)?.dot, borderColor: THEMES.find((t) => t.key === theme)?.ring }}
          />
          <span>{themeName(theme)}</span>
          <span className="theme-caret">▾</span>
        </button>
        {open && (
          <div className="theme-menu" role="menu">
            {THEMES.map((t) => (
              <button key={t.key} role="menuitem" className={t.key === theme ? 'active' : ''} onClick={() => choose(t.key)}>
                <span className="theme-dot-sm" style={{ background: t.dot, borderColor: t.ring }} />
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
