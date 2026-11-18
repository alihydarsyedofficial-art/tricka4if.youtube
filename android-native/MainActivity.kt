package com.tricka4if.venomyt

import android.app.PictureInPictureParams
import android.os.Build
import android.os.Bundle
import android.util.Rational
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import com.getcapacitor.BridgeActivity
import java.io.ByteArrayInputStream

class MainActivity : BridgeActivity() {

    private val blockList = listOf(
        "doubleclick.net",
        "googleadservices.com",
        "googlesyndication.com",
        "ads.youtube.com",
        "pagead2.googlesyndication.com"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val webView: WebView = this.bridge?.webView ?: return
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        }

        webView.loadUrl("https://m.youtube.com")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val url = request?.url?.toString() ?: ""
                val host = request?.url?.host ?: ""

                val isBlocked = blockList.any { host.contains(it, ignoreCase = true) } ||
                    url.contains("/api/stats/ads", ignoreCase = true) ||
                    url.contains("ptracking", ignoreCase = true)

                if (isBlocked) {
                    return WebResourceResponse(
                        "text/plain",
                        "UTF-8",
                        ByteArrayInputStream(ByteArray(0))
                    )
                }

                return super.shouldInterceptRequest(view, request)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                val js = """
                    (() => {
                      if (window.__VENOM_ANDROID_SHIELD__) return;
                      window.__VENOM_ANDROID_SHIELD__ = true;

                      setInterval(() => {
                        const skipBtn = document.querySelector(
                          '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button'
                        );
                        if (skipBtn && typeof skipBtn.click === 'function') {
                          skipBtn.click();
                        }

                        const adShowing = document.querySelector('.ad-showing, .ad-interrupting');
                        const video = document.querySelector('video');
                        if (adShowing && video) {
                          video.muted = true;
                          if (isFinite(video.duration) && video.duration > 0) {
                            video.currentTime = video.duration;
                          }
                        }
                      }, 250);

                      try {
                        Object.defineProperty(document, 'hidden', { get: () => false });
                        Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
                      } catch (_) {}

                      document.addEventListener(
                        'visibilitychange',
                        (e) => e.stopImmediatePropagation(),
                        true
                      );
                    })();
                """.trimIndent()

                view?.evaluateJavascript(js, null)
            }
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !isInPictureInPictureMode) {
            try {
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(16, 9))
                    .build()
                enterPictureInPictureMode(params)
            } catch (_: IllegalStateException) {
                // ডিভাইস বা বর্তমান স্ক্রিনে PiP অনুমোদিত না থাকলে নিরাপদে এড়িয়ে যাবে
            }
        }
    }
}
