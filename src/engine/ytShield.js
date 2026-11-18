export const YT_SHIELD_SCRIPT = `
(function() {
  if (window.__YT_SHIELD_ACTIVE__) return;
  window.__YT_SHIELD_ACTIVE__ = true;

  // ১. সব ইউটিউব অ্যাড, স্পনসর ও পপআপ ব্লক
  const css = document.createElement('style');
  css.textContent = \`
    .ytp-ad-module, .ytp-ad-overlay-container, #masthead-ad,
    ytd-promoted-sparkles-web-renderer, ytd-display-ad-renderer,
    .video-ads, .ytd-banner-promo-renderer, ytd-ad-slot-renderer,
    #player-ads, .ytd-statement-renderer, .ytd-in-feed-ad-layout-renderer {
      display: none !important;
      height: 0 !important;
    }
  \`;
  (document.head || document.documentElement).appendChild(css);

  // ২. প্রি-রোল ও মিড-রোল ভিডিও অ্যাড অটো-স্কিপ / ফাস্ট-ফরওয়ার্ড
  let wasAdPlaying = false;

  setInterval(() => {
    const video = document.querySelector('video');
    const isAd = Boolean(document.querySelector('.ad-showing, .ad-interrupting'));

    if (isAd && video) {
      wasAdPlaying = true;
      video.muted = true;
      if (isFinite(video.duration) && video.duration > 0) {
        video.currentTime = video.duration;
      }
      try {
        video.playbackRate = 16.0;
      } catch {}
    } else if (wasAdPlaying && video) {
      wasAdPlaying = false;
      try {
        if (video.playbackRate === 16.0) video.playbackRate = 1.0;
      } catch {}
    }

    const skip = document.querySelector(
      '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button'
    );
    if (skip && typeof skip.click === 'function') {
      skip.click();
    }
  }, 200);

  // ৩. ব্যাকগ্রাউন্ডে গান চালু রাখা (Tab Switch বা Screen Off করলেও পজ হবে না)
  try {
    Object.defineProperty(document, 'hidden', { get: () => false });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
  } catch {}
  document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);

  // ৪. ফ্লোটিং PiP বাটন (1080p লকসহ)
  function mountFloatButton() {
    const targetParent = document.body || document.documentElement;
    if (!targetParent || document.getElementById('venom-yt-float-btn')) return;

    const floatBtn = document.createElement('button');
    floatBtn.id = 'venom-yt-float-btn';
    floatBtn.type = 'button';
    floatBtn.innerHTML = '▶ Float YT';
    Object.assign(floatBtn.style, {
      position: 'fixed',
      bottom: '76px',
      right: '16px',
      zIndex: '999999',
      padding: '9px 15px',
      borderRadius: '999px',
      border: 'none',
      background: '#ef4444',
      color: '#fff',
      fontWeight: '700',
      fontSize: '12px',
      boxShadow: '0 6px 20px rgba(239,68,68,0.45)',
      cursor: 'pointer'
    });

    floatBtn.onclick = async () => {
      const v = document.querySelector('video');
      const player = document.getElementById('movie_player');
      try {
        if (player?.setPlaybackQualityRange) {
          player.setPlaybackQualityRange('hd1080', 'hd1080');
        } else if (player?.setPlaybackQuality) {
          player.setPlaybackQuality('hd1080');
        }
      } catch {}

      try {
        if (v && v.requestPictureInPicture) {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          } else {
            await v.requestPictureInPicture();
          }
        }
      } catch (err) {
        console.warn('PiP trigger failed:', err);
      }
    };

    targetParent.appendChild(floatBtn);
  }

  setInterval(mountFloatButton, 1500);
})();
`;
