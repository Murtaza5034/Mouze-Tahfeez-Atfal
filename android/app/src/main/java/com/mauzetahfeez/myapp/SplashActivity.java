package com.mauzetahfeez.myapp;

import android.animation.Animator;
import android.animation.ObjectAnimator;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.widget.ImageView;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONException;
import org.json.JSONObject;

public class SplashActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        saveNotificationTap(getIntent());

        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );

        ImageView logo = findViewById(R.id.splashLogo);
        logo.setScaleX(0.05f);
        logo.setScaleY(0.05f);
        logo.setAlpha(0f);

        ObjectAnimator scaleX = ObjectAnimator.ofFloat(logo, "scaleX", 0.05f, 1f);
        ObjectAnimator scaleY = ObjectAnimator.ofFloat(logo, "scaleY", 0.05f, 1f);
        ObjectAnimator alpha = ObjectAnimator.ofFloat(logo, "alpha", 0f, 1f);

        scaleX.setDuration(1200);
        scaleY.setDuration(1200);
        alpha.setDuration(800);

        scaleX.setInterpolator(new AccelerateDecelerateInterpolator());
        scaleY.setInterpolator(new AccelerateDecelerateInterpolator());
        alpha.setInterpolator(new AccelerateDecelerateInterpolator());

        scaleX.addListener(new Animator.AnimatorListener() {
            @Override
            public void onAnimationStart(Animator animation) {}

            @Override
            public void onAnimationEnd(Animator animation) {
                logo.postDelayed(() -> {
                    Intent intent = new Intent(SplashActivity.this, MainActivity.class);
                    // Forward the original notification extras so MainActivity's
                    // plugin + bridge can also see the tapped notification data.
                    Bundle incoming = getIntent().getExtras();
                    if (incoming != null) intent.putExtras(incoming);
                    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                    overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
                    finish();
                }, 400);
            }

            @Override
            public void onAnimationCancel(Animator animation) {}

            @Override
            public void onAnimationRepeat(Animator animation) {}
        });

        scaleX.start();
        scaleY.start();
        alpha.start();
    }

    /**
     * Preserve the tapped FCM notification's data into SharedPreferences so the
     * web app (via MainActivity's MauzeNotifBridge) can open the EXACT page the
     * notification belongs to. Previously the extras were dropped when the
     * launch intent was forwarded, so taps always landed on the default page.
     */
    private void saveNotificationTap(Intent intent) {
        if (intent == null) return;
        Bundle extras = intent.getExtras();
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
