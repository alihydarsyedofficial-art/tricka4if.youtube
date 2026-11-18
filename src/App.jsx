import React, { useState, useEffect, useRef } from 'react';
import { YT_SHIELD_SCRIPT } from './engine/ytShield';

const QUICK_PICKS = [
  { label: 'YT Home', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
  { label: 'Lo-Fi Beats', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
  { label: 'Bangla Music', url: 'bangla song playlist' },
  { label: 'Movies', url: 'full movie' },
];

function toEmbedUrl(rawUrl) {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return 'https://www.youtube-nocookie.com/embed/jfKfPfyJRdk?autoplay=1&rel=0';
  }

  try {
    const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '');
      if (id) return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    }
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      const q = u.searchParams.get('search_query');
      if (q) {
        return `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(q)}`;
      }
    }
    return `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(trimmed)}`;
  } catch {
    return `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(trimmed)}`;
  }
}

export default function App() {
  const [query, setQuery] = useState('https://www.youtube.com/watch?v=jfKfPfyJRdk');
  const [ytUrl, setYtUrl] = useState('https://www.youtube.com/watch?v=jfKfPfyJRdk');
  const [pinned, setPinned] = useState(false);
  const [floatingCard, setFloatingCard] = useState(false);
  const [floatPos, setFloatPos] = useState({ x: null, y: null });

  const wvRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isDesktop = typeof window !== 'undefined' && Boolean(window.require);

  useEffect(() => {
    const wv = wvRef.current;
    if (!wv) return;
    const onReady = () => wv.executeJavaScript(YT_SHIELD_SCRIPT);
    wv.addEventListener('dom-ready', onReady);
    return () => wv.removeEventListener('dom-ready', onReady);
  }, [ytUrl]);

  const goYouTube = (e) => {
    e.preventDefault();
    const val = query.trim();
    if (!val) return;
    const next = val.startsWith('http')
      ? val
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(val)}`;
    setYtUrl(next);
  };

  const togglePinFloat = () => {
    const next = !pinned;
    setPinned(next);
    if (isDesktop) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('set-float-mode', next);
    } else {
      setFloatingCard((prev) => {
        const nextFloat = !prev;
        if (nextFloat) {
          setFloatPos({
            x: Math.max(16, window.innerWidth - 460),
            y: Math.max(70, window.innerHeight - 350),
          });
        }
        return nextFloat;
      });
    }
  };

  const popOutVideo = () => {
    if (isDesktop && wvRef.current?.executeJavaScript) {
      wvRef.current.executeJavaScript(`
        (() => {
          const v = document.querySelector('video');
          if (v?.requestPictureInPicture) v.requestPictureInPicture();
        })();
      `);
    } else {
      setFloatingCard((prev) => {
        const nextFloat = !prev;
        if (nextFloat) {
          setFloatPos({
            x: Math.max(16, window.innerWidth - 460),
            y: Math.max(70, window.innerHeight - 350),
          });
        }
        return nextFloat;
      });
    }
  };

  const startDragFloat = (e) => {
    if (!floatingCard || isDesktop) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const currentX = floatPos.x ?? 20;
    const currentY = floatPos.y ?? 80;

    dragOffsetRef.current = {
      x: clientX - currentX,
      y: clientY - currentY,
    };

    const onMove = (moveEvent) => {
      const mx = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const my = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const maxX = Math.max(8, window.innerWidth - 448);
      const maxY = Math.max(60, window.innerHeight - 280);
      setFloatPos({
        x: Math.min(maxX, Math.max(8, mx - dragOffsetRef.current.x)),
        y: Math.min(maxY, Math.max(60, my - dragOffsetRef.current.y)),
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
  };

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(circle at top left, #172554 0%, #090d16 45%, #05070d 100%)',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* প্রিমিয়াম টপ নেভিগেশন বার */}
      <div
        style={{
          height: '54px',
          padding: '0 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.22)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => {
            const home = 'https://www.youtube.com/watch?v=jfKfPfyJRdk';
            setQuery(home);
            setYtUrl(home);
          }}
          style={{
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '7px 12px',
            fontWeight: 700,
            fontSize: '12px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
            whiteSpace: 'nowrap',
          }}
        >
          ▶ YT Pure
        </button>

        <form
          onSubmit={goYouTube}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(2, 6, 23, 0.85)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: '999px',
            padding: '4px 12px',
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="YouTube লিংক বা সার্চ কিওয়ার্ড লিখুন..."
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f1f5f9',
              fontSize: '13px',
            }}
          />
          <button
            type="submit"
            style={{
              background: 'rgba(34, 211, 238, 0.16)',
              color: '#22d3ee',
              border: '1px solid rgba(34, 211, 238, 0.35)',
              borderRadius: '999px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go
          </button>
        </form>

        <div
          style={{
            padding: '5px 10px',
            borderRadius: '999px',
            background: 'rgba(16, 185, 129, 0.14)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#34d399',
            fontSize: '11px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          🛡️ DNS Shield ON
        </div>

        <button
          onClick={popOutVideo}
          style={{
            background: 'linear-gradient(135deg, #22d3ee, #3b82f6)',
            color: '#04101d',
            border: 'none',
            borderRadius: '999px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          📺 PiP
        </button>

        <button
          onClick={togglePinFloat}
          style={{
            background: pinned || floatingCard ? '#fbbf24' : 'rgba(30, 41, 59, 0.9)',
            color: pinned || floatingCard ? '#090d16' : '#e2e8f0',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: '999px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {pinned || floatingCard ? '📌 Floating ON' : '📌 Float'}
        </button>
      </div>

      {/* শর্টকাট কুইক-বার */}
      <div
        style={{
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(15, 23, 42, 0.55)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Quick:</span>
        {QUICK_PICKS.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              const target = item.url.startsWith('http')
                ? item.url
                : `https://www.youtube.com/results?search_query=${encodeURIComponent(item.url)}`;
              setQuery(target);
              setYtUrl(target);
            }}
            style={{
              background: 'rgba(30, 41, 59, 0.75)',
              color: '#e2e8f0',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '8px',
              padding: '4px 10px',
              fontSize: '11px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* মেইন কন্টেন্ট / ফ্লোটিং উইন্ডো এরিয়া */}
      <div style={{ flex: 1, position: 'relative', padding: '12px' }}>
        <div
          style={{
            width: floatingCard ? 'min(440px, 92vw)' : '100%',
            height: floatingCard ? '265px' : '100%',
            position: floatingCard ? 'fixed' : 'relative',
            left: floatingCard && floatPos.x !== null ? `${floatPos.x}px` : 'auto',
            top: floatingCard && floatPos.y !== null ? `${floatPos.y}px` : 'auto',
            zIndex: floatingCard ? 999 : 1,
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid rgba(34, 211, 238, 0.35)',
            boxShadow: floatingCard
              ? '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 24px rgba(34, 211, 238, 0.25)'
              : '0 12px 32px rgba(0, 0, 0, 0.5)',
            background: '#000',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {floatingCard && !isDesktop && (
            <div
              onMouseDown={startDragFloat}
              onTouchStart={startDragFloat}
              style={{
                height: '28px',
                padding: '0 10px',
                background: 'rgba(15, 23, 42, 0.95)',
                borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'move',
                fontSize: '11px',
                color: '#cbd5e1',
                userSelect: 'none',
              }}
            >
              <span>⋮⋮ Drag Float Window</span>
              <button
                onClick={() => setFloatingCard(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#f87171',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ✕
              </button>
            </div>
          )}

          <div style={{ flex: 1, width: '100%', height: '100%' }}>
            {isDesktop ? (
              <webview
                ref={wvRef}
                src={ytUrl}
                style={{ width: '100%', height: '100%' }}
                allowpopups="true"
                useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
              />
            ) : (
              <iframe
                src={toEmbedUrl(ytUrl)}
                title="YT Pure Player"
                style={{ width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            )}
          </div>
        </div>

        {floatingCard && (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              fontSize: '13px',
            }}
          >
            Floating Mini Mode সক্রিয় আছে — প্লেয়ারটি ড্র্যাগ করে যেকোনো জায়গায় সরাতে পারেন।
          </div>
        )}
      </div>
    </div>
  );
}
