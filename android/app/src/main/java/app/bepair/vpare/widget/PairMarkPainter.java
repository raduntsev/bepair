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
 * Draws the product's mark for today, the same device as in the app:
 * a ring is your day, a filled disc is your partner's.
 *   - not marked yet       → dotted outline
 *   - marked, colour known → filled/stroked with the actual colour of the day
 *   - partner marked, still sealed for you → amber disc with a small lock
 * Indigo and amber are the only UI colours; mood colours appear only as a day's colour.
 */
public final class PairMarkPainter {
    private static final float VIEW_W = 96f;
    private static final float VIEW_H = 56f;

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
        int height = Math.round(42 * density);
        float scale = width / VIEW_W;

        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.scale(scale, scale);

        boolean night = isNight(context);
        int accent = night ? 0xFF8B85FF : 0xFF5B54E8;
        int partner = night ? 0xFFE8A552 : 0xFFD98324;
        int surface = night ? 0xFF1A1A25 : 0xFFFFFFFF;

        boolean meMarked = s != null && s.meMarked;
        boolean hasPartner = s != null && s.hasPartner;
        boolean partnerMarked = hasPartner && s.partnerMarked;
        boolean together = meMarked && partnerMarked;

        float ringX = together ? 40f : 30f;
        float discX = together ? 56f : 66f;
        float cy = VIEW_H / 2f;

        Paint dotted = new Paint(Paint.ANTI_ALIAS_FLAG);
        dotted.setStyle(Paint.Style.STROKE);
        dotted.setStrokeWidth(2.5f);
        dotted.setStrokeCap(Paint.Cap.ROUND);
        dotted.setPathEffect(new DashPathEffect(new float[] {4f, 5f}, 0f));

        /* Partner's disc first, so your ring sits on top where they overlap. */
        if (!partnerMarked) {
            dotted.setColor(partner);
            canvas.drawCircle(discX, cy, 17f, dotted);
        } else {
            Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
            boolean showColour = s.partnerUnlocked && s.partnerColor != null;
            fill.setColor(showColour ? parse(s.partnerColor, partner) : partner);
            canvas.drawCircle(discX, cy, 18f, fill);
            if (!s.partnerUnlocked) drawLock(canvas, discX + (together ? 4f : 0f), cy, surface);
        }

        if (meMarked) {
            Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
            ring.setStyle(Paint.Style.STROKE);
            ring.setStrokeWidth(5f);
            ring.setColor(parse(s.meColor, accent));
            canvas.drawCircle(ringX, cy, 16.5f, ring);
        } else {
            dotted.setColor(accent);
            dotted.setStrokeWidth(3f);
            canvas.drawCircle(ringX, cy, 16.5f, dotted);
        }
        return bitmap;
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
