package com.zakmolanitech.zakichat;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.webkit.WebViewAssetLoader;

public class BubblePanelActivity extends Activity {
    private WebView webView;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.setBackgroundDrawableResource(android.R.color.transparent);
        window.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
        WindowManager.LayoutParams lp = window.getAttributes();
        lp.dimAmount = 0.32f;
        lp.gravity = Gravity.CENTER_VERTICAL | Gravity.RIGHT;
        lp.width = (int)(getResources().getDisplayMetrics().widthPixels * 0.92f);
        lp.height = (int)(getResources().getDisplayMetrics().heightPixels * 0.64f);
        lp.x = dp(8);
        window.setAttributes(lp);

        FrameLayout root = new FrameLayout(this);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.rgb(7,17,31));
        bg.setCornerRadius(dp(24));
        bg.setStroke(dp(1), Color.rgb(25,216,242));
        root.setBackground(bg);
        root.setClipToOutline(true);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(7,17,31));
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .setDomain("zakichat.local")
            .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse response = loader.shouldInterceptRequest(request.getUrl());
                return response != null ? response : super.shouldInterceptRequest(view, request);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !"zakichat.local".equals(request.getUrl().getHost());
            }
        });
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        webView.loadUrl("https://zakichat.local/pages/chats.html?floatingBubble=1");
    }

    private int dp(int value) { return (int)(value * getResources().getDisplayMetrics().density + 0.5f); }

    @Override public void onBackPressed() { finish(); }
}
