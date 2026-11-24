package app.bepair.vpare.widget;

import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.provider.Settings;
import android.widget.RemoteViews;

import app.bepair.vpare.R;

/**
 * Today on the home screen as the two round characters from the app's loader
 * (src/components/PairLoader.tsx): indigo for you on the left, amber for your
 * partner on the right, glints for eyes. Each one acts out its own day:
 *
 *   asleep  — not marked yet: faded, eyes shut, breathing, a «z» drifts up
 *   light   — a light day: happy ^ ^ eyes, hopping
 *   normal  — an ordinary day: open eyes, a gentle sway, a blink
 *   heavy   — a heavy day: drooping eyes, sinking, slow sighs; the other one
 *             leans towards it
 *   sealed  — the partner marked a day you may not see yet: eyes shut, a
 *             small lock, now and then a peek
 *   hidden  — marked, but colours are hidden on this phone: open eyes, own colour
 *   absent  — no partner yet: a dashed outline
 *
 * A marked, visible day fills the body with that day's colour and keeps a ring
 * of the person's own colour, so who is who never depends on the mood.
 *
 * RemoteViews cannot animate a drawing, so the motion is a strip of FRAMES
 * bitmaps in a ViewFlipper (widget_mark_0 … widget_mark_7) that the launcher
 * flips by itself. With animations turned off on the phone every frame is the
 * first one, so the flipper shows a still picture.
 */
public final class PairCharacters {
    public static final int FRAMES = 8;
    private static final int[] FRAME_IDS = {
        R.id.widget_mark_0, R.id.widget_mark_1, R.id.widget_mark_2, R.id.widget_mark_3,
        R.id.widget_mark_4, R.id.widget_mark_5, R.id.widget_mark_6, R.id.widget_mark_7,
    };

    /* The loader's own coordinates: a 120×60 box, characters of r=17 at x=34 and x=86. */
    private static final float VIEW_W = 120f;
    private static final float VIEW_H = 60f;
    private static final float R_BODY = 17f;
    private static final float ME_X = 34f;
    private static final float PARTNER_X = 86f;
    private static final float CY = 33f;

    private static final int MOOD_INK = 0xFF101018;

    public enum Pose { ASLEEP, LIGHT, NORMAL, HEAVY, SEALED, HIDDEN, ABSENT }

    private PairCharacters() {}

    /** Puts every frame into the widget's flipper. */
    public static void apply(Context context, RemoteViews views, WidgetSnapshot s, int widthDp) {
        boolean still = !animationsOn(context);
        Bitmap first = null;
        for (int f = 0; f < FRAMES; f++) {
            Bitmap frame = still && first != null ? first : draw(context, s, still ? 0 : f, widthDp);
            if (first == null) first = frame;
            views.setImageViewBitmap(FRAME_IDS[f], frame);
        }
    }

    public static Pose mePose(WidgetSnapshot s) {
        if (s == null || !s.meMarked) return Pose.ASLEEP;
        return levelPose(s.meLevel, s.meColor);
    }

    public static Pose partnerPose(WidgetSnapshot s) {
        if (s == null || !s.hasPartner) return Pose.ABSENT;
        if (!s.partnerMarked) return Pose.ASLEEP;
        if (!s.partnerUnlocked) return Pose.SEALED;
        return levelPose(s.partnerLevel, s.partnerColor);
    }

    private static Pose levelPose(String level, String color) {
        if ("light".equals(level)) return Pose.LIGHT;
        if ("heavy".equals(level)) return Pose.HEAVY;
        if ("normal".equals(level)) return Pose.NORMAL;
        /* An older server without levels still sends a colour: treat it as an ordinary day. */
        return color != null ? Pose.NORMAL : Pose.HIDDEN;
    }

