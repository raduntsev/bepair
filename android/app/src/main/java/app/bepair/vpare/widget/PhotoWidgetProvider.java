package app.bepair.vpare.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** «Фото» widget. Shows the stored photo at once, then asks whether the album has turned over. */
public class PhotoWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, PhotoRenderer.render(context));
        WidgetRefreshWorker.schedule(context);
        WidgetRefreshWorker.refreshNow(context);
    }

    @Override
    public void onEnabled(Context context) {
        WidgetRefreshWorker.schedule(context);
    }

    @Override
    public void onDisabled(Context context) {
        PhotoStore.clear(context);
        if (!WidgetRenderer.needsRefresh(context)) WidgetRefreshWorker.cancel(context);
    }
}
