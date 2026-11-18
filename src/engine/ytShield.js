/**
 * YT Pure Float / Venom YT Shield Engine
 * - CSS Ad & Promo Suppression
 * - Safe Auto-Skip & Fast-Forward with Guaranteed PlaybackRate Restoration
 * - Tab / Screen-Off Background Playback Guard + Screen Wake Lock
 * - Non-Duplicate 1080p + Picture-in-Picture (PiP) Player HUD Button
 * - Turbo Multi-Part & Direct Media Downloader (.mp4, .mp3, .webm, .m4a, etc.)
 */

const SHIELD_STYLE_ID = 'venom-yt-shield-css';
const HUD_BUTTON_ID = 'venom-yt-1080p-pip-btn';

const AD_BLOCK_CSS = `
  /* Masthead, feed, companion, overlay, and upsell suppression */
  #masthead-ad,
  ytd-banner-promo-renderer,
  ytd-statement-banner-renderer,
  ytd-video-masthead-ad-v3-renderer,
  ytd-primetime-promo-renderer,
  ytd-ad-slot-renderer,
  ytd-in-feed-ad-layout-renderer,
  ytd-promoted-sparkles-web-renderer,
  ytd-promoted-video-renderer,
  ytd-display-ad-renderer,
  ytd-companion-slot-renderer,
  ytd-action-companion-ad-renderer,
  ytd-player-legacy-desktop-watch-ads-renderer,
  ytd-mealbar-promo-renderer,
  ytm-promoted-sparkles-web-renderer,
  ytm-companion-ad-renderer,
  .ytp-ad-module,
  .ytp-ad-overlay-container,
  .ytp-ad-text-overlay,
  .ytp-ad-image-overlay,
  .ytp-suggested-action,
  #player-ads,
  #merch-shelf,
  tp-yt-paper-dialog.ytd-popup-container[aria-label*="Premium"],
  ytd-enforcement-message-view-model {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
`;

export function injectShieldStyles(doc = document) {
  if (!doc || !doc.head) return;
  if (doc.getElementById(SHIELD_STYLE_ID)) return;

  const style = doc.createElement('style');
  style.id = SHIELD_STYLE_ID;
  style.textContent = AD_BLOCK_CSS;
  doc.head.appendChild(style);
}

export function startAdAutoSkipper(doc = document) {
  if (!doc || doc.__venomSkipperActive) return () => {};
  doc.__venomSkipperActive = true;

  let savedUserRate = 1.0;
  let savedMutedState = false;
  let wasInAd = false;

  const skipSelectors = [
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-skip-ad-button',
    '.ytp-ad-overlay-close-button',
    'button.ytp-ad-skip-button-modern',
    '.ytp-ad-skip-button-container button'
  ];

  const tick = () => {
    try {
      const player = doc.querySelector('.html5-video-player');
      const video = doc.querySelector('video.html5-main-video') || doc.querySelector('video');
      if (!video) return;

      const isAdShowing = Boolean(
        player &&
          (player.classList.contains('ad-showing') ||
            player.classList.contains('ad-interrupting') ||
            doc.querySelector('.ytp-ad-player-overlay'))
      );

      if (isAdShowing) {
        if (!wasInAd) {
          savedUserRate = video.playbackRate && video.playbackRate <= 4 ? video.playbackRate : 1.0;
          savedMutedState = Boolean(video.muted);
          wasInAd = true;
        }

        video.muted = true;

        for (const selector of skipSelectors) {
          const btn = doc.querySelector(selector);
          if (btn && typeof btn.click === 'function') {
            btn.click();
          }
        }

        if (Number.isFinite(video.duration) && video.duration > 0.5) {
          const targetTime = Math.max(0, video.duration - 0.15);
          if (video.currentTime < targetTime) {
            video.currentTime = targetTime;
          }
        }
        if (video.playbackRate < 16) {
          video.playbackRate = 16;
        }
      } else if (wasInAd) {
        // Restore normal playback speed & mute state immediately after ad finishes
        video.playbackRate = savedUserRate || 1.0;
        video.muted = savedMutedState;
        wasInAd = false;
      } else if (video.playbackRate > 4) {
        // Safety guard against stuck high playbackRate
        video.playbackRate = 1.0;
      }
    } catch (_) {
      // Ignore transient DOM mutations during SPA navigation
    }
  };

  const intervalId = setInterval(tick, 250);
  const observer = new MutationObserver(() => tick());
  if (doc.body) {
    observer.observe(doc.body, { childList: true, subtree: true });
  }

  return () => {
    clearInterval(intervalId);
    observer.disconnect();
    doc.__venomSkipperActive = false;
  };
}

