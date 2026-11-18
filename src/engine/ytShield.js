export const YT_SHIELD_SCRIPT = `
(function() {
  if (window.__YT_SHIELD_ACTIVE__) return;
  window.__YT_SHIELD_ACTIVE__ = true;

  // ১. ইউটিউব অ্যাড, স্পনসর ও পপআপ ব্লক
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

  // ২. ভিডিও অ্যাড অটো-স্কিপ ও ফাস্ট-ফরওয়ার্ড
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

  // ৩. ব্যাকগ্রাউন্ড / স্ক্রিন অফ বা ট্যাব বদলালেও পজ না করা
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

export async function turboDirectDownload(fileUrl, filename = 'venom-media.mp4') {
  const response = await fetch(fileUrl);
  if (!response.ok || !response.body) {
    throw new Error('Direct stream unavailable');
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
  }

  const blob = new Blob(chunks);
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

  return received;
}
