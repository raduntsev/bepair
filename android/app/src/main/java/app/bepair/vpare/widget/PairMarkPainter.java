package app.bepair.vpare.widget;

import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.RectF;

/**
 * Today as two discs side by side, the way an iOS widget shows a pair of
 * values: yours on the left, your partner's on the right.
 *   - not marked yet                → a thin dashed outline in neutral ink
 *   - marked, colour known          → a solid disc in the actual colour of the day
 *   - partner marked, still sealed  → a neutral disc with a small lock
 * No UI colour competes with them: the mood spectrum appears only as a day's colour.
 */
public final class PairMarkPainter {
    private static final float VIEW_W = 96f;
    private static final float VIEW_H = 48f;
    private static final float R = 16f;

    private PairMarkPainter() {}

    private static boolean isNight(Context context) {
        int mode = context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES;
    }

    private static int parse(String hex, int fallback) {
        if (hex == null) return fallback;
        try {
            return Color.parseColor(hex);
        } catch (IllegalArgumentException e) {
            return fallback;
        }
    }

    public static Bitmap draw(Context context, WidgetSnapshot s) {
        float density = context.getResources().getDisplayMetrics().density;
        int width = Math.round(72 * density);
        int height = Math.round(36 * density);
        float scale = width / VIEW_W;

        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.scale(scale, scale);

        boolean night = isNight(context);
        int neutral = night ? 0xFF3A3A3C : 0xFFE5E5EA;
        int outline = night ? 0xFF636366 : 0xFFC7C7CC;
        int lockInk = night ? 0xFF98989F : 0xFF8E8E93;
        int accent = 0xFF5856D6;

        float cy = VIEW_H / 2f;
        float meX = R + 2f;
        float partnerX = meX + R * 2f + 6f;

        boolean meMarked = s != null && s.meMarked;
        if (meMarked) {
            disc(canvas, meX, cy, parse(s.meColor, accent));
        } else {
            dashed(canvas, meX, cy, outline);
        }

        boolean hasPartner = s != null && s.hasPartner;
        if (!hasPartner || !s.partnerMarked) {
            dashed(canvas, partnerX, cy, outline);
        } else if (s.partnerUnlocked && s.partnerColor != null) {
            disc(canvas, partnerX, cy, parse(s.partnerColor, neutral));
        } else {
            disc(canvas, partnerX, cy, neutral);
            drawLock(canvas, partnerX, cy, lockInk);
        }
        return bitmap;
    }

    private static void disc(Canvas canvas, float cx, float cy, int color) {
        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        fill.setColor(color);
        canvas.drawCircle(cx, cy, R, fill);
    }

    private static void dashed(Canvas canvas, float cx, float cy, int color) {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(2f);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setPathEffect(new DashPathEffect(new float[] {3.5f, 4.5f}, 0f));
        paint.setColor(color);
        canvas.drawCircle(cx, cy, R - 1f, paint);
    }

    private static void drawLock(Canvas canvas, float cx, float cy, int color) {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(color);
        canvas.drawRoundRect(new RectF(cx - 5f, cy - 1f, cx + 5f, cy + 7f), 1.5f, 1.5f, paint);
        Paint shackle = new Paint(Paint.ANTI_ALIAS_FLAG);
        shackle.setColor(color);
        shackle.setStyle(Paint.Style.STROKE);
        shackle.setStrokeWidth(1.8f);
        canvas.drawArc(new RectF(cx - 3.2f, cy - 6.5f, cx + 3.2f, cy + 0.5f), 180f, 180f, false, shackle);
    }
}
