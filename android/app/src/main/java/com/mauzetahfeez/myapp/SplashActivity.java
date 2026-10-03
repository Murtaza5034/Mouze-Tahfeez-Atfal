package com.mauzetahfeez.myapp;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONException;
import org.json.JSONObject;

public class SplashActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        // Save notification tap data for deep-linking
        saveNotificationTap(getIntent());

        // True fullscreen immersive
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );

        SplashTextView splashText = findViewById(R.id.splashTextView);

        // Wait for layout pass so the view has measured dimensions
        splashText.post(() -> {
            splashText.setOnAnimationComplete(() -> {
                // Animation is fully done — launch MainActivity
                Intent intent = new Intent(SplashActivity.this, MainActivity.class);
                // Forward notification extras so deep-link works
                android.os.Bundle incoming = getIntent().getExtras();
                if (incoming != null) intent.putExtras(incoming);
                intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
                finish();
            });
            splashText.startAnimation();
        });
    }

    /**
     * Preserve tapped FCM notification data into SharedPreferences so the
     * web app (via MainActivity's MauzeNotifBridge) can open the correct page.
     */
    private void saveNotificationTap(Intent intent) {
        if (intent == null) return;
        android.os.Bundle extras = intent.getExtras();
        if (extras == null || extras.isEmpty()) return;
        boolean isNotifTap = extras.containsKey("google.message_id")
                || extras.containsKey("redirectPage")
                || extras.containsKey("google.c.a.e");
        if (!isNotifTap) return;
        JSONObject obj = new JSONObject();
        for (String key : extras.keySet()) {
            Object value = extras.get(key);
            if (value instanceof String) {
                try { obj.put(key, (String) value); } catch (JSONException ignored) {}
            } else if (value instanceof Number || value instanceof Boolean) {
                try { obj.put(key, value); } catch (JSONException ignored) {}
            }
        }
        getSharedPreferences("mauze_prefs", MODE_PRIVATE)
                .edit()
                .putString("pending_notif_tap", obj.toString())
                .apply();
    }
}
