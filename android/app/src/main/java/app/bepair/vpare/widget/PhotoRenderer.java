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

import app.bepair.vpare.MainActivity;
import app.bepair.vpare.R;

/** Draws the «Фото» widget from the stored photo, or the invitation to add one. */
public final class PhotoRenderer {
    /* RemoteViews travel through a binder with a size cap; 720 px is sharp on any widget and well under it. */
    private static final int MAX_SIDE = 720;

    private PhotoRenderer() {}

    public static int[] ids(Context context) {
        return AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context, PhotoWidgetProvider.class));
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : ids(context)) manager.updateAppWidget(id, render(context));
    }

    static RemoteViews render(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_photo);
        boolean configured = WidgetStore.isConfigured(context);
        Bitmap photo = configured ? decode(context) : null;

        if (photo != null) {
            views.setImageViewBitmap(R.id.widget_photo, photo);
            views.setViewVisibility(R.id.widget_photo, View.VISIBLE);
            views.setViewVisibility(R.id.widget_photo_empty, View.GONE);
            views.setContentDescription(R.id.widget_root, context.getString(R.string.widget_photo_name));
        } else {
            views.setViewVisibility(R.id.widget_photo, View.GONE);
            views.setViewVisibility(R.id.widget_photo_empty, View.VISIBLE);
            views.setImageViewBitmap(R.id.widget_mark, PairMarkPainter.draw(context, null));
            int text = !configured
                ? R.string.widget_setup_headline
                : PhotoStore.isEmpty(context) ? R.string.widget_photo_empty : R.string.widget_photo_loading;
            views.setTextViewText(R.id.widget_photo_text, context.getString(text));
            views.setContentDescription(R.id.widget_root, context.getString(text));
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("vpare://album"), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        views.setOnClickPendingIntent(R.id.widget_root,
            PendingIntent.getActivity(context, 20, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return views;
    }

    private static Bitmap decode(Context context) {
        if (!PhotoStore.hasPhoto(context)) return null;
        String path = PhotoStore.file(context).getAbsolutePath();
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(path, bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;

        int sample = 1;
        while (Math.max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_SIDE) sample *= 2;
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = sample;
        Bitmap bitmap = BitmapFactory.decodeFile(path, options);
        if (bitmap == null) return null;

        int longSide = Math.max(bitmap.getWidth(), bitmap.getHeight());
        if (longSide <= MAX_SIDE) return bitmap;
        float scale = MAX_SIDE / (float) longSide;
        Bitmap scaled = Bitmap.createScaledBitmap(bitmap, Math.round(bitmap.getWidth() * scale), Math.round(bitmap.getHeight() * scale), true);
        if (scaled != bitmap) bitmap.recycle();
        return scaled;
    }
}
