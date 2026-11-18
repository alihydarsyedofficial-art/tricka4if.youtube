import React, { useState, useEffect, useRef } from 'react';
import { YT_SHIELD_SCRIPT } from './engine/ytShield';

export default function App() {
  const [query, setQuery] = useState('https://www.youtube.com');
  const [ytUrl, setYtUrl] = useState('https://www.youtube.com');
  const [pinned, setPinned] = useState(false);
  const wvRef = useRef(null);
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
    }
  };

  const popOutVideo = () => {
    if (wvRef.current?.executeJavaScript) {
      wvRef.current.executeJavaScript(`
        (() => {
          const v = document.querySelector('video');
          if (v?.requestPictureInPicture) v.requestPictureInPicture();
        })();
      `);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
      {/* শর্টকাট YouTube টপ বার */}
      <div className="h-11 px-3 bg-zinc-900 border-b border-zinc-800 flex items-center gap-2">
        <button
          onClick={() => setYtUrl('https://www.youtube.com')}
          className="text-xs font-bold bg-red-600 px-2.5 py-1 rounded-md shrink-0"
        >
          ▶ YT Pure
        </button>

        <form onSubmit={goYouTube} className="flex-1 flex items-center bg-zinc-950 border border-zinc-700 rounded-full px-3 py-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="YouTube ভিডিও সার্চ বা লিংক দিন..."
            className="w-full bg-transparent text-xs outline-none"
          />
        </form>

        <span className="hidden sm:inline text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
          DNS Shield ON
        </span>

        <button
          onClick={popOutVideo}
          className="text-xs bg-cyan-500 text-zinc-950 font-bold px-2.5 py-1 rounded-full shrink-0"
        >
          PiP
        </button>

        <button
          onClick={togglePinFloat}
          className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${
            pinned ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-800 text-zinc-200'
          }`}
        >
          {pinned ? 'Unpin' : 'Float'}
        </button>
      </div>

      {/* মেইন YouTube প্লেয়ার ভিউ */}
      <div className="flex-1 bg-black">
        {isDesktop ? (
          <webview
            ref={wvRef}
            src={ytUrl}
            className="w-full h-full"
            allowpopups="true"
            useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
          />
        ) : (
          <iframe
            src={ytUrl.replace('watch?v=', 'embed/')}
            title="YouTube Pure"
            className="w-full h-full border-none"
            allow="autoplay; fullscreen; picture-in-picture"
          />
        )}
      </div>
    </div>
  );
}
