package app.bepair.vpare.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** «Пара» widget. Draws from the cached snapshot at once, then fetches a fresh one. */
public class CoupleWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, WidgetRenderer.render(context, true));
        WidgetRefreshWorker.schedule(context);
        WidgetRefreshWorker.refreshNow(context);
    }

    @Override
    public void onEnabled(Context context) {
        WidgetRefreshWorker.schedule(context);
    }

    @Override
    public void onDisabled(Context context) {
        if (!WidgetRenderer.hasAnyWidget(context)) WidgetRefreshWorker.cancel(context);
    }
}
