'use client';

import SocialIcon from './SocialIcon';

// Full-viewport landing screen. The visitor sees only this until they choose
// to enter (button or scroll) — the gallery lives below the fold.
export default function LandingHero({ siteName, tagline, socials, heroSrc, photoCount, warning, error, loading }) {
  const name = siteName || 'vyu.frames';

  return (
    <section className="landing" id="top">
      {heroSrc && <div className="landing-bg" style={{ backgroundImage: `url(${heroSrc})` }} aria-hidden="true" />}
      <div className="landing-shade" aria-hidden="true" />

      <div className="landing-top">
        <span className="landing-brand">{loading ? '…' : name}</span>
      </div>

      <div className="landing-main">
        {!loading && photoCount > 0 && (
          <div className="landing-eyebrow">
            Photography · {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
          </div>
        )}
        <h1 className="landing-title">{loading ? '\u00a0' : name}</h1>
        {!loading && tagline && <p className="landing-tagline">{tagline}</p>}

        {!loading && error && <p className="landing-note">{error}</p>}

        {!loading && !error && warning && (
          <p className="landing-note">
            {warning}
            <br />
            Set up your Telegram bot and channel first — steps are in the README.
          </p>
        )}
        {!loading && !error && !warning && photoCount === 0 && (
          <p className="landing-note">
            No photos yet.
            <br />
            Add your first one from the <a href="/admin" className="empty-link">admin dashboard</a>.
          </p>
        )}

        <div className="landing-row">
          {!error && !warning && photoCount > 0 && (
            <a className="enter-btn" href="#gallery">
              Enter Gallery <span className="enter-arrow">↓</span>
            </a>
          )}
          {!!socials?.length && (
            <div className="landing-socials">
              {socials.map((s, i) => (
                <SocialIcon key={i} label={s.label} url={s.url} />
              ))}
            </div>
          )}
        </div>
      </div>

      {!error && !warning && photoCount > 0 && (
        <a className="landing-scroll" href="#gallery" aria-label="Scroll to gallery">
          <span className="landing-scroll-line" />
        </a>
      )}
    </section>
  );
}
