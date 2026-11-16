package app.bepair.vpare.widget;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Private storage for the widget: its read-only key, the server address and the
 * last snapshot. Lives in app-private preferences — no other app can read it.
 */
public final class WidgetStore {
    private static final String PREFS = "vpare_widget";
    private static final String KEY_TOKEN = "token";
    private static final String KEY_API = "api";
    private static final String KEY_SNAPSHOT = "snapshot";
    private static final String KEY_LOCK = "lock_status";

    private WidgetStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void configure(Context context, String token, String api) {
        prefs(context).edit().putString(KEY_TOKEN, token).putString(KEY_API, api).remove(KEY_SNAPSHOT).apply();
    }

    /* Forgets the key and the snapshot; the lock-screen choice is the person's and survives sign-out. */
    public static void clear(Context context) {
        prefs(context).edit().remove(KEY_TOKEN).remove(KEY_API).remove(KEY_SNAPSHOT).apply();
    }

    public static boolean lockStatus(Context context) {
        return prefs(context).getBoolean(KEY_LOCK, false);
    }

    public static void setLockStatus(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_LOCK, enabled).apply();
    }

    public static String token(Context context) {
        return prefs(context).getString(KEY_TOKEN, null);
    }

    public static String api(Context context) {
        return prefs(context).getString(KEY_API, null);
    }

    public static boolean isConfigured(Context context) {
        return token(context) != null && api(context) != null;
    }

    public static void saveSnapshot(Context context, String json) {
        prefs(context).edit().putString(KEY_SNAPSHOT, json).apply();
    }

    public static String snapshot(Context context) {
        return prefs(context).getString(KEY_SNAPSHOT, null);
    }
}
