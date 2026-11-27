package app.bepair.vpare.widget;

import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.ColorMatrix;
import android.graphics.ColorMatrixColorFilter;
import android.graphics.BitmapShader;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.Shader;
import android.graphics.Typeface;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Locale;

/**
 * Draws the «Карта» widget's picture: OpenStreetMap tiles stitched around the
 * partner's point, quieted to grey (inverted in the dark theme, as in the app),
 * with their pin on top — their photo in a ring, or their initial when there is
 * no photo. The owner's own point is not drawn: the widget answers «where is
 * my partner», at street level.
 *
 * OSM tiles are 256 px; each is drawn at twice its size, so the map has the
 * same scale and legible labels as a 2× map on the phone's screen. One tile
 * cache serves both themes: the grey is applied while drawing.
 *
 * The launcher crops the picture to the widget's shape (centerCrop), so the
 * pins are fitted into the part every crop keeps: the middle 480×360 of a
 * 720×480 picture survives both a 2:1 and a 1:1 widget.
 */
public final class MapTiles {
    public static final int WIDTH = 720;
    public static final int HEIGHT = 480;
    /* Each 256-px OSM tile is drawn at 512 px: map math runs in these 2× pixels. */
    static final int TILE = 512;
    private static final int PIN_MARGIN = 56;
    static final int FIT_W = 480 - 2 * PIN_MARGIN;
    static final int FIT_H = 360 - 2 * PIN_MARGIN;
    static final int MAX_ZOOM = 16;
    static final int SINGLE_ZOOM = 15;
    static final int MIN_ZOOM = 2;
    private static final long TILE_MAX_AGE_MS = 30L * 24 * 3600 * 1000;
    private static final int TILE_CACHE_FILES = 240;

    private static final int PARTNER_LIGHT = 0xFFD98324;
    private static final int PARTNER_DARK = 0xFFE8A552;
    private static final int PARTNER_INK = 0xFF101018;
    private static final int SURFACE_LIGHT = 0xFFFFFFFF;
    private static final int SURFACE_DARK = 0xFF1C1C1E;
    private static final int LAND_LIGHT = 0xFFF2F2EF;
    private static final int LAND_DARK = 0xFF262626;

    private MapTiles() {}

    public static boolean dark(Context context) {
        int mode = context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES;
    }

    /* Web Mercator, in @2x pixels at zoom z. */
    static double worldX(double lng, int z) {
        return (lng + 180.0) / 360.0 * TILE * (double) (1L << z);
    }

    static double worldY(double lat, int z) {
        double clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
        double s = Math.sin(Math.toRadians(clamped));
        return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * (double) (1L << z);
    }

    /* The closest zoom at which both points sit inside the part every crop keeps. */
    static int zoomFor(MapPayload.Dot a, MapPayload.Dot b) {
        if (a == null || b == null) return SINGLE_ZOOM;
        for (int z = MAX_ZOOM; z > MIN_ZOOM; z--) {
            double world = TILE * (double) (1L << z);
            double dx = Math.abs(worldX(a.lng, z) - worldX(b.lng, z));
            dx = Math.min(dx, world - dx);
            double dy = Math.abs(worldY(a.lat, z) - worldY(b.lat, z));
            if (dx <= FIT_W && dy <= FIT_H) return z;
        }
        return MIN_ZOOM;
    }

    /* What a picture of this payload looks like; equal keys draw equal pictures. */
    public static String key(MapPayload p, boolean dark, boolean withPhoto) {
        String battery = p.partnerBattery == null ? "-" : p.partnerBattery.level + (p.partnerBattery.charging ? "+" : "");
        return String.format(Locale.ROOT, "%s|%s|%s|%s", dot(p.partner), withPhoto && p.partner != null ? p.partner.photoKey : "-", battery, dark ? "dark" : "light");
    }

    public static String key(MapPayload p, boolean dark) {
        return key(p, dark, false);
    }

    private static String dot(MapPayload.Dot d) {
        return d == null ? "-" : String.format(Locale.ROOT, "%.5f,%.5f,%s,%b", d.lat, d.lng, d.initial, d.stale);
    }

    /** The finished picture, and whether every tile arrived (a partial one is drawn again next time). */
    public static final class Result {
        public final Bitmap bitmap;
        public final boolean complete;

        Result(Bitmap bitmap, boolean complete) {
            this.bitmap = bitmap;
            this.complete = complete;
        }
    }