    private static boolean animationsOn(Context context) {
        try {
            return Settings.Global.getFloat(context.getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f;
        } catch (Exception e) {
            return true;
        }
    }

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

    static Bitmap draw(Context context, WidgetSnapshot s, int frame, int widthDp) {
        float density = context.getResources().getDisplayMetrics().density;
        int width = Math.round(widthDp * density);
        int height = Math.round(widthDp * density * VIEW_H / VIEW_W);
        float scale = width / VIEW_W;

        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.scale(scale, scale);

        boolean night = isNight(context);
        int accent = night ? 0xFF8B85FF : 0xFF5B54E8;
        int partner = night ? 0xFFE8A552 : 0xFFD98324;
        int outline = night ? 0xFF636366 : 0xFFC7C7CC;

        Pose me = mePose(s);
        Pose them = partnerPose(s);

        /* The one who is fine leans towards the one having a heavy day. */
        float meLean = them == Pose.HEAVY && me != Pose.HEAVY && me != Pose.ASLEEP ? 1f : 0f;
        float themLean = me == Pose.HEAVY && them != Pose.HEAVY && them != Pose.ASLEEP && them != Pose.ABSENT && them != Pose.SEALED ? -1f : 0f;

        character(canvas, me, ME_X, +1, accent, s != null ? s.meColor : null, frame, meLean, outline);
        character(canvas, them, PARTNER_X, -1, partner, s != null ? s.partnerColor : null, frame, themLean, outline);
        return bitmap;
    }

    /**
     * One character. {@code facing} is +1 for looking right (you), −1 for left
     * (the partner), so the two look at each other. {@code lean} tilts it
     * towards the other one (+1 right, −1 left).
     */
    private static void character(Canvas canvas, Pose pose, float cx, int facing, int own, String moodHex, int f, float lean, int outline) {
        double phase = 2 * Math.PI * f / FRAMES;

        if (pose == Pose.ABSENT) {
            Paint dash = new Paint(Paint.ANTI_ALIAS_FLAG);
            dash.setStyle(Paint.Style.STROKE);
            dash.setStrokeWidth(2f);
            dash.setStrokeCap(Paint.Cap.ROUND);
            dash.setPathEffect(new DashPathEffect(new float[] {3.5f, 4.5f}, 0f));
            dash.setColor(outline);
            canvas.drawCircle(cx, CY, R_BODY - 1f, dash);
            return;
        }

        float dx = 0f, dy = 0f, sx = 1f, sy = 1f, rotate = 0f;
        switch (pose) {
            case ASLEEP: {
                float b = (float) Math.sin(phase);
                sx = 1f + 0.03f * b;
                sy = 1f + 0.04f * b;
                break;
            }
            case LIGHT: {
                float[] hop = {0f, -3f, -6f, -7f, -6f, -3f, 0f, 0f};
                dy = hop[f];
                if (f == 7) { sx = 1.06f; sy = 0.92f; }
                break;
            }
            case NORMAL:
            case HIDDEN: {
                float[] sway = {0f, 0.8f, 1.5f, 0.8f, 0f, -0.8f, -1.5f, -0.8f};
                dx = sway[f];
                break;
            }
            case HEAVY: {
                float b = (float) Math.sin(phase);
                dy = 2.5f + 1f * b;
                sx = 1.03f - 0.015f * b;
                sy = 0.95f + 0.02f * b;
                break;
            }
            case SEALED: {
                float b = (float) Math.sin(phase);
                sy = 1f + 0.015f * b;
                break;
            }
            default:
                break;
        }
        if (lean != 0f) {
            dx += 2.5f * lean;
            rotate = 9f * lean;
        }

        canvas.save();
        canvas.translate(cx + dx, CY + dy);
        canvas.rotate(rotate);
        /* Squash and stretch from the ground, as the loader does. */
        canvas.translate(0, R_BODY);
        canvas.scale(sx, sy);
        canvas.translate(0, -R_BODY);

        boolean moodKnown = moodHex != null && (pose == Pose.LIGHT || pose == Pose.NORMAL || pose == Pose.HEAVY);
        int bodyColor = moodKnown ? parse(moodHex, own) : own;

        Paint body = new Paint(Paint.ANTI_ALIAS_FLAG);
        body.setColor(bodyColor);
        if (pose == Pose.ASLEEP) body.setAlpha(110);
        canvas.drawCircle(0, 0, R_BODY, body);

        if (moodKnown) {
            Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
            ring.setStyle(Paint.Style.STROKE);
            ring.setStrokeWidth(2.6f);
            ring.setColor(own);
            canvas.drawCircle(0, 0, R_BODY - 1.3f, ring);
        }

        int eyeInk = moodKnown ? MOOD_INK : Color.WHITE;
        eyes(canvas, pose, facing, f, eyeInk);

        if (pose == Pose.SEALED) lock(canvas, facing);
        canvas.restore();

        if (pose == Pose.ASLEEP) zeds(canvas, cx, facing, f, own);
    }

    private static void eyes(Canvas canvas, Pose pose, int facing, int f, int ink) {
        /* Eye centres, relative to the body centre, looking towards the other one. */
        float lx = 1.8f * facing - 4f;
        float rx = 1.8f * facing + 4.4f;
        float ey = -7.5f;

        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        fill.setColor(ink);
        Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
        line.setColor(ink);
        line.setStyle(Paint.Style.STROKE);
        line.setStrokeWidth(2.3f);
        line.setStrokeCap(Paint.Cap.ROUND);

        switch (pose) {
            case LIGHT:
                happy(canvas, lx, ey + 1.5f, line);
                happy(canvas, rx, ey + 1.5f, line);
                break;
            case NORMAL:
            case HIDDEN:
                if (f == 5) {
                    canvas.drawLine(lx - 1.8f, ey + 1f, lx + 1.8f, ey + 1f, line);
                    canvas.drawLine(rx - 1.8f, ey + 1f, rx + 1.8f, ey + 1f, line);
                } else {
                    glint(canvas, lx, ey, 18f * facing, 8.5f, fill);
                    glint(canvas, rx, ey + 1f, 18f * facing, 8.5f, fill);
                }
                break;
            case HEAVY:
                if (f == 6) {
                    canvas.drawLine(lx - 1.8f, ey + 4f, lx + 1.8f, ey + 4f, line);
                    canvas.drawLine(rx - 1.8f, ey + 4f, rx + 1.8f, ey + 4f, line);
                } else {
                    /* Shorter, lower, tilted outward: the eyes droop. */
                    glint(canvas, lx, ey + 3.5f, -24f, 5.5f, fill);
                    glint(canvas, rx, ey + 3.5f, 24f, 5.5f, fill);
                }
                break;
            case ASLEEP:
                closed(canvas, lx, ey + 2f, line);
                closed(canvas, rx, ey + 2f, line);
                break;
            case SEALED: {
                boolean peek = f == 3 || f == 4;
                canvas.drawLine(lx - 1.8f, ey + 1.5f, lx + 1.8f, ey + 1.5f, line);
                if (peek) glint(canvas, rx, ey + 1f, 18f * facing, 6.5f, fill);
                else canvas.drawLine(rx - 1.8f, ey + 1.5f, rx + 1.8f, ey + 1.5f, line);
                break;
            }
            default:
                break;
        }
    }

    /* The loader's eye: a capsule, tilted. */
    private static void glint(Canvas canvas, float x, float y, float degrees, float h, Paint paint) {
        canvas.save();
        canvas.rotate(degrees, x, y);
        canvas.drawRoundRect(new RectF(x - 1.8f, y - h / 2f, x + 1.8f, y + h / 2f), 1.8f, 1.8f, paint);
        canvas.restore();
    }

    /* ^ — a happy, squinting eye. */
    private static void happy(Canvas canvas, float x, float y, Paint paint) {
        Path p = new Path();
        p.moveTo(x - 2.4f, y + 1.5f);
        p.quadTo(x, y - 2.3f, x + 2.4f, y + 1.5f);
        canvas.drawPath(p, paint);
    }

    /* ‿ — shut, relaxed. */
    private static void closed(Canvas canvas, float x, float y, Paint paint) {
        Path p = new Path();
        p.moveTo(x - 2.4f, y - 0.8f);
        p.quadTo(x, y + 2.2f, x + 2.4f, y - 0.8f);
        canvas.drawPath(p, paint);
    }

    private static void lock(Canvas canvas, int facing) {
        float x = 0f;
        float y = 6f;
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(Color.WHITE);
        canvas.drawRoundRect(new RectF(x - 4.5f, y - 1f, x + 4.5f, y + 6f), 1.4f, 1.4f, paint);
        Paint shackle = new Paint(Paint.ANTI_ALIAS_FLAG);
        shackle.setColor(Color.WHITE);
        shackle.setStyle(Paint.Style.STROKE);
        shackle.setStrokeWidth(1.6f);
        canvas.drawArc(new RectF(x - 2.9f, y - 5.6f, x + 2.9f, y + 0.6f), 180f, 180f, false, shackle);
    }

    /* A small «z» rising from a sleeping head. */
    private static void zeds(Canvas canvas, float cx, int facing, int f, int color) {
        if (f < 1 || f > 6) return;
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(color);
        paint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        float t = (f - 1) / 5f;
        paint.setTextSize(6f + 2.5f * t);
        paint.setAlpha(Math.round(255 * (1f - Math.abs(t - 0.5f) * 1.2f)));
        float x = cx + facing * (12f + 3f * t);
        float y = CY - R_BODY - 1f - 7f * t;
        canvas.drawText("z", x, Math.max(y, 7f), paint);
    }
}
