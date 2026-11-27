package app.bepair.vpare.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

import app.bepair.vpare.MainActivity;
import app.bepair.vpare.R;

/**
 * The «Карта» widget: the partner on the stored map, with their name and how
 * long ago their point was updated; or — when there is nothing to show yet —
 * the pair characters and what to do.
 */
public final class MapRenderer {
    private MapRenderer() {}

    public static int[] ids(Context context) {
        return AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context, MapWidgetProvider.class));
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : ids(context)) manager.updateAppWidget(id, render(context));
    }

    /**
     * Turns the stored answer into the picture, fetching tiles as needed.
     * Network: call off the main thread (the service and the refresh worker do).
     */
    public static void compose(Context context) {
        MapPayload p = MapPayload.parse(LocationStore.payload(context));
        if (p == null || !p.hasMap()) {
            //noinspection ResultOfMethodCallIgnored
            LocationStore.mapFile(context).delete();
            LocationStore.setMapKey(context, null);
            return;
        }
        boolean dark = MapTiles.dark(context);
        Bitmap photo = partnerPhoto(context, p.partner);
        String key = MapTiles.key(p, dark, photo != null);
        if (key.equals(LocationStore.mapKey(context)) && LocationStore.mapFile(context).isFile()) {
            if (photo != null) photo.recycle();
            return;
        }

        MapTiles.Result result = MapTiles.compose(context, p, dark, photo);
        if (photo != null) photo.recycle();
        if (result == null) return;
        try {
            MapTiles.save(result.bitmap, LocationStore.mapFile(context));
            /* A picture with missing tiles is shown, and drawn again next time. */
            LocationStore.setMapKey(context, result.complete ? key : null);
        } catch (Exception ignored) {
            // keep the previous picture
        } finally {
            result.bitmap.recycle();
        }
    }

    /*
     * The partner's photo for the pin: downloaded once per storage path (the signed
     * URL changes every time, the path only when they pick a new photo), then read
     * from app storage. Null without a photo or while offline with nothing cached.
     */
    static Bitmap partnerPhoto(Context context, MapPayload.Dot partner) {
        File file = LocationStore.photoFile(context);
        if (partner == null || !partner.hasPhoto()) {
            //noinspection ResultOfMethodCallIgnored
            file.delete();
            LocationStore.setPhotoKey(context, null);
            return null;
        }
        if (!partner.photoKey.equals(LocationStore.photoKey(context)) || !file.isFile()) {
            byte[] bytes = download(partner.photo);
            if (bytes != null && BitmapFactory.decodeByteArray(bytes, 0, bytes.length) != null) {
                try {
                    File temp = new File(file.getParentFile(), file.getName() + ".tmp");
                    try (FileOutputStream out = new FileOutputStream(temp)) {
                        out.write(bytes);
                    }
                    if (temp.renameTo(file)) LocationStore.setPhotoKey(context, partner.photoKey);
                } catch (Exception ignored) {
                    // keep the previous photo, if any
                }
            }
        }
        if (!partner.photoKey.equals(LocationStore.photoKey(context)) || !file.isFile()) return null;
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = 2;
        return BitmapFactory.decodeFile(file.getAbsolutePath(), options);
    }

    private static byte[] download(String url) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(15_000);
            if (connection.getResponseCode() != 200) return null;
            try (InputStream in = connection.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[16384];
                int n;
                while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
                return out.toByteArray();
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    static RemoteViews render(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_map);
        boolean configured = WidgetStore.isConfigured(context);
        MapPayload p = configured ? MapPayload.parse(LocationStore.payload(context)) : null;
        Bitmap map = p != null && p.hasMap() ? decode(context) : null;

        if (map != null) {
            views.setImageViewBitmap(R.id.widget_map_image, map);
            views.setViewVisibility(R.id.widget_map_image, View.VISIBLE);
            views.setViewVisibility(R.id.widget_map_attribution, View.VISIBLE);
            views.setViewVisibility(R.id.widget_map_caption, View.VISIBLE);
            views.setViewVisibility(R.id.widget_map_empty, View.GONE);
            views.setTextViewText(R.id.widget_map_title, p.title);
            views.setTextViewText(R.id.widget_map_line, p.line);
            views.setContentDescription(R.id.widget_root, p.title + ". " + p.line);
        } else {
            views.setViewVisibility(R.id.widget_map_image, View.GONE);
            views.setViewVisibility(R.id.widget_map_attribution, View.GONE);
            views.setViewVisibility(R.id.widget_map_caption, View.GONE);
            views.setViewVisibility(R.id.widget_map_empty, View.VISIBLE);
            PairCharacters.apply(context, views, null, 72);

            String title;
            String text;
            if (!configured) {
                title = context.getString(R.string.widget_map_title);
                text = context.getString(R.string.widget_setup_headline);
            } else if (p == null) {
                title = context.getString(R.string.widget_map_title);
                text = context.getString(R.string.widget_map_loading);
            } else {
                title = p.title.isEmpty() ? context.getString(R.string.widget_map_title) : p.title;
                text = p.hasMap() ? context.getString(R.string.widget_map_loading) : p.line;
            }
            views.setTextViewText(R.id.widget_map_empty_title, title);
            views.setTextViewText(R.id.widget_map_empty_text, text);
            views.setContentDescription(R.id.widget_root, title + ". " + text);
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("vpare://map"), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        views.setOnClickPendingIntent(R.id.widget_root,
            PendingIntent.getActivity(context, 50, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return views;
    }

    private static Bitmap decode(Context context) {
        if (!LocationStore.mapFile(context).isFile()) return null;
        return BitmapFactory.decodeFile(LocationStore.mapFile(context).getAbsolutePath());
    }
}
