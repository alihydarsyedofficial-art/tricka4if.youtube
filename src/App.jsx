import React, { useState, useEffect, useRef } from 'react';
import { YT_SHIELD_SCRIPT, turboDirectDownload } from './engine/ytShield';

const DEFAULT_VIDEO_ID = 'jfKfPfyJRdk';

const CATEGORIES = [
  { label: '🏠 YT Home / Lo-Fi', query: '', videoId: DEFAULT_VIDEO_ID },
  { label: '🎵 Bangla Songs', query: 'bangla hit songs', videoId: '' },
  { label: '🎬 Full Movies', query: 'bangla full movie', videoId: '' },
  { label: '🎧 Chill Beats', query: 'chill lofi radio', videoId: '' },
  { label: '🔥 Trending Mix', query: 'trending music mix', videoId: '' },
];

function extractVideoId(input) {
  const text = (input || '').trim();
  if (!text) return '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) return text;

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

function isDirectMediaUrl(rawUrl) {
  return /\.(mp4|mp3|m4a|webm|ogg|wav)(\?.*)?$/i.test((rawUrl || '').trim());
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
  const [turboMode, setTurboMode] = useState(true);
  const [downloadFormat, setDownloadFormat] = useState('HD-1080p');
  const [isDownloading, setIsDownloading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('YT Mod Ready • No Login • AdGuard & Sleep Guard Active');

  const wvRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isDesktop = typeof window !== 'undefined' && Boolean(window.require);

  useEffect(() => {
    const wv = wvRef.current;
    if (!wv) return;
    const onReady = () => wv.executeJavaScript(YT_SHIELD_SCRIPT).catch(() => {});
    wv.addEventListener('dom-ready', onReady);
    return () => wv.removeEventListener('dom-ready', onReady);
  }, [nativeYtUrl]);

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
      setStatusMsg('Default YouTube Mod loaded');
      return;
    }

    if (isDirectMediaUrl(raw)) {
      setActiveVideoId('');
      setActiveQuery('');
      setNativeYtUrl(raw);
      setStatusMsg(`Direct media loaded: ${raw}`);
      return;
    }

    const vid = extractVideoId(raw);
    if (vid) {
      setActiveVideoId(vid);
      setActiveQuery('');
      setNativeYtUrl(`https://www.youtube.com/watch?v=${vid}`);
      setStatusMsg(`Playing Video ID: ${vid}`);
    } else {
      setActiveQuery(raw);
      setNativeYtUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(raw)}`);
      setStatusMsg(`Search ready for "${raw}" — YouTube-এ সরাসরি খুলতে বা প্লে করতে নিচের বাটন ব্যবহার করুন`);
    }
  };

  const selectCategory = (cat) => {
    setSearchText(cat.query);
    setActiveQuery(cat.query);
    setActiveVideoId(cat.videoId || DEFAULT_VIDEO_ID);
    if (cat.query) {
      setNativeYtUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(cat.query)}`);
      setStatusMsg(`Category selected: ${cat.label} ("${cat.query}")`);
    } else {
      setNativeYtUrl('https://www.youtube.com');
      setStatusMsg('Default YouTube Home / Lo-Fi active');
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
            y: Math.max(80, window.innerHeight - 350),
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

  const handleDownload = async () => {
    setIsDownloading(true);
    const ext = downloadFormat === 'MP3-Audio' ? 'mp3' : 'mp4';
    const fileName = `venom-yt-${Date.now()}.${ext}`;
    const targetUrl = isDirectMediaUrl(searchText) ? searchText.trim() : nativeYtUrl;

    try {
      if (isDirectMediaUrl(targetUrl)) {
        setStatusMsg(`Turbo (${turboMode ? 'Fast Chunk' : 'Standard'}) downloading ${fileName}...`);
        await turboDirectDownload(targetUrl, fileName);
        setStatusMsg(`Downloaded to device storage: ${fileName}`);
      } else {
        await navigator.clipboard?.writeText(targetUrl).catch(() => {});
        setStatusMsg(
          `লিংক কপি হয়েছে (${downloadFormat})। সরাসরি .mp4/.mp3 মিডিয়া লিংক দিলে Turbo Download সরাসরি ফাইল সেভ করবে।`
        );
      }
    } catch {
      setStatusMsg(
        `ডাইরেক্ট স্ট্রিম সীমাবদ্ধ। লিংক কপি হয়েছে (${downloadFormat})—এক্সটার্নাল/সার্ভার ডাউনলোডারে পেস্ট করে সেভ করতে পারবেন।`
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const directFile = isDirectMediaUrl(nativeYtUrl);
  const embedVideoId = activeVideoId || DEFAULT_VIDEO_ID;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${embedVideoId}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3`;

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(circle at top left, #1e1b4b 0%, #090d16 48%, #05070d 100%)',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        overflowX: 'hidden',
      }}
    >
      {/* টপ YouTube Mod বার */}
      <div
        style={{
          minHeight: '56px',
          padding: '8px 14px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.28)',
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
          }}
        >
          ▶ YT Mod
        </button>

        <form
          onSubmit={handleSearchOrOpen}
          style={{
            flex: '1 1 240px',
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
            placeholder="গান, চ্যানেল, মুভি সার্চ করুন বা YouTube / .mp4/.mp3 লিংক দিন..."
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f1f5f9',
              fontSize: '12.5px',
            }}
          />
          <button
            type="submit"
            style={{
              background: 'rgba(239, 68, 68, 0.22)',
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
          }}
        >
          🎵 {audioOnly ? 'MP3 ON' : 'MP3 Mode'}
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
          }}
        >
          🌙 {sleepGuard ? 'Sleep ON' : 'Sleep OFF'}
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
          }}
        >
          {pinned || floatingCard ? '📌 Floating ON' : '📌 Float'}
        </button>
      </div>

      {/* ক্যাটাগরি ও Turbo Download বার */}
      <div
        style={{
          padding: '8px 14px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          background: 'rgba(15, 23, 42, 0.65)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.label}
              onClick={() => selectCategory(cat)}
              style={{
                background: 'rgba(30, 41, 59, 0.85)',
                color: '#f1f5f9',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
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
              color: '#38bdf8',
              fontSize: '11.5px',
              textDecoration: 'none',
              padding: '4px 8px',
            }}
          >
            ↗ Open YouTube
          </a>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
          <select
            value={downloadFormat}
            onChange={(e) => setDownloadFormat(e.target.value)}
            style={{
              background: '#020617',
              color: '#e2e8f0',
              border: '1px solid rgba(148, 163, 184, 0.35)',
              borderRadius: '8px',
              padding: '5px 8px',
              fontSize: '11px',
            }}
          >
            <option value="HD-1080p">HD 1080p</option>
            <option value="MP3-Audio">MP3 Audio</option>
          </select>

          <button
            onClick={() => setTurboMode((prev) => !prev)}
            style={{
              background: turboMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(30, 41, 59, 0.8)',
              color: turboMode ? '#fbbf24' : '#94a3b8',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '8px',
              padding: '5px 8px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⚡ Turbo {turboMode ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={handleDownload}
            disabled={isDownloading}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#03130d',
              border: 'none',
              borderRadius: '8px',
              padding: '5px 11px',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {isDownloading ? 'Saving...' : '⬇ Download'}
          </button>
        </div>
      </div>

      {/* স্ট্যাটাস বার */}
      <div
        style={{
          padding: '5px 14px',
          fontSize: '11px',
          color: '#94a3b8',
          background: 'rgba(2, 6, 23, 0.7)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
        }}
      >
        {statusMsg}
      </div>

      {/* সার্চ কুইক-লঞ্চ ব্যানার (যখন কোনো কিওয়ার্ড সার্চ করা হয়, যাতে embed unavailable না দেখায়) */}
      {activeQuery && !isDesktop && (
        <div
          style={{
            margin: '10px 12px 0',
            padding: '10px 14px',
            borderRadius: '12px',
            background: 'rgba(30, 41, 59, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            fontSize: '12px',
          }}
        >
          <span>
            🔍 Search Query: <strong>{activeQuery}</strong> — সরাসরি YouTube রেজাল্ট খুলতে বা নিচের প্লেয়ারে স্ট্রিম চালান।
          </span>
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(activeQuery)}`}
            target="_blank"
            rel="noreferrer"
            style={{
              background: '#ef4444',
              color: '#fff',
              padding: '5px 12px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '11.5px',
            }}
          >
            ▶ YouTube-এ সার্চ খুলুন
          </a>
        </div>
      )}

      {/* মেইন প্লেয়ার / ফ্লোটিং উইন্ডো */}
      <div style={{ flex: 1, position: 'relative', padding: '12px', minHeight: '400px' }}>
        <div
          style={{
            width: floatingCard ? 'min(440px, 92vw)' : '100%',
            height: floatingCard ? '265px' : audioOnly ? '170px' : '100%',
            minHeight: audioOnly ? '150px' : '360px',
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
            ) : directFile ? (
              <video
                src={nativeYtUrl}
                controls
                autoPlay
                style={{ width: '100%', height: '100%', background: '#000' }}
              />
            ) : (
              <iframe
                src={embedUrl}
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
            YT Floating Mode সক্রিয় — প্লেয়ারটি ড্র্যাগ করে যেকোনো জায়গায় সরাতে পারেন।
          </div>
        )}
      </div>
    </div>
  );
}
