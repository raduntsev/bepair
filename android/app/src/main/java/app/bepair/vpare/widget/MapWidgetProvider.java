package app.bepair.vpare.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/**
 * «Карта» widget. Shows the stored map at once, then asks for fresh points.
 * While «Где мы» is on, the location service redraws it every five minutes;
 * otherwise the half-hourly refresh keeps its message current.
 */
public class MapWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, MapRenderer.render(context));
        WidgetRefreshWorker.schedule(context);
        WidgetRefreshWorker.refreshNow(context);
    }

    @Override
    public void onEnabled(Context context) {
        WidgetRefreshWorker.schedule(context);
    }

    @Override
    public void onDisabled(Context context) {
        /* The picture goes with the last widget; the answer stays for the service's own use. */
        //noinspection ResultOfMethodCallIgnored
        LocationStore.mapFile(context).delete();
        LocationStore.setMapKey(context, null);
        if (!WidgetRenderer.needsRefresh(context)) WidgetRefreshWorker.cancel(context);
    }
}
