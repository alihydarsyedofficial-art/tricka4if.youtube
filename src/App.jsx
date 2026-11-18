import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ShieldCheck,
  Search,
  Headphones,
  Moon,
  PictureInPicture2,
  Download,
  ExternalLink,
  Play,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  GripHorizontal,
  Minimize2,
  Maximize2,
  Zap,
  Sparkles,
  Radio
} from 'lucide-react';
import {
  initFullShield,
  setScreenWakeLock,
  turboDirectDownload,
  getEmbeddedShieldScript
} from './engine/ytShield.js';

const CATEGORIES = [
  { id: 'all', label: 'Trending', query: '' },
  { id: 'music', label: 'Music & Mixes', query: 'trending music mix 2026' },
  { id: 'lofi', label: 'Lo-Fi & Focus', query: 'lofi hip hop radio beats to relax study' },
  { id: 'tech', label: 'Tech & Coding', query: 'software engineering AI coding documentary' },
  { id: 'gaming', label: 'Gaming Live', query: 'gaming live streams highlights' },
  { id: 'podcasts', label: 'Podcasts', query: 'full length tech business podcast' },
  { id: 'news', label: '24/7 World News', query: 'live world news stream' }
];

const DIRECT_LAUNCH_CARDS = [
  {
    title: 'YouTube Home Feed (No Login)',
    subtitle: 'Jump straight into YouTube trending & browse feed without signing in.',
    url: 'https://www.youtube.com',
    tag: 'Direct Feed'
  },
  {
    title: 'YouTube Music & Audio Mixes',
    subtitle: 'Non-stop playlists, official audio tracks, and background mixes.',
    url: 'https://www.youtube.com/results?search_query=non+stop+music+mix',
    tag: 'MP3 / Audio'
  },
  {
    title: 'Lo-Fi & Deep Work Beats',
    subtitle: 'Continuous chill instrumental streams ideal for Sleep Guard mode.',
    url: 'https://www.youtube.com/results?search_query=lofi+beats+radio',
    tag: 'Focus'
  },
  {
    title: 'Tech, Cyber & Dev Streams',
    subtitle: 'Latest developer keynotes, security talks, and tutorials.',
    url: 'https://www.youtube.com/results?search_query=cybersecurity+developer+conference',
    tag: 'Tech'
  }
];

function extractYouTubeVideoId(rawInput) {
  if (!rawInput) return null;
  const trimmed = rawInput.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /(?:music\.youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/
  ];
  for (const regex of patterns) {
    const match = trimmed.match(regex);
    if (match && match[1]) return match[1];
  }
  return null;
}

