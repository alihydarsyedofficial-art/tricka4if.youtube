import React, { useState, useEffect, useRef } from 'react';
import { YT_SHIELD_SCRIPT } from './engine/ytShield';

const YT_HOME_URL = 'https://www.youtube.com';

export default function App() {
  const [ytUrl, setYtUrl] = useState(YT_HOME_URL);
  const [address, setAddress] = useState(YT_HOME_URL);
  const [pinned, setPinned] = useState(false);
  const [floatingCard, setFloatingCard] = useState(false);
  const [floatPos, setFloatPos] = useState({ x: null, y: null });
  const [sleepGuard, setSleepGuard] = useState(true);
  const [customCssActive, setCustomCssActive] = useState(true);

  const wvRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isDesktop = typeof window !== 'undefined' && Boolean(window.require);

  // ডেস্কটপ অ্যাপে ডিফল্ট YouTube লোড হলেই কাস্টমাইজেশন স্ক্রিপ্ট ইনজেক্ট হবে
  useEffect(() => {
    const wv = wvRef.current;
    if (!wv) return;
    const onReady = () => {
      if (customCssActive) {
        wv.executeJavaScript(YT_SHIELD_SCRIPT).catch(() => {});
      }
    };
    wv.addEventListener('dom-ready', onReady);
    return () => wv.removeEventListener('dom-ready', onReady);
  }, [ytUrl, customCssActive]);

  // স্ক্রিন/সেশন অ্যাক্টিভ রাখার Guard
  useEffect(() => {
    let wakeLock = null;
    async function manageWakeLock() {
      try {
        if (sleepGuard && 'wakeLock' in navigator) {
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
  }, [sleepGuard]);

  const handleNavigate = (e) => {
    e.preventDefault();
    const val = address.trim();
    if (!val) {
      setYtUrl(YT_HOME_URL);
      setAddress(YT_HOME_URL);
      return;
    }
    if (val.startsWith('http://') || val.startsWith('https://')) {
      setYtUrl(val);
    } else if (val.includes('.')) {
      setYtUrl(`https://${val}`);
    } else {
      setYtUrl(`${YT_HOME_URL}/results?search_query=${encodeURIComponent(val)}`);
    }
  };

  const toggleFloat = () => {
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
            y: Math.max(76, window.innerHeight - 340),
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

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(circle at top left, #1e1b4b 0%, #090d16 50%, #05070d 100%)',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      }}
    >
      {/* Brave / YouTube Mod টপ বার */}
      <div
        style={{
          minHeight: '56px',
          padding: '8px 14px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(15, 23, 42, 0.92)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.28)',
        }}
      >
        <button
          onClick={() => {
            setYtUrl(YT_HOME_URL);
            setAddress(YT_HOME_URL);
          }}
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
          ▶ YouTube
        </button>

        <form
          onSubmit={handleNavigate}
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
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="YouTube-এ যা সার্চ বা খুলতে চান লিখুন..."
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
            Go
          </button>
        </form>

        <button
          onClick={() => setCustomCssActive((prev) => !prev)}
          style={{
            background: customCssActive ? 'rgba(16, 185, 129, 0.18)' : 'rgba(30, 41, 59, 0.85)',
            color: customCssActive ? '#34d399' : '#94a3b8',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '999px',
            padding: '6px 11px',
            fontSize: '11.5px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🛡️ {customCssActive ? 'Mod Patch ON' : 'Mod Patch OFF'}
        </button>

        <button
          onClick={() => setSleepGuard((prev) => !prev)}
          style={{
            background: sleepGuard ? 'rgba(168, 85, 247, 0.2)' : 'rgba(30, 41, 59, 0.85)',
            color: sleepGuard ? '#e9d5ff' : '#94a3b8',
            border: '1px solid rgba(168, 85, 247, 0.35)',
            borderRadius: '999px',
            padding: '6px 11px',
            fontSize: '11.5px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🌙 {sleepGuard ? 'Background ON' : 'Background OFF'}
        </button>

        <button
          onClick={toggleFloat}
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

      {/* মূল ভিউ এরিয়া */}
      <div style={{ flex: 1, position: 'relative', padding: '14px', minHeight: '420px' }}>
        {isDesktop ? (
          <div
            style={{
              width: '100%',
              height: 'calc(100vh - 86px)',
              borderRadius: '14px',
              overflow: 'hidden',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: '#000',
            }}
          >
            <webview
              ref={wvRef}
              src={ytUrl}
              style={{ width: '100%', height: '100%' }}
              allowpopups="true"
              useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            />
          </div>
        ) : (
          <div
            style={{
              width: floatingCard ? 'min(440px, 92vw)' : '100%',
              maxWidth: floatingCard ? '440px' : '760px',
              margin: floatingCard ? '0' : '24px auto',
              position: floatingCard ? 'fixed' : 'relative',
              left: floatingCard && floatPos.x !== null ? `${floatPos.x}px` : 'auto',
              top: floatingCard && floatPos.y !== null ? `${floatPos.y}px` : 'auto',
              zIndex: floatingCard ? 999 : 1,
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid rgba(239, 68, 68, 0.38)',
              background: 'rgba(15, 23, 42, 0.92)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75)',
            }}
          >
            {floatingCard && (
              <div
                onMouseDown={startDragFloat}
                onTouchStart={startDragFloat}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  background: 'rgba(2, 6, 23, 0.95)',
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
                <span>⋮⋮ Drag YouTube Float</span>
                <button
                  onClick={() => setFloatingCard(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#f87171',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            <div style={{ padding: '22px' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '8px' }}>
                Direct YouTube Mod Hub
              </div>
              <p style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 14px' }}>
                ওয়েব ব্রাউজারে Google/YouTube নিরাপত্তার কারণে <code>youtube.com</code> সরাসরি পেজের ভেতর এমবেড হতে দেয় না।
                আসল YouTube ইন্টারফেস ও কাস্টমাইজেশন সরাসরি চালানোর জন্য নিচের বাটন থেকে YouTube খুলুন অথবা{' '}
                <strong>.exe / .apk</strong> অ্যাপে <code>&lt;webview&gt;</code> / <code>WebView</code> দিয়ে সরাসরি <code>https://www.youtube.com</code> লোড করুন।
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <a
                  href={ytUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                    color: '#fff',
                    padding: '9px 16px',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '12.5px',
                  }}
                >
                  ▶ Open Direct YouTube
                </a>

                <button
                  onClick={() => {
                    setYtUrl(YT_HOME_URL);
                    setAddress(YT_HOME_URL);
                  }}
                  style={{
                    background: 'rgba(30, 41, 59, 0.9)',
                    color: '#e2e8f0',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    padding: '9px 14px',
                    borderRadius: '10px',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Reset to YouTube Home
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