export function enableBackgroundPlaybackGuard(win = window, doc = document) {
  if (!win || !doc || doc.__venomBgGuardActive) return;
  doc.__venomBgGuardActive = true;

  const defineVisibleProp = (prop, value) => {
    try {
      Object.defineProperty(doc, prop, {
        configurable: true,
        get: () => value
      });
    } catch (_) {
      // Property non-configurable in restricted context
    }
  };

  defineVisibleProp('hidden', false);
  defineVisibleProp('webkitHidden', false);
  defineVisibleProp('visibilityState', 'visible');
  defineVisibleProp('webkitVisibilityState', 'visible');

  const stopVisibilityEvent = (event) => {
    event.stopImmediatePropagation();
  };

  ['visibilitychange', 'webkitvisibilitychange', 'pagehide', 'freeze'].forEach((evt) => {
    doc.addEventListener(evt, stopVisibilityEvent, true);
    win.addEventListener(evt, stopVisibilityEvent, true);
  });

  // Periodic activity heartbeat to prevent YouTube "Video paused. Continue watching?" idle dialog
  setInterval(() => {
    const confirmDialog = doc.querySelector(
      'yt-confirm-dialog-renderer #confirm-button, ytd-popup-container tp-yt-paper-button#confirm-button'
    );
    if (confirmDialog && typeof confirmDialog.click === 'function') {
      confirmDialog.click();
    }
  }, 4000);
}

let activeWakeLock = null;

export async function setScreenWakeLock(enabled) {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
    return { supported: false, active: false };
  }

  try {
    if (enabled) {
      if (!activeWakeLock) {
        activeWakeLock = await navigator.wakeLock.request('screen');
        activeWakeLock.addEventListener('release', () => {
          activeWakeLock = null;
        });
      }
      return { supported: true, active: true };
    } else if (activeWakeLock) {
      await activeWakeLock.release();
      activeWakeLock = null;
      return { supported: true, active: false };
    }
  } catch (_) {
    return { supported: true, active: Boolean(activeWakeLock) };
  }
  return { supported: true, active: Boolean(activeWakeLock) };
}

export function mountQualityAndPipControl(doc = document) {
  if (!doc) return;

  const ensureButton = () => {
    if (doc.getElementById(HUD_BUTTON_ID)) return;

    const rightControls = doc.querySelector('.ytp-right-controls');
    const host = rightControls || doc.body;
    if (!host) return;

    const btn = doc.createElement('button');
    btn.id = HUD_BUTTON_ID;
    btn.type = 'button';
    btn.title = 'Force 1080p HD & Toggle Picture-in-Picture';
    btn.textContent = '1080p • PiP';
    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: rightControls ? '28px' : '32px',
      margin: rightControls ? '10px 6px 0 0' : '0',
      padding: '0 10px',
      borderRadius: '999px',
      border: '1px solid rgba(244,63,94,0.65)',
      background: 'rgba(15,15,20,0.88)',
      color: '#fda4af',
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '0.3px',
      cursor: 'pointer',
      zIndex: '99999',
      position: rightControls ? 'relative' : 'fixed',
      bottom: rightControls ? 'auto' : '68px',
      right: rightControls ? 'auto' : '14px'
    });

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Request highest available quality (1080p) via YouTube internal player API if exposed
      const moviePlayer = doc.getElementById('movie_player');
      if (moviePlayer && typeof moviePlayer.setPlaybackQualityRange === 'function') {
        try {
          moviePlayer.setPlaybackQualityRange('hd1080', 'hd1080');
        } catch (_) {}
      }

      const video = doc.querySelector('video.html5-main-video') || doc.querySelector('video');
      if (!video) return;

      try {
        if (doc.pictureInPictureElement) {
          await doc.exitPictureInPicture();
        } else if (typeof video.requestPictureInPicture === 'function') {
          await video.requestPictureInPicture();
        } else if (typeof video.webkitSetPresentationMode === 'function') {
          video.webkitSetPresentationMode(
            video.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture'
          );
        }
      } catch (_) {}
    });

    if (rightControls) {
      rightControls.insertBefore(btn, rightControls.firstChild);
    } else {
      doc.body.appendChild(btn);
    }
  };

  ensureButton();
  setInterval(ensureButton, 2000);
}

