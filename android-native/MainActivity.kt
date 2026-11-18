package com.tricka4if.venomyt

import android.app.PictureInPictureParams
import android.os.Build
import android.os.Bundle
import android.util.Rational
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import com.getcapacitor.BridgeActivity
import java.io.ByteArrayInputStream

class MainActivity : BridgeActivity() {

    private val blockList = listOf(
        "doubleclick.net", "googleadservices.com", "googlesyndication.com",
        "ads.youtube.com", "pagead2.googlesyndication.com"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val webView: WebView = this.bridge.webView
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
        }

        webView.loadUrl("https://m.youtube.com")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                val url = request?.url?.toString() ?: ""
                val host = request?.url?.host ?: ""
                if (blockList.any { host.contains(it) } || url.contains("/api/stats/ads") || url.contains("ptracking")) {
                    return WebResourceResponse("text/plain", "UTF-8", ByteArrayInputStream("".toByteArray()))
                }
                return super.shouldInterceptRequest(view, request)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                view?.evaluateJavascript("""
                    setInterval(() => {
                      const b = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
                      if (b) b.click();
                      const ad = document.querySelector('.ad-showing');
                      const v = document.querySelector('video');
                      if (ad && v && isFinite(v.duration)) v.currentTime = v.duration;
                    }, 250);
                    Object.defineProperty(document, 'hidden', { get: () => false });
                    Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
                """.trimIndent(), null)
            }
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            enterPictureInPictureMode(
                PictureInPictureParams.Builder().setAspectRatio(Rational(16, 9)).build()
            )
        }
    }
}
