package com.zakmolanitech.zakichat;

import android.app.Activity;
import android.content.Intent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.IntentFilter;
import android.net.Uri;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.TrafficStats;
import org.json.JSONObject;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
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
    private BroadcastReceiver mediaControlReceiver;
    private boolean mediaReceiverRegistered = false;
    private WebViewAssetLoader assetLoader;
    private boolean askedForOverlay = false;
    private static final int FILE_CHOOSER_REQUEST_CODE = 9301;
    private ValueCallback<Uri[]> filePathCallback;
    private final Handler networkUsageHandler = new Handler(Looper.getMainLooper());
    private final Runnable networkUsageSampler = new Runnable() {
        @Override public void run() {
            new NativeBridge().getNetworkUsage();
            networkUsageHandler.postDelayed(this, 5000L);
        }
    };

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

        mediaControlReceiver = new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                if (webView == null || intent == null) return;
                String action = intent.getAction();
                String script = "";
                if (FloatingBubbleService.ACTION_MEDIA_TOGGLE.equals(action)) {
                    script = "(function(){var m=[].slice.call(document.querySelectorAll('audio,video'));if(!m.length)return;var playing=m.some(function(x){return !x.paused&&!x.ended});m.forEach(function(x){try{if(playing)x.pause();else x.play().catch(function(){});}catch(e){}});})();";
                } else if (FloatingBubbleService.ACTION_MEDIA_CLOSE.equals(action)) {
                    script = "(function(){document.querySelectorAll('audio,video').forEach(function(x){try{x.pause();x.currentTime=0;}catch(e){}});})();";
                }
                if (!script.isEmpty()) { final String mediaScript = script; webView.post(() -> webView.evaluateJavascript(mediaScript, null)); }
            }
        };
        IntentFilter mediaFilter = new IntentFilter();
        mediaFilter.addAction(FloatingBubbleService.ACTION_MEDIA_TOGGLE);
        mediaFilter.addAction(FloatingBubbleService.ACTION_MEDIA_CLOSE);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(mediaControlReceiver, mediaFilter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(mediaControlReceiver, mediaFilter);
        mediaReceiverRegistered = true;

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

    @Override protected void onDestroy() {
        if (mediaReceiverRegistered && mediaControlReceiver != null) {
            try { unregisterReceiver(mediaControlReceiver); } catch (Exception ignored) {}
            mediaReceiverRegistered = false;
        }
        super.onDestroy();
    }

    @Override protected void onResume() {
        super.onResume();
        networkUsageHandler.removeCallbacks(networkUsageSampler);
        networkUsageHandler.post(networkUsageSampler);
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
        networkUsageHandler.removeCallbacks(networkUsageSampler);
        super.onStop();
        if (isFinishing()) return;
        if (Settings.canDrawOverlays(this) && getPreferences(MODE_PRIVATE).getBoolean("floating_bubble_enabled", true)) {
            Intent service = new Intent(this, FloatingBubbleService.class);
            service.setAction(FloatingBubbleService.ACTION_SHOW_BUBBLE);
            startService(service);
        }
    }


    public class NativeBridge {
        @JavascriptInterface public String getNetworkUsage() {
            JSONObject result = new JSONObject();
            try {
                final int uid = getApplicationInfo().uid;
                long rx = TrafficStats.getUidRxBytes(uid);
                long tx = TrafficStats.getUidTxBytes(uid);
                if (rx < 0 || tx < 0) {
                    result.put("supported", false);
                    result.put("reason", "Android traffic counters are not available on this device.");
                    return result.toString();
                }
                ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
                String type = "unknown";
                if (cm != null) {
                    Network network = cm.getActiveNetwork();
                    NetworkCapabilities caps = network == null ? null : cm.getNetworkCapabilities(network);
                    if (caps != null) {
                        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) type = "wifi";
                        else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) type = "mobile";
                        else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) type = "other";
                    }
                }
                SharedPreferences prefs = getSharedPreferences("network_usage_stats", MODE_PRIVATE);
                long lastRx = prefs.getLong("last_rx", -1L);
                long lastTx = prefs.getLong("last_tx", -1L);
                long mobile = prefs.getLong("mobile_bytes", 0L);
                long wifi = prefs.getLong("wifi_bytes", 0L);
                long other = prefs.getLong("other_bytes", 0L);
                if (lastRx >= 0 && lastTx >= 0 && rx >= lastRx && tx >= lastTx) {
                    long delta = (rx - lastRx) + (tx - lastTx);
                    if ("mobile".equals(type)) mobile += delta;
                    else if ("wifi".equals(type)) wifi += delta;
                    else other += delta;
                }
                prefs.edit().putLong("last_rx", rx).putLong("last_tx", tx)
                    .putLong("mobile_bytes", mobile).putLong("wifi_bytes", wifi)
                    .putLong("other_bytes", other).apply();
                result.put("supported", true);
                result.put("connectionType", type);
                result.put("mobileBytes", mobile);
                result.put("wifiBytes", wifi);
                result.put("otherBytes", other);
                result.put("totalDeviceCounterBytes", rx + tx);
                result.put("sampledAt", System.currentTimeMillis());
                result.put("scope", "android_uid");
            } catch (Exception error) {
                try {
                    result.put("supported", false);
                    result.put("reason", "Network statistics could not be read.");
                } catch (Exception ignored) {}
            }
            return result.toString();
        }
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

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (filePathCallback == null) return;
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