    public static Result compose(Context context, MapPayload p, boolean dark) {
        return compose(context, p, dark, null);
    }

    /** {@code photo}: the partner's photo for the pin, or null for their initial. */
    public static Result compose(Context context, MapPayload p, boolean dark, Bitmap photo) {
        if (p == null || p.partner == null) return null;
        int z = SINGLE_ZOOM;
        double[] partner = new double[] { worldX(p.partner.lng, z), worldY(p.partner.lat, z) };
        double left = partner[0] - WIDTH / 2.0;
        double top = partner[1] - HEIGHT / 2.0;

        Bitmap bitmap = Bitmap.createBitmap(WIDTH, HEIGHT, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(dark ? LAND_DARK : LAND_LIGHT);

        boolean complete = true;
        int tiles = 1 << z;
        int x0 = (int) Math.floor(left / TILE);
        int x1 = (int) Math.floor((left + WIDTH) / TILE);
        int y0 = (int) Math.floor(top / TILE);
        int y1 = (int) Math.floor((top + HEIGHT) / TILE);
        Paint tilePaint = new Paint(Paint.FILTER_BITMAP_FLAG);
        tilePaint.setColorFilter(quiet(dark));
        for (int tx = x0; tx <= x1; tx++) {
            for (int ty = y0; ty <= y1; ty++) {
                if (ty < 0 || ty >= tiles) continue;
                int wrapped = ((tx % tiles) + tiles) % tiles;
                Bitmap tile = tile(context, z, wrapped, ty);
                if (tile == null) {
                    complete = false;
                    continue;
                }
                float dx = (float) (tx * (double) TILE - left);
                float dy = (float) (ty * (double) TILE - top);
                canvas.drawBitmap(tile, null, new Rect(Math.round(dx), Math.round(dy), Math.round(dx) + TILE, Math.round(dy) + TILE), tilePaint);
                tile.recycle();
            }
        }

        int surface = dark ? SURFACE_DARK : SURFACE_LIGHT;
        pin(canvas, WIDTH / 2f, HEIGHT / 2f, dark ? PARTNER_DARK : PARTNER_LIGHT, PARTNER_INK, surface, p.partner.initial, p.partner.stale, photo);
        if (p.partnerBattery != null) batteryTag(canvas, WIDTH / 2f, HEIGHT / 2f + PIN_OUTER, p.partnerBattery, dark);

        return new Result(bitmap, complete);
    }

    /* The pin: a white (dark: graphite) disc, the partner's colour as a ring, the photo or initial inside. */
    static final float PIN_OUTER = 54f;
    static final float PIN_RING = 48f;
    static final float PIN_INNER = 42f;

    private static void pin(Canvas canvas, float x, float y, int fill, int ink, int ring, String initial, boolean stale, Bitmap photo) {
        int alpha = stale ? 140 : 255;
        Paint outer = new Paint(Paint.ANTI_ALIAS_FLAG);
        outer.setColor(ring);
        outer.setAlpha(alpha);
        outer.setShadowLayer(12f, 0f, 4f, stale ? 0x22000000 : 0x48000000);
        canvas.drawCircle(x, y, PIN_OUTER, outer);

        Paint inner = new Paint(Paint.ANTI_ALIAS_FLAG);
        inner.setColor(fill);
        inner.setAlpha(alpha);
        canvas.drawCircle(x, y, PIN_RING, inner);

        if (photo != null) {
            /* centerCrop the photo into the inner circle. */
            float size = PIN_INNER * 2f;
            float scale = size / Math.min(photo.getWidth(), photo.getHeight());
            Matrix matrix = new Matrix();
            matrix.setScale(scale, scale);
            matrix.postTranslate(x - photo.getWidth() * scale / 2f, y - photo.getHeight() * scale / 2f);
            BitmapShader shader = new BitmapShader(photo, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP);
            shader.setLocalMatrix(matrix);
            Paint picture = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
            picture.setShader(shader);
            picture.setAlpha(alpha);
            canvas.drawCircle(x, y, PIN_INNER, picture);
            return;
        }

        Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
        text.setColor(ink);
        text.setAlpha(alpha);
        text.setTextSize(44f);
        text.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        text.setTextAlign(Paint.Align.CENTER);
        String letter = initial == null || initial.isEmpty() ? "·" : initial.substring(0, Math.min(initial.length(), 2));
        Paint.FontMetrics m = text.getFontMetrics();
        canvas.drawText(letter, x, y - (m.ascent + m.descent) / 2f, text);
    }

    private static final int BATTERY_LOW = 0xFFE5484D;

    /* «84%» on a small chip right under the pin, as under the avatar in the app: red when low, a bolt while charging. */
    private static void batteryTag(Canvas canvas, float cx, float top, MapPayload.Battery battery, boolean dark) {
        String label = (battery.charging ? "\u26A1" : "") + battery.level + "%";
        Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
        text.setTextSize(30f);
        text.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        text.setTextAlign(Paint.Align.CENTER);
        boolean low = battery.level <= 15 && !battery.charging;
        text.setColor(low ? BATTERY_LOW : dark ? 0xFFF2F2F7 : PARTNER_INK);
        float w = text.measureText(label) + 28f;
        float h = 40f;
        float y = top - 10f;
        Paint chip = new Paint(Paint.ANTI_ALIAS_FLAG);
        chip.setColor(dark ? SURFACE_DARK : SURFACE_LIGHT);
        chip.setShadowLayer(8f, 0f, 2f, 0x40000000);
        canvas.drawRoundRect(cx - w / 2f, y, cx + w / 2f, y + h, h / 2f, h / 2f, chip);
        Paint.FontMetrics m = text.getFontMetrics();
        canvas.drawText(label, cx, y + h / 2f - (m.ascent + m.descent) / 2f, text);
    }

    /* The app's .pair-tiles filter: grey, a little softer; in the dark, inverted and dimmed. */
    static ColorMatrixColorFilter quiet(boolean dark) {
        ColorMatrix m = new ColorMatrix();
        m.setSaturation(0f);
        if (dark) {
            m.postConcat(new ColorMatrix(new float[] {
                -0.72f, 0, 0, 0, 205f,
                0, -0.72f, 0, 0, 205f,
                0, 0, -0.72f, 0, 205f,
                0, 0, 0, 1, 0,
            }));
        } else {
            m.postConcat(new ColorMatrix(new float[] {
                0.9f, 0, 0, 0, 30f,
                0, 0.9f, 0, 0, 30f,
                0, 0, 0.9f, 0, 30f,
                0, 0, 0, 1, 0,
            }));
        }
        return new ColorMatrixColorFilter(m);
    }

    /* One map tile, from the cache if it is fresh, else from OpenStreetMap. */
    private static Bitmap tile(Context context, int z, int x, int y) {
        File dir = new File(context.getCacheDir(), "map-tiles");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        File file = new File(dir, "osm-" + z + "-" + x + "-" + y + ".png");
        if (file.isFile() && System.currentTimeMillis() - file.lastModified() < TILE_MAX_AGE_MS) {
            Bitmap cached = BitmapFactory.decodeFile(file.getAbsolutePath());
            if (cached != null) return cached;
        }

        String url = "https://tile.openstreetmap.org/" + z + "/" + x + "/" + y + ".png";
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(15_000);
            /* OSM's tile policy: every client names itself and caches what it gets. */
            connection.setRequestProperty("User-Agent", "Vpare-Android-Widget/1.0 (+https://github.com/raduntsev/bepair)");
            if (connection.getResponseCode() != 200) return null;
            byte[] bytes;
            try (InputStream in = connection.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[16384];
                int n;
                while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
                bytes = out.toByteArray();
            }
            Bitmap decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (decoded == null) return null;
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(bytes);
            }
            prune(dir);
            return decoded;
        } catch (Exception e) {
            /* Offline: an old tile is better than none. */
            return file.isFile() ? BitmapFactory.decodeFile(file.getAbsolutePath()) : null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static void prune(File dir) {
        File[] files = dir.listFiles();
        if (files == null || files.length <= TILE_CACHE_FILES) return;
        Arrays.sort(files, Comparator.comparingLong(File::lastModified));
        for (int i = 0; i < files.length - TILE_CACHE_FILES; i++) {
            //noinspection ResultOfMethodCallIgnored
            files[i].delete();
        }
    }

    public static void save(Bitmap bitmap, File target) throws java.io.IOException {
        File temp = new File(target.getParentFile(), target.getName() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(temp)) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
        }
        if (!temp.renameTo(target)) throw new java.io.IOException("rename failed");
    }

    public static void clearCache(Context context) {
        File[] files = new File(context.getCacheDir(), "map-tiles").listFiles();
        if (files == null) return;
        for (File f : files) {
            //noinspection ResultOfMethodCallIgnored
            f.delete();
        }
    }
}