export function initFullShield(win = window, doc = document) {
  injectShieldStyles(doc);
  startAdAutoSkipper(doc);
  enableBackgroundPlaybackGuard(win, doc);
  mountQualityAndPipControl(doc);
}

/**
 * Turbo Direct Media Downloader (.mp4, .mp3, .webm, .m4a, .wav, .ogg, .aac, .mkv)
 * Uses concurrent HTTP Range chunking when supported by the origin server,
 * with automatic single-stream fallback and progress reporting.
 */
export async function turboDirectDownload(url, options = {}) {
  const {
    filename,
    turbo = true,
    concurrency = 4,
    onProgress = () => {}
  } = options;

  if (!url || typeof url !== 'string') {
    throw new Error('A valid direct media URL is required.');
  }

  const cleanUrl = url.trim();
  const inferredName =
    filename ||
    cleanUrl.split('?')[0].split('#')[0].split('/').pop() ||
    `venom-media-${Date.now()}.mp4`;

  const triggerSave = (blob, name) => {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
  };

  const startedAt = performance.now();

  try {
    // Probe server for Content-Length and Accept-Ranges support
    const headResp = await fetch(cleanUrl, { method: 'HEAD' });
    const contentLength = Number(headResp.headers.get('content-length') || 0);
    const acceptRanges = (headResp.headers.get('accept-ranges') || '').toLowerCase();
    const contentType = headResp.headers.get('content-type') || 'application/octet-stream';

    if (turbo && contentLength > 1024 * 512 && acceptRanges.includes('bytes')) {
      const parts = Math.min(concurrency, 6);
      const chunkSize = Math.ceil(contentLength / parts);
      const loadedPerPart = new Array(parts).fill(0);

      const report = () => {
        const loaded = loadedPerPart.reduce((a, b) => a + b, 0);
        const elapsedSec = Math.max(0.1, (performance.now() - startedAt) / 1000);
        const speedMbps = ((loaded * 8) / (1024 * 1024) / elapsedSec).toFixed(2);
        onProgress({
          percent: Math.min(100, Math.round((loaded / contentLength) * 100)),
          loaded,
          total: contentLength,
          speedMbps,
          mode: `Turbo ${parts}x`
        });
      };

      const buffers = await Promise.all(
        Array.from({ length: parts }, async (_, index) => {
          const start = index * chunkSize;
          const end = Math.min(contentLength - 1, start + chunkSize - 1);
          const partResp = await fetch(cleanUrl, {
            headers: { Range: `bytes=${start}-${end}` }
          });
          if (!partResp.ok && partResp.status !== 206) {
            throw new Error(`Range chunk ${index + 1} failed (${partResp.status})`);
          }
          const reader = partResp.body.getReader();
          const chunks = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loadedPerPart[index] += value.byteLength;
            report();
          }
          return new Blob(chunks);
        })
      );

      const merged = new Blob(buffers, { type: contentType });
      triggerSave(merged, inferredName);
      onProgress({ percent: 100, loaded: contentLength, total: contentLength, mode: `Turbo ${parts}x` });
      return { ok: true, filename: inferredName, size: contentLength, mode: `Turbo ${parts}x` };
    }
  } catch (_) {
    // Fall through to standard streaming fetch or browser anchor download
  }

  // Single-stream progress download fallback
  try {
    const resp = await fetch(cleanUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const total = Number(resp.headers.get('content-length') || 0);
    const contentType = resp.headers.get('content-type') || 'application/octet-stream';
    const reader = resp.body.getReader();
    const chunks = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      const elapsedSec = Math.max(0.1, (performance.now() - startedAt) / 1000);
      const speedMbps = ((loaded * 8) / (1024 * 1024) / elapsedSec).toFixed(2);
      onProgress({
        percent: total ? Math.min(100, Math.round((loaded / total) * 100)) : 50,
        loaded,
        total,
        speedMbps,
        mode: 'Stream'
      });
    }

    const blob = new Blob(chunks, { type: contentType });
    triggerSave(blob, inferredName);
    onProgress({ percent: 100, loaded, total: total || loaded, mode: 'Stream' });
    return { ok: true, filename: inferredName, size: loaded, mode: 'Stream' };
  } catch (_) {
    // Cross-origin direct download fallback when origin lacks CORS headers
    const anchor = document.createElement('a');
    anchor.href = cleanUrl;
    anchor.download = inferredName;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    onProgress({ percent: 100, loaded: 0, total: 0, mode: 'Direct Browser' });
    return { ok: true, filename: inferredName, size: 0, mode: 'Direct Browser' };
  }
}

