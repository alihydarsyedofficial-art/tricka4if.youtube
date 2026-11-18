import React, { useState, useEffect, useRef } from 'react';
import { YT_SHIELD_SCRIPT } from './engine/ytShield';

const DEFAULT_VIDEO_ID = 'jfKfPfyJRdk';

const CATEGORIES = [
  { label: '🏠 Home / Lo-Fi', query: '', videoId: DEFAULT_VIDEO_ID },
  { label: '🎵 Bangla Songs', query: 'bangla hit songs', videoId: '' },
  { label: '🎬 Movies', query: 'bangla full movie', videoId: '' },
  { label: '🎧 Chill Beats', query: 'chill lofi beats', videoId: '' },
  { label: '🔥 Trending Mix', query: 'trending music mix', videoId: '' },
];

function extractVideoId(input) {
  const text = (input || '').trim();
  if (!text) return '';

  // সরাসরি 11-character YouTube Video ID হলে
  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) {
    return text;
  }

  try {
    const url = new URL(text.startsWith('http') ? text : `https://${text}`);
    if (url.hostname.includes('youtu.be')) {
      return url.pathname.replace('/', '').slice(0, 11);
    }
    if (url.hostname.includes('youtube.com')) {
      const v = url.searchParams.get('v');
      if (v) return v.slice(0, 11);
      const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch) return shortsMatch[1];
    }
  } catch {
    // সার্চ কিওয়ার্ড হলে খালি রাখবে
  }
  return '';
}

function buildPlayerSrc({ videoId, searchQuery, audioOnly }) {
  const autoplay = '1';
  const modParams = `autoplay=${autoplay}&rel=0&modestbranding=1&iv_load_policy=3${
    audioOnly ? '&controls=1' : ''
  }`;

  if (videoId) {
    return `https://www.youtube-nocookie.com/embed/${videoId}?${modParams}`;
  }

  const q = encodeURIComponent((searchQuery || 'lofi hip hop').trim());
  return `https://www.youtube-nocookie.com/embed?listType=search&list=${q}&${modParams}`;
}

