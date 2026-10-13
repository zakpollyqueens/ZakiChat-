package com.zakmolanitech.zakichat;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.app.NotificationCompat;

public class FloatingBubbleService extends Service {
    private static final String CHANNEL = "zakichat_floating_bubble";
    public static final String ACTION_SHOW_BUBBLE = "com.zakmolanitech.zakichat.SHOW_BUBBLE";
    public static final String ACTION_HIDE_BUBBLE = "com.zakmolanitech.zakichat.HIDE_BUBBLE";
    public static final String ACTION_MEDIA_TOGGLE = "com.zakmolanitech.zakichat.MEDIA_TOGGLE";
    public static final String ACTION_MEDIA_CLOSE = "com.zakmolanitech.zakichat.MEDIA_CLOSE";
    public static final String ACTION_MEDIA_STOPPED = "com.zakmolanitech.zakichat.MEDIA_STOPPED";
    private WindowManager windowManager;
    private LinearLayout bubble;
    private WindowManager.LayoutParams params;
    private TextView playButton;
    private float downX, downY, startX, startY;
    private boolean moved;
    private boolean paused = false;
    private boolean mediaMode = false;

    @Override public void onCreate() {
        super.onCreate();
        createChannel();
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 1, open,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        Notification notification = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setContentTitle("Zamivox is active")
            .setContentText("Floating chat and media controls are available.")
            .setContentIntent(pi).setOngoing(true).build();
        startForeground(1501, notification);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Zamivox floating controls", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Floating chat and media controls.");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private int dp(int v) { return (int)(v * getResources().getDisplayMetrics().density + .5f); }

    private TextView button(String label, String description) {
        TextView t = new TextView(this);
        t.setText(label); t.setTextColor(Color.WHITE); t.setTextSize(20);
        t.setGravity(Gravity.CENTER); t.setContentDescription(description);
        t.setBackground(round(Color.rgb(12, 32, 51), dp(24), Color.rgb(25,216,242)));
        t.setLayoutParams(new LinearLayout.LayoutParams(dp(48), dp(48)));
        return t;
    }

    private GradientDrawable round(int color, int radius, int stroke) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color); d.setCornerRadius(radius); d.setStroke(dp(1), stroke);
        return d;
    }

    private void showBubble() {
        if (!Settings.canDrawOverlays(this) || bubble != null) return;
        windowManager = (WindowManager)getSystemService(WINDOW_SERVICE);
        bubble = new LinearLayout(this);
        bubble.setOrientation(LinearLayout.HORIZONTAL);
        bubble.setGravity(Gravity.CENTER);
        bubble.setPadding(dp(4), dp(4), dp(4), dp(4));
        bubble.setBackground(round(Color.rgb(7,17,31), dp(30), Color.rgb(25,216,242)));
        bubble.setElevation(dp(12));

        playButton = button("▶", "Play or pause Zamivox media");
        playButton.setOnClickListener(v -> {
            paused = !paused;
            playButton.setText(paused ? "▶" : "Ⅱ");
            sendBroadcast(new Intent(ACTION_MEDIA_TOGGLE).setPackage(getPackageName()));
        });
        TextView close = button("×", "Stop media and close floating controls");
        LinearLayout.LayoutParams closeParams = new LinearLayout.LayoutParams(dp(42), dp(48));
        closeParams.leftMargin = dp(3);
        close.setLayoutParams(closeParams);
        close.setOnClickListener(v -> {
            sendBroadcast(new Intent(ACTION_MEDIA_CLOSE).setPackage(getPackageName()));
            mediaMode = false;
            paused = false;
            removeBubble();
            Intent hide = new Intent(this, FloatingBubbleService.class);
            hide.setAction(ACTION_HIDE_BUBBLE);
            startService(hide);
        });
        bubble.addView(playButton);
        bubble.addView(close);

        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        params = new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, dp(58), type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            android.graphics.PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.RIGHT | Gravity.CENTER_VERTICAL;
        params.x = dp(8); params.y = 0;
        bubble.setOnTouchListener((v, e) -> {
            switch (e.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    downX=e.getRawX(); downY=e.getRawY(); startX=params.x; startY=params.y; moved=false; return true;
                case MotionEvent.ACTION_MOVE:
                    float dx=e.getRawX()-downX, dy=e.getRawY()-downY;
                    if (Math.abs(dx)>dp(7)||Math.abs(dy)>dp(7)) moved=true;
                    if (moved) {
                        params.x=Math.max(0,(int)(startX-dx)); params.y=(int)(startY+dy);
                        try { windowManager.updateViewLayout(bubble,params); } catch(Exception ignored) {}
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                    if (!moved) {
                        // The controls themselves receive clicks; a tap on the empty bubble area opens the app.
                    }
                    return true;
            }
            return false;
        });
        try { windowManager.addView(bubble, params); } catch(Exception e) { bubble=null; }
    }

    private void removeBubble() {
        if (windowManager != null && bubble != null) {
            try { windowManager.removeView(bubble); } catch(Exception ignored) {}
        }
        bubble=null; playButton=null;
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action=intent==null ? ACTION_SHOW_BUBBLE : intent.getAction();
        if (ACTION_HIDE_BUBBLE.equals(action)) removeBubble();
        else if (ACTION_SHOW_BUBBLE.equals(action)) showBubble();
        else if (ACTION_MEDIA_STOPPED.equals(action)) { mediaMode=false; paused=false; removeBubble(); }
        else if (ACTION_MEDIA_TOGGLE.equals(action)) {
            paused=!paused;
            if(playButton!=null) playButton.setText(paused ? "▶" : "Ⅱ");
        }
        return START_NOT_STICKY;
    }

    @Override public void onTaskRemoved(Intent rootIntent) {
        sendBroadcast(new Intent(ACTION_MEDIA_CLOSE).setPackage(getPackageName()));
        removeBubble(); stopForeground(true); stopSelf(); super.onTaskRemoved(rootIntent);
    }
    @Override public void onDestroy() { removeBubble(); super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}