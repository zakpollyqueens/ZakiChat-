package com.zakmolanitech.zakichat;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.content.SharedPreferences;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;

import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends Activity {
    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private boolean askedForOverlay = false;
    private static final int FILE_CHOOSER_REQUEST_CODE = 9301;
    private ValueCallback<Uri[]> filePathCallback;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(7,17,31));
        getWindow().setNavigationBarColor(Color.rgb(7,17,31));
        assetLoader = new WebViewAssetLoader.Builder()
            .setDomain("zakichat.local")
            .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(7,17,31));
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(true);
        webView.addJavascriptInterface(new NativeBridge(), "ZakiChatNative");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try {
                    Intent chooser = params.createIntent();
                    startActivityForResult(chooser, FILE_CHOOSER_REQUEST_CODE);
                    return true;
                } catch (Exception error) {
                    filePathCallback = null;
                    return false;
                }
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse response = assetLoader.shouldInterceptRequest(request.getUrl());
                return response != null ? response : super.shouldInterceptRequest(view, request);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("zakichat.local".equals(uri.getHost())) return false;
                if ("https".equals(uri.getScheme()) || "mailto".equals(uri.getScheme()) || "tel".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                    return true;
                }
                return true;
            }
        });
        setContentView(webView);
        webView.loadUrl("https://zakichat.local/index.html");
    }

    @Override protected void onResume() {
        super.onResume();
        if (!askedForOverlay) {
            askedForOverlay = true;
            if (!Settings.canDrawOverlays(this)) {
                new android.app.AlertDialog.Builder(this)
                    .setTitle("Enable ZakiChat floating bubble?")
                    .setMessage("Allow ZakiChat to display its chat bubble over other apps. You can change this permission any time in Android Settings.")
                    .setNegativeButton("Not now", (d,w) -> {})
                    .setPositiveButton("Allow", (d,w) -> {
                        Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:" + getPackageName()));
                        startActivity(i);
                    }).show();
            }
        }

        if (Settings.canDrawOverlays(this) && getPreferences(MODE_PRIVATE).getBoolean("floating_bubble_enabled", true)) {
            Intent service = new Intent(this, FloatingBubbleService.class);
            service.setAction(FloatingBubbleService.ACTION_HIDE_BUBBLE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(service);
            else startService(service);
        }
    }

    @Override protected void onStop() {
        super.onStop();
        if (isFinishing()) return;
        if (Settings.canDrawOverlays(this) && getPreferences(MODE_PRIVATE).getBoolean("floating_bubble_enabled", true)) {
            Intent service = new Intent(this, FloatingBubbleService.class);
            service.setAction(FloatingBubbleService.ACTION_SHOW_BUBBLE);
            startService(service);
        }
    }


    public class NativeBridge {
        @JavascriptInterface public boolean isFloatingBubbleEnabled() {
            return getPreferences(MODE_PRIVATE).getBoolean("floating_bubble_enabled", true);
        }
        @JavascriptInterface public boolean canDrawFloatingBubble() {
            return Settings.canDrawOverlays(MainActivity.this);
        }
        @JavascriptInterface public void setFloatingBubbleEnabled(boolean enabled) {
            runOnUiThread(() -> {
                getPreferences(MODE_PRIVATE).edit().putBoolean("floating_bubble_enabled", enabled).apply();
                if (!enabled) {
                    stopService(new Intent(MainActivity.this, FloatingBubbleService.class));
                } else if (!Settings.canDrawOverlays(MainActivity.this)) {
                    requestFloatingBubblePermission();
                } else {
                    Intent service = new Intent(MainActivity.this, FloatingBubbleService.class);
                    service.setAction(FloatingBubbleService.ACTION_HIDE_BUBBLE);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(service);
                    else startService(service);
                }
            });
        }
        @JavascriptInterface public void requestFloatingBubblePermission() {
            runOnUiThread(() -> {
                if (!Settings.canDrawOverlays(MainActivity.this)) {
                    Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getPackageName()));
                    startActivity(i);
                }
            });
        }
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
