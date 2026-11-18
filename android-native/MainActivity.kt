package com.tricka4if.venomyt

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.app.PictureInPictureParams
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.util.Rational
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import com.getcapacitor.BridgeActivity
import com.getcapacitor.BridgeWebViewClient
import java.io.ByteArrayInputStream

class MainActivity : BridgeActivity() {

    private val adDomainKeywords = listOf(
        "doubleclick.net",
        "googlesyndication.com",
        "googleadservices.com",
        "adservice.google.",
        "imasdk.googleapis.com",
        "/api/stats/ads",
        "/pagead/",
        "/ptracking",
        "/get_midroll_info",
        "s0.2mdn.net"
    )

    private val shieldInjectionJs = """
        (function() {
            if (window.__VENOM_ANDROID_SHIELD__) return;
            window.__VENOM_ANDROID_SHIELD__ = true;

            const css = '#masthead-ad, ytd-ad-slot-renderer, ytm-promoted-sparkles-web-renderer, ytm-companion-ad-renderer, .ytp-ad-module, .ytp-ad-overlay-container, #player-ads, ytd-mealbar-promo-renderer { display: none !important; }';
            const style = document.createElement('style');
            style.textContent = css;
            if (document.head) document.head.appendChild(style);

            try {
                Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
                Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
            } catch (e) {}

            ['visibilitychange', 'webkitvisibilitychange', 'pagehide'].forEach(function(evt) {
                document.addEventListener(evt, function(e) { e.stopImmediatePropagation(); }, true);
                window.addEventListener(evt, function(e) { e.stopImmediatePropagation(); }, true);
            });

            let savedRate = 1.0;
            let savedMuted = false;
            let wasAd = false;

            setInterval(function() {
                const player = document.querySelector('.html5-video-player');
                const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
                if (!video) return;

                const isAd = Boolean(player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting')));
                if (isAd) {
                    if (!wasAd) {
                        savedRate = (video.playbackRate && video.playbackRate <= 4) ? video.playbackRate : 1.0;
                        savedMuted = Boolean(video.muted);
                        wasAd = true;
                    }
                    video.muted = true;
                    document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-overlay-close-button')
                        .forEach(function(btn) { if (btn.click) btn.click(); });
                    if (isFinite(video.duration) && video.duration > 0.5) {
                        video.currentTime = Math.max(0, video.duration - 0.15);
                    }
                    video.playbackRate = 16;
                } else if (wasAd) {
                    video.playbackRate = savedRate || 1.0;
                    video.muted = savedMuted;
                    wasAd = false;
                } else if (video.playbackRate > 4) {
                    video.playbackRate = 1.0;
                }
            }, 300);
        })();
    """.trimIndent()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val webView: WebView = bridge?.webView ?: return

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            userAgentString =
                "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
        }

        webView.addJavascriptInterface(VenomAndroidJsBridge(webView), "VenomAndroidBridge")

        webView.webViewClient = object : BridgeWebViewClient(bridge) {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val url = request?.url?.toString()?.lowercase() ?: ""
                if (adDomainKeywords.any { keyword -> url.contains(keyword) }) {
                    return WebResourceResponse(
                        "text/plain",
                        "utf-8",
                        ByteArrayInputStream(ByteArray(0))
                    )
                }
                return super.shouldInterceptRequest(view, request)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (url != null && (url.contains("youtube.com") || url.contains("youtu.be"))) {
                    view?.evaluateJavascript(shieldInjectionJs, null)
                }
            }
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        enterSafePictureInPicture()
    }

    fun enterSafePictureInPicture() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (!packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) return
        if (isInPictureInPictureMode || isFinishing || isDestroyed) return

        try {
            val params = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(16, 9))
                .build()
            enterPictureInPictureMode(params)
        } catch (_: Exception) {
            // Safely ignore if system launcher or multi-window state denies PiP
        }
    }

    inner class VenomAndroidJsBridge(private val targetWebView: WebView) {
        @JavascriptInterface
        fun enterPip() {
            runOnUiThread { enterSafePictureInPicture() }
        }

        @JavascriptInterface
        fun loadYouTubeUrl(url: String) {
            runOnUiThread {
                if (url.startsWith("https://")) {
                    targetWebView.loadUrl(url)
                }
            }
        }

        @JavascriptInterface
        fun setKeepScreenOn(enabled: Boolean) {
            runOnUiThread {
                if (enabled) {
                    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                } else {
                    window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                }
            }
        }

        @JavascriptInterface
        fun downloadUrl(url: String, filename: String) {
            runOnUiThread {
                try {
                    val request = DownloadManager.Request(Uri.parse(url))
                        .setTitle(filename)
                        .setDescription("YT Pure Float Turbo Download")
                        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
                    val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                    dm.enqueue(request)
                } catch (_: Exception) {
                }
            }
        }
    }
}
