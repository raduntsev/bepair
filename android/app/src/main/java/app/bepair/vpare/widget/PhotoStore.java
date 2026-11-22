package app.bepair.vpare.widget;

import android.content.Context;
import android.content.SharedPreferences;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * The photo the «Фото» widget shows: one JPEG in app-private storage plus the
 * server's ETag (the photo's id), so an unchanged album downloads nothing.
 * «empty» means the couple has no photos yet — a different message from
 * «not loaded yet».
 */
public final class PhotoStore {
    private static final String PREFS = "vpare_widget_photo";
    private static final String KEY_ETAG = "etag";
    private static final String KEY_EMPTY = "empty";
    private static final String FILE = "widget_photo.jpg";

    private PhotoStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static File file(Context context) {
        return new File(context.getApplicationContext().getFilesDir(), FILE);
    }

    public static String etag(Context context) {
        return prefs(context).getString(KEY_ETAG, null);
    }

    public static boolean isEmpty(Context context) {
        return prefs(context).getBoolean(KEY_EMPTY, false);
    }

    public static boolean hasPhoto(Context context) {
        return file(context).isFile();
    }

    public static void save(Context context, byte[] bytes, String etag) throws IOException {
        File target = file(context);
        File temp = new File(target.getParentFile(), FILE + ".tmp");
        try (FileOutputStream out = new FileOutputStream(temp)) {
            out.write(bytes);
        }
        if (!temp.renameTo(target)) throw new IOException("rename failed");
        prefs(context).edit().putString(KEY_ETAG, etag).putBoolean(KEY_EMPTY, false).apply();
    }

    public static void markEmpty(Context context) {
        //noinspection ResultOfMethodCallIgnored
        file(context).delete();
        prefs(context).edit().remove(KEY_ETAG).putBoolean(KEY_EMPTY, true).apply();
    }

    /* Signed out or the widget removed: nothing private stays on the device. */
    public static void clear(Context context) {
        //noinspection ResultOfMethodCallIgnored
        file(context).delete();
        prefs(context).edit().clear().apply();
    }
}