export default function App() {
  const [searchText, setSearchText] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [activeVideoId, setActiveVideoId] = useState(DEFAULT_VIDEO_ID);
  const [nativeYtUrl, setNativeYtUrl] = useState('https://www.youtube.com');

  const [pinned, setPinned] = useState(false);
  const [floatingCard, setFloatingCard] = useState(false);
  const [floatPos, setFloatPos] = useState({ x: null, y: null });
  const [audioOnly, setAudioOnly] = useState(false);
  const [sleepGuard, setSleepGuard] = useState(true);

  const wvRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isDesktop = typeof window !== 'undefined' && Boolean(window.require);

  // Desktop Electron Webview-তে ডিফল্ট YouTube + Shield Script
  useEffect(() => {
    const wv = wvRef.current;
    if (!wv) return;
    const onReady = () => wv.executeJavaScript(YT_SHIELD_SCRIPT).catch(() => {});
    wv.addEventListener('dom-ready', onReady);
    return () => wv.removeEventListener('dom-ready', onReady);
  }, [nativeYtUrl]);

  // Background / Sleep Guard
  useEffect(() => {
    let wakeLock = null;
    async function manageWakeLock() {
      try {
        if (sleepGuard && !audioOnly && 'wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch {
        // সাইলেন্ট ফলব্যাক
      }
    }
    manageWakeLock();
    return () => {
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, [sleepGuard, audioOnly]);

  const handleSearchOrOpen = (e) => {
    e.preventDefault();
    const raw = searchText.trim();

    if (!raw) {
      setActiveQuery('');
      setActiveVideoId(DEFAULT_VIDEO_ID);
      setNativeYtUrl('https://www.youtube.com');
      return;
    }

    const vid = extractVideoId(raw);
    if (vid) {
      setActiveVideoId(vid);
      setActiveQuery('');
      setNativeYtUrl(`https://www.youtube.com/watch?v=${vid}`);
    } else {
      setActiveVideoId('');
      setActiveQuery(raw);
      setNativeYtUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(raw)}`);
    }
  };

  const selectCategory = (cat) => {
    setSearchText(cat.query);
    setActiveQuery(cat.query);
    setActiveVideoId(cat.videoId || '');
    if (cat.query) {
      setNativeYtUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(cat.query)}`);
    } else {
      setNativeYtUrl('https://www.youtube.com');
    }
  };

  const toggleFloatMode = () => {
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
            y: Math.max(76, window.innerHeight - 350),
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
    dragOffsetRef.current = { x: clientX - currentX, y: clientY - currentY };

    const onMove = (moveEvent) => {
      const mx = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const my = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const maxX = Math.max(8, window.innerWidth - 448);
      const maxY = Math.max(64, window.innerHeight - 280);
      setFloatPos({
        x: Math.min(maxX, Math.max(8, mx - dragOffsetRef.current.x)),
        y: Math.min(maxY, Math.max(64, my - dragOffsetRef.current.y)),
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

  const playerSrc = buildPlayerSrc({
    videoId: activeVideoId,
    searchQuery: activeQuery,
    audioOnly,
  });

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(circle at top left, #1e1b4b 0%, #090d16 48%, #05070d 100%)',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* টপ YouTube Mod বার */}
      <div
        style={{
          height: '56px',
          padding: '0 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.28)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => selectCategory(CATEGORIES[0])}
          style={{
            background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '7px 12px',
            fontWeight: 800,
            fontSize: '12px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          ▶ YT Mod
        </button>

        {/* ডাইরেক্ট সার্চ বার (লিংক ছাড়াই যেকোনো গান/চ্যানেল/মুভি সার্চ) */}
        <form
          onSubmit={handleSearchOrOpen}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(2, 6, 23, 0.9)',
            border: '1px solid rgba(148, 163, 184, 0.28)',
            borderRadius: '999px',
            padding: '4px 12px',
          }}
        >
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="যেকোনো গান, চ্যানেল বা মুভি সার্চ করুন (No Login Required)..."
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
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              borderRadius: '999px',
              padding: '4px 11px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </form>

        <button
          onClick={() => setAudioOnly((prev) => !prev)}
          style={{
            background: audioOnly ? 'rgba(168, 85, 247, 0.28)' : 'rgba(30, 41, 59, 0.85)',
            color: audioOnly ? '#e9d5ff' : '#e2e8f0',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            borderRadius: '999px',
            padding: '6px 11px',
            fontSize: '11.5px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          🎵 {audioOnly ? 'Audio ON' : 'Audio'}
        </button>

        <button
          onClick={() => setSleepGuard((prev) => !prev)}
          style={{
            background: sleepGuard ? 'rgba(16, 185, 129, 0.16)' : 'rgba(30, 41, 59, 0.85)',
            color: sleepGuard ? '#34d399' : '#94a3b8',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '999px',
            padding: '6px 11px',
            fontSize: '11.5px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          🛡️ {sleepGuard ? 'Mod ON' : 'Mod OFF'}
        </button>

        <button
          onClick={toggleFloatMode}
          style={{
            background: pinned || floatingCard ? '#fbbf24' : 'rgba(30, 41, 59, 0.9)',
            color: pinned || floatingCard ? '#090d16' : '#e2e8f0',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: '999px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {pinned || floatingCard ? '📌 Floating ON' : '📌 Float'}
        </button>
      </div>

      {/* ক্যাটাগরি শর্টকাট বার */}
      <div
        style={{
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(15, 23, 42, 0.65)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat.label}
            onClick={() => selectCategory(cat)}
            style={{
              background: 'rgba(30, 41, 59, 0.85)',
              color: '#f1f5f9',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              padding: '5px 11px',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {cat.label}
          </button>
        ))}

        <a
          href={nativeYtUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            marginLeft: 'auto',
            color: '#38bdf8',
            fontSize: '11.5px',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          ↗ Open YouTube
        </a>
      </div>

      {/* মেইন YouTube প্লেয়ার / ফ্লোটিং উইন্ডো */}
      <div style={{ flex: 1, position: 'relative', padding: '12px' }}>
        <div
          style={{
            width: floatingCard ? 'min(440px, 92vw)' : '100%',
            height: floatingCard ? '265px' : audioOnly ? '170px' : '100%',
            position: floatingCard ? 'fixed' : 'relative',
            left: floatingCard && floatPos.x !== null ? `${floatPos.x}px` : 'auto',
            top: floatingCard && floatPos.y !== null ? `${floatPos.y}px` : 'auto',
            zIndex: floatingCard ? 999 : 1,
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            boxShadow: floatingCard
              ? '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 24px rgba(239, 68, 68, 0.25)'
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
                borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'move',
                fontSize: '11px',
                color: '#cbd5e1',
                userSelect: 'none',
              }}
            >
              <span>⋮⋮ Drag YT Float</span>
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
                src={nativeYtUrl}
                style={{ width: '100%', height: '100%' }}
                allowpopups="true"
                useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
              />
            ) : (
              <iframe
                src={playerSrc}
                title="YT Mod Player"
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
            YT Floating Mode সক্রিয় — নিচে/পাশে ড্র্যাগ করে যেকোনো জায়গায় সরাতে পারেন।
          </div>
        )}
      </div>
    </div>
  );
}