function isDirectMediaFileUrl(rawInput) {
  if (!rawInput) return false;
  return /^https?:\/\/.+\.(mp4|mp3|webm|m4a|ogg|wav|aac|mkv)(\?.*|#.*)?$/i.test(rawInput.trim());
}

export default function App() {
  const isElectron = useMemo(() => {
    return (
      typeof navigator !== 'undefined' &&
      navigator.userAgent.toLowerCase().includes('electron')
    );
  }, []);

  const isAndroidBridge = useMemo(() => {
    return typeof window !== 'undefined' && Boolean(window.VenomAndroidBridge);
  }, []);

  const [searchInput, setSearchInput] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeVideoId, setActiveVideoId] = useState('');
  const [electronUrl, setElectronUrl] = useState('https://www.youtube.com');

  // Modes
  const [mp3AudioMode, setMp3AudioMode] = useState(false);
  const [sleepGuard, setSleepGuard] = useState(true);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [floatMode, setFloatMode] = useState(false);
  const [floatMinimized, setFloatMinimized] = useState(false);

  // Draggable Web Floating Card coordinates
  const [floatPos, setFloatPos] = useState({ x: 20, y: 84 });
  const dragStateRef = useRef({ dragging: false, offsetX: 0, offsetY: 0 });

  // Turbo Downloader state
  const [showDownloader, setShowDownloader] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadFormat, setDownloadFormat] = useState('1080p');
  const [turboEnabled, setTurboEnabled] = useState(true);
  const [downloadStatus, setDownloadStatus] = useState(null);

  const webviewRef = useRef(null);

  // Initialize local browser shield & background guard on mount
  useEffect(() => {
    initFullShield(window, document);
  }, []);

  // Manage Screen Wake Lock for Sleep / Background Guard
  useEffect(() => {
    let mounted = true;
    const syncWakeLock = async () => {
      const res = await setScreenWakeLock(sleepGuard);
      if (mounted) setWakeLockActive(res.active);
      if (isAndroidBridge && window.VenomAndroidBridge.setKeepScreenOn) {
        window.VenomAndroidBridge.setKeepScreenOn(sleepGuard);
      }
    };
    syncWakeLock();

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && sleepGuard) {
        syncWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [sleepGuard, isAndroidBridge]);

  // Attach Electron <webview> event listeners & shield injection
  useEffect(() => {
    if (!isElectron) return;
    const wv = webviewRef.current;
    if (!wv) return;

    const injectIntoWebview = () => {
      try {
        wv.executeJavaScript(getEmbeddedShieldScript());
        if (mp3AudioMode) {
          wv.executeJavaScript(`
            (function(){
              let st = document.getElementById('venom-mp3-audio-only');
              if (!st) {
                st = document.createElement('style');
                st.id = 'venom-mp3-audio-only';
                st.textContent = 'video.html5-main-video { opacity: 0.04 !important; filter: blur(24px) !important; }';
                document.head.appendChild(st);
              }
            })();
          `);
        } else {
          wv.executeJavaScript(`
            (function(){
              const st = document.getElementById('venom-mp3-audio-only');
              if (st) st.remove();
            })();
          `);
        }
      } catch (_) {}
    };

    const handleNavigate = (e) => {
      if (e.url) setElectronUrl(e.url);
      injectIntoWebview();
    };

    wv.addEventListener('dom-ready', injectIntoWebview);
    wv.addEventListener('did-finish-load', injectIntoWebview);
    wv.addEventListener('did-navigate', handleNavigate);
    wv.addEventListener('did-navigate-in-page', handleNavigate);

    return () => {
      wv.removeEventListener('dom-ready', injectIntoWebview);
      wv.removeEventListener('did-finish-load', injectIntoWebview);
      wv.removeEventListener('did-navigate', handleNavigate);
      wv.removeEventListener('did-navigate-in-page', handleNavigate);
    };
  }, [isElectron, mp3AudioMode]);

  // Toggle Electron native Always-On-Top Float Window via IPC
  const toggleFloatMode = () => {
    const next = !floatMode;
    setFloatMode(next);
    setFloatMinimized(false);

    if (isElectron) {
      try {
        if (window.venomElectron?.setFloatMode) {
          window.venomElectron.setFloatMode(next);
        } else if (window.require) {
          window.require('electron').ipcRenderer.send('set-float-mode', next);
        }
      } catch (_) {}
    } else if (isAndroidBridge && window.VenomAndroidBridge.enterPip && next) {
      window.VenomAndroidBridge.enterPip();
    }
  };

  // Pointer drag handlers for Web Draggable Floating Card
  const onFloatPointerDown = (e) => {
    dragStateRef.current = {
      dragging: true,
      offsetX: e.clientX - floatPos.x,
      offsetY: e.clientY - floatPos.y
    };
  };

  useEffect(() => {
    const onPointerMove = (e) => {
      if (!dragStateRef.current.dragging) return;
      const maxX = Math.max(12, window.innerWidth - 402);
      const maxY = Math.max(12, window.innerHeight - 120);
      const nextX = Math.min(maxX, Math.max(12, e.clientX - dragStateRef.current.offsetX));
      const nextY = Math.min(maxY, Math.max(12, e.clientY - dragStateRef.current.offsetY));
      setFloatPos({ x: nextX, y: nextY });
    };
    const onPointerUp = () => {
      dragStateRef.current.dragging = false;
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  // Unified Search / URL / Video ID Handler
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const raw = searchInput.trim();
    if (!raw) return;

    // 1. Direct media file (.mp4, .mp3, .webm, .m4a, etc.) -> trigger Turbo Download
    if (isDirectMediaFileUrl(raw)) {
      setDownloadUrl(raw);
      setShowDownloader(true);
      return;
    }

    const extractedId = extractYouTubeVideoId(raw);

    // 2. Electron Native <webview>
    if (isElectron && webviewRef.current) {
      const targetUrl = extractedId
        ? `https://www.youtube.com/watch?v=${extractedId}`
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(raw)}`;
      webviewRef.current.loadURL(targetUrl);
      setElectronUrl(targetUrl);
      return;
    }

    // 3. Android Native WebView Bridge
    if (isAndroidBridge && window.VenomAndroidBridge.loadYouTubeUrl) {
      const targetUrl = extractedId
        ? `https://m.youtube.com/watch?v=${extractedId}`
        : `https://m.youtube.com/results?search_query=${encodeURIComponent(raw)}`;
      window.VenomAndroidBridge.loadYouTubeUrl(targetUrl);
      return;
    }

    // 4. Web Mode (Vercel): Never use broken listType=search embed iframes!
    if (extractedId) {
      setActiveVideoId(extractedId);
    } else {
      const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(raw)}`;
      window.open(ytSearchUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCategorySelect = (cat) => {
    setActiveCategory(cat.id);
    const targetUrl = cat.query
      ? `https://www.youtube.com/results?search_query=${encodeURIComponent(cat.query)}`
      : 'https://www.youtube.com';

    if (isElectron && webviewRef.current) {
      webviewRef.current.loadURL(targetUrl);
      setElectronUrl(targetUrl);
      return;
    }

    if (isAndroidBridge && window.VenomAndroidBridge.loadYouTubeUrl) {
      const mobileUrl = targetUrl.replace('www.youtube.com', 'm.youtube.com');
      window.VenomAndroidBridge.loadYouTubeUrl(mobileUrl);
      return;
    }

    if (cat.query) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleTurboDownload = async (e) => {
    e.preventDefault();
    const target = (downloadUrl || (isElectron ? electronUrl : '')).trim();
    if (!target) {
      setDownloadStatus({ type: 'error', text: 'Paste a direct media URL (.mp4, .mp3, .webm, .m4a) or YouTube link.' });
      return;
    }

    if (isDirectMediaFileUrl(target)) {
      setDownloadStatus({ type: 'loading', text: 'Initializing Turbo stream...' });
      try {
        const ext = downloadFormat === 'mp3' ? 'mp3' : 'mp4';
        const baseName = target.split('?')[0].split('/').pop() || `venom-yt-${Date.now()}.${ext}`;
        const res = await turboDirectDownload(target, {
          filename: baseName,
          turbo: turboEnabled,
          onProgress: (p) => {
            setDownloadStatus({
              type: 'loading',
              text: `${p.mode}: ${p.percent}%${p.speedMbps ? ` (${p.speedMbps} Mbps)` : ''}`
            });
          }
        });
        setDownloadStatus({
          type: 'success',
          text: `Saved ${res.filename} (${res.mode})`
        });
      } catch (err) {
        setDownloadStatus({ type: 'error', text: err.message || 'Download failed.' });
      }
      return;
    }

    // YouTube Video ID / URL stream handoff
    const vid = extractYouTubeVideoId(target) || activeVideoId;
    if (vid) {
      setDownloadStatus({
        type: 'success',
        text: `Prepared ${downloadFormat.toUpperCase()} (${turboEnabled ? 'Turbo' : 'Standard'}) target for Video ID: ${vid}`
      });
      const watchTarget = `https://www.youtube.com/watch?v=${vid}`;
      if (isAndroidBridge && window.VenomAndroidBridge.downloadUrl) {
        window.VenomAndroidBridge.downloadUrl(watchTarget, `yt-${vid}-${downloadFormat}.${downloadFormat === 'mp3' ? 'mp3' : 'mp4'}`);
      } else {
        window.open(watchTarget, '_blank', 'noopener,noreferrer');
      }
    } else {
      setDownloadStatus({
        type: 'error',
        text: 'Enter a valid direct media URL (.mp4/.mp3/.webm/.m4a) or YouTube video link.'
      });
    }
  };

  const renderWebPlayerCard = () => {
    if (!activeVideoId) return null;
    const embedSrc = `https://www.youtube-nocookie.com/embed/${activeVideoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

    return (
      <div className={floatMode ? 'floating-dock' : 'card-panel'} style={floatMode ? { left: floatPos.x, top: floatPos.y } : undefined}>
        {floatMode && (
          <div className="floating-header" onPointerDown={onFloatPointerDown}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
              <GripHorizontal size={15} color="#fda4af" />
              <span>YT Pure Float • {mp3AudioMode ? 'MP3 Audio' : '1080p'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="btn"
                style={{ padding: '3px 7px' }}
                onClick={() => setFloatMinimized((v) => !v)}
                title={floatMinimized ? 'Expand' : 'Minimize'}
              >
                {floatMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
              </button>
              <button
                type="button"
                className="btn"
                style={{ padding: '3px 7px' }}
                onClick={() => setFloatMode(false)}
                title="Dock back to page"
              >
                Dock
              </button>
            </div>
          </div>
        )}

        <div style={{ padding: floatMode ? 10 : 0 }}>
          {!floatMinimized && !mp3AudioMode && (
            <div className="video-aspect">
              <iframe
                src={embedSrc}
                title="YT Pure Float Player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          )}

          {mp3AudioMode && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(244,63,94,0.14), rgba(139,92,246,0.14))',
                border: '1px solid rgba(244,63,94,0.35)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 34 }}>
                  <span className="audio-wave-bar" style={{ animationDelay: '0s' }} />
                  <span className="audio-wave-bar" style={{ animationDelay: '0.2s' }} />
                  <span className="audio-wave-bar" style={{ animationDelay: '0.4s' }} />
                  <span className="audio-wave-bar" style={{ animationDelay: '0.15s' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>MP3 Audio Focus Active</div>
                  <div style={{ fontSize: 11.5, color: '#a1a1aa' }}>
                    Video canvas collapsed • Stream ID: {activeVideoId}
                  </div>
                </div>
              </div>
              <iframe
                src={embedSrc}
                title="Audio Stream"
                allow="autoplay; encrypted-media"
                style={{ width: 1, height: 1, opacity: 0, pointerEvents: 'none', border: 0 }}
              />
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginTop: 10
            }}
          >
            <span style={{ fontSize: 12, color: '#a1a1aa' }}>
              Active Stream ID: <strong style={{ color: '#f4f4f5' }}>{activeVideoId}</strong>
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href={`https://www.youtube.com/watch?v=${activeVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
              >
                <ExternalLink size={13} /> Open on YouTube
              </a>
              <button type="button" className="btn" onClick={() => setActiveVideoId('')}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-shell">
      {/* Top Control Header */}
      <header className="topbar">
        <div className="brand-group">
          <div className="brand-badge">
            <ShieldCheck size={19} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.2px', display: 'flex', alignItems: 'center', gap: 6 }}>
              YT Pure Float
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: 'rgba(16,185,129,0.16)',
                  color: '#6ee7b7',
                  border: '1px solid rgba(16,185,129,0.4)'
                }}
              >
                SHIELD ON
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#a1a1aa' }}>
              {isElectron ? 'Windows Desktop Mode' : isAndroidBridge ? 'Android Native WebView' : 'Web Pure Mode • No Login'}
            </div>
          </div>
        </div>

        {/* Electron Native Navigation Controls */}
        {isElectron && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              className="btn"
              style={{ padding: '7px 9px' }}
              onClick={() => webviewRef.current?.canGoBack() && webviewRef.current.goBack()}
              title="Back"
            >
              <ArrowLeft size={14} />
            </button>
            <button
              type="button"
              className="btn"
              style={{ padding: '7px 9px' }}
              onClick={() => webviewRef.current?.canGoForward() && webviewRef.current.goForward()}
              title="Forward"
            >
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              className="btn"
              style={{ padding: '7px 9px' }}
              onClick={() => webviewRef.current?.reload()}
              title="Reload"
            >
              <RotateCw size={14} />
            </button>
            <button
              type="button"
              className="btn"
              style={{ padding: '7px 9px' }}
              onClick={() => webviewRef.current?.loadURL('https://www.youtube.com')}
              title="YouTube Home"
            >
              <Home size={14} />
            </button>
          </div>
        )}

        {/* Instant Search / YouTube URL / Video ID Bar */}
        <form className="search-form" onSubmit={handleSearchSubmit}>
          <Search size={15} color="#a1a1aa" />
          <input
            type="text"
            className="search-input"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search YouTube, paste YouTube URL / Video ID, or direct .mp4/.mp3..."
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px' }}>
            <Play size={13} /> Go
          </button>
        </form>

        {/* Feature Toggles: MP3 Mode, Sleep Guard, Float / PiP, Turbo Download */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className={`btn ${mp3AudioMode ? 'btn-active-violet' : ''}`}
            onClick={() => setMp3AudioMode((v) => !v)}
            title="Audio / MP3 Focus Mode"
          >
            <Headphones size={14} />
            <span>MP3 Mode</span>
          </button>

          <button
            type="button"
            className={`btn ${sleepGuard ? 'btn-active-emerald' : ''}`}
            onClick={() => setSleepGuard((v) => !v)}
            title={wakeLockActive ? 'Screen Wake Lock + Background Guard Active' : 'Background Playback Guard'}
          >
            <Moon size={14} />
            <span>Sleep Guard</span>
          </button>

          <button
            type="button"
            className={`btn ${floatMode ? 'btn-active-amber' : ''}`}
            onClick={toggleFloatMode}
            title="Toggle Floating / PiP Window"
          >
            <PictureInPicture2 size={14} />
            <span>{floatMode ? 'Floating' : 'Float / PiP'}</span>
          </button>

          <button
            type="button"
            className={`btn ${showDownloader ? 'btn-primary' : ''}`}
            onClick={() => setShowDownloader((v) => !v)}
            title="Turbo Media Downloader"
          >
            <Download size={14} />
            <span>Turbo DL</span>
          </button>
        </div>
      </header>

      {/* Quick Category Strip */}
      <nav className="category-strip">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`pill ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => handleCategorySelect(cat)}
          >
            {cat.label}
          </button>
        ))}
      </nav>

      {/* Turbo Download Drawer */}
      {showDownloader && (
        <section style={{ padding: '12px 16px 0' }}>
          <div className="card-panel" style={{ borderColor: 'rgba(244,63,94,0.35)' }}>
            <form
              onSubmit={handleTurboDownload}
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
            >
              <input
                type="text"
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
                placeholder="Paste direct media URL (.mp4, .mp3, .webm, .m4a) or YouTube link..."
                style={{
                  flex: 1,
                  minWidth: 220,
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: '#18181f',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f4f4f5',
                  fontSize: 13,
                  outline: 'none'
                }}
              />

              <select
                value={downloadFormat}
                onChange={(e) => setDownloadFormat(e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: '#18181f',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f4f4f5',
                  fontSize: 12.5,
                  fontWeight: 600
                }}
              >
                <option value="1080p">1080p HD (MP4)</option>
                <option value="mp3">MP3 Audio (320kbps)</option>
              </select>

              <button
                type="button"
                className={`btn ${turboEnabled ? 'btn-active-amber' : ''}`}
                onClick={() => setTurboEnabled((v) => !v)}
              >
                <Zap size={14} />
                <span>Turbo {turboEnabled ? 'ON' : 'OFF'}</span>
              </button>

              <button type="submit" className="btn btn-primary">
                <Download size={14} />
                <span>Download</span>
              </button>
            </form>

            {downloadStatus && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color:
                    downloadStatus.type === 'error'
                      ? '#fda4af'
                      : downloadStatus.type === 'success'
                      ? '#6ee7b7'
                      : '#fcd34d'
                }}
              >
                {downloadStatus.text}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Main Content Area */}
      <main className="main-workspace">
        {isElectron ? (
          <webview
            ref={webviewRef}
            src="https://www.youtube.com"
            partition="persist:ytpure"
            allowpopups="true"
            useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            className="electron-webview-frame"
          />
        ) : (
          <>
            {/* Active Video / Draggable Floating Player */}
            {renderWebPlayerCard()}

            {/* YouTube-First Direct Launcher Hub (Zero Broken Embed Search Iframes) */}
            <div className="card-panel">
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 14
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={17} color="#f43f5e" />
                    YouTube-First Instant Hub (No Google Login Required)
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#a1a1aa' }}>
                    Paste any YouTube URL or 11-character Video ID above to play inside the Draggable Float / MP3 Deck, or jump directly into YouTube feeds below.
                  </p>
                </div>

                {isAndroidBridge ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => window.VenomAndroidBridge.loadYouTubeUrl('https://m.youtube.com')}
                  >
                    <Radio size={14} /> Launch Native m.youtube.com
                  </button>
                ) : (
                  <a
                    href="https://www.youtube.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                  >
                    <ExternalLink size={14} /> Open YouTube.com
                  </a>
                )}
              </div>

              <div className="grid-cards">
                {DIRECT_LAUNCH_CARDS.map((item) => (
                  <div key={item.title} className="quick-card">
                    <div>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: 'rgba(244,63,94,0.14)',
                          color: '#fda4af',
                          marginBottom: 8
                        }}
                      >
                        {item.tag}
                      </span>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>{item.subtitle}</div>
                    </div>

                    {isAndroidBridge ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          window.VenomAndroidBridge.loadYouTubeUrl(
                            item.url.replace('www.youtube.com', 'm.youtube.com')
                          )
                        }
                      >
                        <Play size={13} /> Open in Shielded WebView
                      </button>
                    ) : (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn"
                      >
                        <ExternalLink size={13} /> Launch Feed
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
