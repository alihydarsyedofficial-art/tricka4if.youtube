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
  document.head.appendChild(css);

  // ২. প্রি-রোল ও মিড-রোল ভিডিও অ্যাড অটো-স্কিপ / ফাস্ট-ফরওয়ার্ড
  setInterval(() => {
    const video = document.querySelector('video');
    const isAd = document.querySelector('.ad-showing, .ad-interrupting');
    if (isAd && video) {
      video.muted = true;
      if (isFinite(video.duration)) video.currentTime = video.duration;
      video.playbackRate = 16.0;
    }
    const skip = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
    if (skip) skip.click();
  }, 200);

  // ৩. ব্যাকগ্রাউন্ডে গান চালু রাখা (Tab Switch বা Screen Off করলেও পজ হবে না)
  Object.defineProperty(document, 'hidden', { get: () => false });
  Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
  document.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);

  // ৪. ফ্লোটিং PiP বাটন (1080p লকসহ)
  const floatBtn = document.createElement('button');
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
    if (player && player.setPlaybackQualityRange) {
      player.setPlaybackQualityRange('hd1080', 'hd1080');
    }
    if (v && v.requestPictureInPicture) {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    }
  };

  setTimeout(() => document.body.appendChild(floatBtn), 1500);
})();
`;
