package com.zakmolanitech.zakichat;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

import androidx.core.app.NotificationCompat;

public class FloatingBubbleService extends Service {
    private static final String CHANNEL = "zakichat_floating_bubble";
    public static final String ACTION_SHOW_BUBBLE = "com.zakmolanitech.zakichat.SHOW_BUBBLE";
    public static final String ACTION_HIDE_BUBBLE = "com.zakmolanitech.zakichat.HIDE_BUBBLE";
    private WindowManager windowManager;
    private TextView bubble;
    private WindowManager.LayoutParams params;
    private float downX, downY, startX, startY;
    private boolean moved;

    @Override public void onCreate() {
        super.onCreate();
        createChannel();
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 1, open,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        Notification notification = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setContentTitle("ZakiChat bubble is active")
            .setContentText("Tap the floating ZAK bubble to open recent chats.")
            .setContentIntent(pi).setOngoing(true).build();
        startForeground(1501, notification);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Floating chat bubble", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Keeps the ZakiChat floating bubble available while the app is in the background.");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private void showBubble() {
        if (!Settings.canDrawOverlays(this) || bubble != null) return;
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        bubble = new TextView(this);
        bubble.setText("ZAK");
        bubble.setTextColor(Color.WHITE);
        bubble.setTextSize(15);
        bubble.setTypeface(Typeface.DEFAULT_BOLD);
        bubble.setGravity(Gravity.CENTER);
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
            new int[]{Color.rgb(25,216,242), Color.rgb(10,89,147), Color.rgb(7,17,31)});
        bg.setShape(GradientDrawable.OVAL);
        bg.setStroke(dp(2), Color.WHITE);
        bubble.setBackground(bg);
        bubble.setElevation(dp(10));
        bubble.setContentDescription("Open ZakiChat recent conversations");
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        params = new WindowManager.LayoutParams(dp(60), dp(60), type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            android.graphics.PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.RIGHT | Gravity.CENTER_VERTICAL;
        params.x = dp(8);
        params.y = 0;
        bubble.setOnTouchListener((v, event) -> {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    downX = event.getRawX(); downY = event.getRawY();
                    startX = params.x; startY = params.y; moved = false; return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = event.getRawX() - downX, dy = event.getRawY() - downY;
                    if (Math.abs(dx) > dp(5) || Math.abs(dy) > dp(5)) moved = true;
                    if (moved) {
                        params.x = Math.max(0, (int)(startX - dx));
                        params.y = (int)(startY + dy);
                        try { windowManager.updateViewLayout(bubble, params); } catch (Exception ignored) {}
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                    if (!moved) {
                        Intent panel = new Intent(this, BubblePanelActivity.class);
                        panel.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
                        startActivity(panel);
                    }
                    return true;
            }
            return false;
        });
        try { windowManager.addView(bubble, params); } catch (Exception e) { bubble = null; }
    }

    private int dp(int value) { return (int)(value * getResources().getDisplayMetrics().density + 0.5f); }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_SHOW_BUBBLE : intent.getAction();
        if (ACTION_HIDE_BUBBLE.equals(action)) removeBubble();
        else showBubble();
        return START_NOT_STICKY;
    }

    @Override public void onTaskRemoved(Intent rootIntent) {
        removeBubble();
        stopForeground(true);
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    private void removeBubble() {
        if (windowManager != null && bubble != null) {
            try { windowManager.removeView(bubble); } catch (Exception ignored) {}
        }
        bubble = null;
    }

    @Override public void onDestroy() { removeBubble(); super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
