package com.mauzetahfeez.myapp;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.util.AttributeSet;
import android.view.View;
import android.view.animation.DecelerateInterpolator;

/**
 * Custom View that animates "Mauze Tahfeez" text:
 *   Phase 1 (0-800ms)  : outline strokes draw in (stroke width animates from 0 to full, alpha 0→1)
 *   Phase 2 (800-1600ms): fill color sweeps in left-to-right (gradient reveal)
 *   Phase 3 (1600-2000ms): outline fades out, fill remains solid — polished final state
 *
 * Total animation: ~2200ms, then callback fires to launch MainActivity.
 */
public class SplashTextView extends View {

    // Gold palette
    private static final int COLOR_GOLD_DARK   = Color.parseColor("#7A5500");  // deep shadow
    private static final int COLOR_GOLD_MID    = Color.parseColor("#8B6914");  // main gold
    private static final int COLOR_GOLD_LIGHT  = Color.parseColor("#C9960A");  // highlight
    private static final int COLOR_BG          = Color.parseColor("#FFFDF8");  // cream bg
    private static final int COLOR_STROKE      = Color.parseColor("#8B6914");  // outline

    // Phase progress: 0.0 -> 1.0
    private float outlineProgress = 0f;  // Phase 1: stroke draws in
    private float fillProgress    = 0f;  // Phase 2: fill sweeps in
    private float outlineFade     = 1f;  // Phase 3: outline fades out

    private Paint strokePaint;
    private Paint fillPaint;
    private Paint shadowPaint;

    private String line1 = "Mauze";
    private String line2 = "Tahfeez";

    private Runnable onAnimationComplete;

    public SplashTextView(Context context) {
        super(context);
        init();
    }

    public SplashTextView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    public SplashTextView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        init();
    }

    private void init() {
        // Stroke paint: draws the outline of the text
        strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        strokePaint.setStyle(Paint.Style.STROKE);
        strokePaint.setColor(COLOR_STROKE);
        strokePaint.setStrokeJoin(Paint.Join.ROUND);
        strokePaint.setStrokeCap(Paint.Cap.ROUND);

        // Fill paint: fills the text with gold gradient
        fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        fillPaint.setStyle(Paint.Style.FILL);

        // Shadow paint: soft drop shadow for depth
        shadowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        shadowPaint.setStyle(Paint.Style.FILL);
        shadowPaint.setColor(Color.parseColor("#40000000"));

        // Use a serif bold typeface (closest available on Android to Cinzel/Trajan)
        Typeface tf = Typeface.create("serif", Typeface.BOLD);
        strokePaint.setTypeface(tf);
        fillPaint.setTypeface(tf);
        shadowPaint.setTypeface(tf);
    }

    public void setOnAnimationComplete(Runnable r) {
        this.onAnimationComplete = r;
    }

    public void startAnimation() {
        int w = getWidth();
        int h = getHeight();

        // ── PHASE 1: Outline draws in (0 → 800ms) ──────────────────────────
        ValueAnimator phase1 = ValueAnimator.ofFloat(0f, 1f);
        phase1.setDuration(800);
        phase1.setInterpolator(new DecelerateInterpolator(1.5f));
        phase1.addUpdateListener(anim -> {
            outlineProgress = (float) anim.getAnimatedValue();
            invalidate();
        });

        // ── PHASE 2: Fill sweeps left→right (800 → 1800ms) ─────────────────
        ValueAnimator phase2 = ValueAnimator.ofFloat(0f, 1f);
        phase2.setDuration(1000);
        phase2.setInterpolator(new DecelerateInterpolator(1.2f));
        phase2.addUpdateListener(anim -> {
            fillProgress = (float) anim.getAnimatedValue();
            invalidate();
        });

        // ── PHASE 3: Outline fade out (1800 → 2100ms) ──────────────────────
        ValueAnimator phase3 = ValueAnimator.ofFloat(1f, 0f);
        phase3.setDuration(300);
        phase3.addUpdateListener(anim -> {
            outlineFade = (float) anim.getAnimatedValue();
            invalidate();
        });
        phase3.addListener(new android.animation.AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(android.animation.Animator animation) {
                // Hold final state for a beat then call back
                postDelayed(() -> {
                    if (onAnimationComplete != null) onAnimationComplete.run();
                }, 350);
            }
        });

        // Chain animations
        phase1.addListener(new android.animation.AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(android.animation.Animator animation) {
                phase2.start();
            }
        });
        phase2.addListener(new android.animation.AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(android.animation.Animator animation) {
                phase3.start();
            }
        });

        phase1.start();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);

        int w = getWidth();
        int h = getHeight();
        if (w == 0 || h == 0) return;

        // Scale font to ~32% of screen width for each line
        float fontSize = w * 0.155f;
        strokePaint.setTextSize(fontSize);
        fillPaint.setTextSize(fontSize);
        shadowPaint.setTextSize(fontSize);
        strokePaint.setTextAlign(Paint.Align.CENTER);
        fillPaint.setTextAlign(Paint.Align.CENTER);
        shadowPaint.setTextAlign(Paint.Align.CENTER);

        float lineSpacing = fontSize * 1.25f;
        float totalHeight = lineSpacing * 2;
        float startY = h / 2f - totalHeight / 2f + fontSize * 0.85f;

        float cx = w / 2f;
        float y1 = startY;
        float y2 = startY + lineSpacing;

        // Stroke width animates with phase1 progress
        float maxStrokeWidth = fontSize * 0.04f;
        float currentStroke = maxStrokeWidth * outlineProgress;
        strokePaint.setStrokeWidth(currentStroke);
        strokePaint.setAlpha((int) (255 * outlineProgress * outlineFade));

        // ── FILL gradient: sweeps left to right ────────────────────────────
        if (fillProgress > 0f) {
            // The fill reveals via a left-to-right clip gradient
            // We use a wide gradient that starts transparent and becomes opaque
            // as fillProgress sweeps across
            float revealX = w * fillProgress;  // how far the fill has revealed

            // Gold gradient for fill (top-light, bottom-dark)
            LinearGradient fillGrad = new LinearGradient(
                cx, y1 - fontSize,
                cx, y2,
                new int[]{ COLOR_GOLD_LIGHT, COLOR_GOLD_MID, COLOR_GOLD_DARK },
                new float[]{ 0f, 0.5f, 1f },
                Shader.TileMode.CLAMP
            );
            fillPaint.setShader(fillGrad);
            fillPaint.setAlpha(255);

            // Clip canvas to revealed area
            canvas.save();
            canvas.clipRect(0, 0, revealX, h);

            // Soft shadow (offset by 3px)
            shadowPaint.setAlpha((int)(120 * fillProgress));
            canvas.drawText(line1, cx + 3, y1 + 3, shadowPaint);
            canvas.drawText(line2, cx + 3, y2 + 3, shadowPaint);

            // Fill text
            canvas.drawText(line1, cx, y1, fillPaint);
            canvas.drawText(line2, cx, y2, fillPaint);

            canvas.restore();
        }

        // ── OUTLINE stroke (drawn on top of fill edge for crisp reveal) ─────
        if (outlineProgress > 0f && currentStroke > 0.5f) {
            canvas.drawText(line1, cx, y1, strokePaint);
            canvas.drawText(line2, cx, y2, strokePaint);
        }
    }
}