/**
 * Self-contained injectable string for Electron <webview> and Android WebView
 */
export function getEmbeddedShieldScript() {
  return `
    (function() {
      if (window.__VENOM_YT_INJECTED__) return;
      window.__VENOM_YT_INJECTED__ = true;

      const styleId = '${SHIELD_STYLE_ID}';
      if (!document.getElementById(styleId) && document.head) {
        const s = document.createElement('style');
        s.id = styleId;
        s.textContent = ${JSON.stringify(AD_BLOCK_CSS)};
        document.head.appendChild(s);
      }

      try {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      } catch (e) {}

      ['visibilitychange', 'webkitvisibilitychange', 'pagehide'].forEach(evt => {
        document.addEventListener(evt, e => e.stopImmediatePropagation(), true);
        window.addEventListener(evt, e => e.stopImmediatePropagation(), true);
      });

      let savedRate = 1.0;
      let savedMute = false;
      let inAd = false;

      setInterval(() => {
        const player = document.querySelector('.html5-video-player');
        const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
        if (!video) return;

        const adActive = Boolean(
          player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'))
        );

        if (adActive) {
          if (!inAd) {
            savedRate = video.playbackRate && video.playbackRate <= 4 ? video.playbackRate : 1.0;
            savedMute = Boolean(video.muted);
            inAd = true;
          }
          video.muted = true;
          document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-overlay-close-button')
            .forEach(b => b.click && b.click());
          if (isFinite(video.duration) && video.duration > 0.5) {
            video.currentTime = Math.max(0, video.duration - 0.15);
          }
          video.playbackRate = 16;
        } else if (inAd) {
          video.playbackRate = savedRate || 1.0;
          video.muted = savedMute;
          inAd = false;
        } else if (video.playbackRate > 4) {
          video.playbackRate = 1.0;
        }

        if (!document.getElementById('${HUD_BUTTON_ID}')) {
          const controls = document.querySelector('.ytp-right-controls');
          const btn = document.createElement('button');
          btn.id = '${HUD_BUTTON_ID}';
          btn.type = 'button';
          btn.textContent = '1080p • PiP';
          btn.style.cssText = 'display:inline-flex;align-items:center;height:28px;margin:10px 6px 0 0;padding:0 10px;border-radius:999px;border:1px solid rgba(244,63,94,0.7);background:rgba(12,12,16,0.9);color:#fda4af;font-size:11px;font-weight:700;cursor:pointer;z-index:99999;';
          if (!controls) {
            btn.style.position = 'fixed';
            btn.style.bottom = '68px';
            btn.style.right = '14px';
          }
          btn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const mp = document.getElementById('movie_player');
            if (mp && mp.setPlaybackQualityRange) {
              try { mp.setPlaybackQualityRange('hd1080', 'hd1080'); } catch (_) {}
            }
            try {
              if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
              } else if (video.requestPictureInPicture) {
                await video.requestPictureInPicture();
              } else if (window.VenomAndroidBridge && window.VenomAndroidBridge.enterPip) {
                window.VenomAndroidBridge.enterPip();
              }
            } catch (_) {}
          };
          if (controls) {
            controls.insertBefore(btn, controls.firstChild);
          } else if (document.body) {
            document.body.appendChild(btn);
          }
        }
      }, 300);
    })();
  `;
}
