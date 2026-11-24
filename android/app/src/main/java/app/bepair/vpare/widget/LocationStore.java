package app.bepair.vpare.widget;

import android.content.Context;
import android.content.SharedPreferences;

import java.io.File;

/**
 * «Где мы» on this phone: whether the location service should run, the last
 * answer from /api/widget/location and the map the «Карта» widget shows.
 * App-private, and cleared on sign-out.
 */
public final class LocationStore {
    private static final String PREFS = "vpare_location";
    private static final String KEY_SHARING = "sharing";
    private static final String KEY_PAYLOAD = "payload";
    private static final String KEY_MAP_KEY = "map_key";
    private static final String KEY_SENT_AT = "sent_at";
    private static final String KEY_SENT_LAT = "sent_lat";
    private static final String KEY_SENT_LNG = "sent_lng";
    private static final String MAP_FILE = "widget_map.png";

    private LocationStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /* The person switched sharing on here, and has not switched it off anywhere since. */
    public static boolean sharing(Context context) {
        return prefs(context).getBoolean(KEY_SHARING, false);
    }

    public static void setSharing(Context context, boolean sharing) {
        prefs(context).edit().putBoolean(KEY_SHARING, sharing).apply();
    }

    public static String payload(Context context) {
        return prefs(context).getString(KEY_PAYLOAD, null);
    }

    public static void savePayload(Context context, String json) {
        prefs(context).edit().putString(KEY_PAYLOAD, json).apply();
    }

    public static File mapFile(Context context) {
        return new File(context.getApplicationContext().getFilesDir(), MAP_FILE);
    }

    /* What the stored map shows (points, zoom, theme): an unchanged map is not drawn again. */
    public static String mapKey(Context context) {
        return prefs(context).getString(KEY_MAP_KEY, null);
    }

    public static void setMapKey(Context context, String key) {
        prefs(context).edit().putString(KEY_MAP_KEY, key).apply();
    }

    public static long sentAt(Context context) {
        return prefs(context).getLong(KEY_SENT_AT, 0);
    }

    public static double[] sentPoint(Context context) {
        SharedPreferences p = prefs(context);
        if (!p.contains(KEY_SENT_LAT)) return null;
        return new double[] { Double.longBitsToDouble(p.getLong(KEY_SENT_LAT, 0)), Double.longBitsToDouble(p.getLong(KEY_SENT_LNG, 0)) };
    }

    public static void markSent(Context context, double lat, double lng) {
        prefs(context).edit()
            .putLong(KEY_SENT_AT, System.currentTimeMillis())
            .putLong(KEY_SENT_LAT, Double.doubleToRawLongBits(lat))
            .putLong(KEY_SENT_LNG, Double.doubleToRawLongBits(lng))
            .apply();
    }

    /* Signed out or the key revoked: nothing about where anyone was stays on the phone. */
    public static void clear(Context context) {
        //noinspection ResultOfMethodCallIgnored
        mapFile(context).delete();
        prefs(context).edit().clear().apply();
    }

    /* The widget's picture and the last answer go, the choice to share stays. */
    public static void clearMap(Context context) {
        //noinspection ResultOfMethodCallIgnored
        mapFile(context).delete();
        prefs(context).edit().remove(KEY_PAYLOAD).remove(KEY_MAP_KEY).apply();
    }
}
