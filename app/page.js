'use client';

import { useEffect, useState, useCallback } from 'react';
import LandingHero from '../components/LandingHero';
import ThemeSwitcher from '../components/ThemeSwitcher';

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(-1);

  useEffect(() => {
    fetch('/api/photos')
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setData(r.data);
        else setError(r.error || 'Failed to load');
      })
      .catch(() => setError('Failed to load — please refresh.'));
  }, []);

  const photos = data?.photos || [];

  const close = useCallback(() => setLightbox(-1), []);
  const step = useCallback(
    (dir) => setLightbox((i) => (i < 0 ? i : (i + dir + photos.length) % photos.length)),
    [photos.length]
  );

  useEffect(() => {
    if (lightbox < 0) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, close, step]);

  const current = lightbox >= 0 ? photos[lightbox] : null;

  return (
    <>
      <ThemeSwitcher />

      <LandingHero
        siteName={data?.siteName}
        tagline={data?.tagline}
        socials={data?.socials || []}
        heroSrc={photos[0]?.src}
        photoCount={photos.length}
        warning={data?.warning}
        error={error}
        loading={!data && !error}
      />

      {error && <div className="empty error">{error}</div>}

      <section id="gallery" className="gallery-section">
        <div className="gallery-head">
          <h2 className="gallery-title">Gallery</h2>
          <span className="gallery-count">
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </span>
        </div>

        {!error && photos.length > 0 && (
          <main className="gallery">
            {photos.map((p, i) => (
              <figure className="ph" key={p.id} onClick={() => setLightbox(i)}>
                <img src={p.src} alt={p.title || 'Photo'} loading="lazy" />
                {p.title && <figcaption>{p.title}</figcaption>}
              </figure>
            ))}
          </main>
        )}

        <footer className="site-foot">
          <span>{data?.siteName || 'QNXEITSG'}</span>
        </footer>
      </section>

      {current && (
        <div className="lb" onClick={close}>
          <div className="lb-inner" onClick={(e) => e.stopPropagation()}>
            <img src={current.src} alt={current.title || 'Photo'} />
            <div className="lb-meta">
              <div>
                {current.title && <div className="lb-title">{current.title}</div>}
                {current.desc && <div className="lb-desc">{current.desc}</div>}
              </div>
              <div className="lb-counter">
                {lightbox + 1} / {photos.length}
              </div>
            </div>
            <button className="lb-btn lb-close" onClick={close} aria-label="Close">
              ×
            </button>
            <button className="lb-btn lb-prev" onClick={() => step(-1)} aria-label="Previous">
              ‹
            </button>
            <button className="lb-btn lb-next" onClick={() => step(1)} aria-label="Next">
              ›
            </button>
          </div>
        </div>
      )}
    </>
  );
}
