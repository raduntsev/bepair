package app.bepair.vpare.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;

/**
 * «Дела» widget. Shows the stored list at once, then asks for a fresh one.
 * A tap on an open request marks it done on screen immediately and hands the
 * request to {@link TaskCompleteWorker}, which waits for a network if needed.
 */
public class TasksWidgetProvider extends AppWidgetProvider {
    static final String ACTION_COMPLETE = "app.bepair.vpare.widget.TASK_COMPLETE";
    static final String EXTRA_ID = "task_id";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_COMPLETE.equals(intent.getAction())) {
            String id = intent.getStringExtra(EXTRA_ID);
            if (id != null && WidgetStore.isConfigured(context)) {
                TasksStore.addPending(context, id);
                TasksRenderer.updateAll(context);
                TaskCompleteWorker.enqueue(context, id);
            }
            return;
        }
        super.onReceive(context, intent);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, TasksRenderer.render(context));
        WidgetRefreshWorker.schedule(context);
        WidgetRefreshWorker.refreshNow(context);
    }

    @Override
    public void onEnabled(Context context) {
        WidgetRefreshWorker.schedule(context);
    }

    @Override
    public void onDisabled(Context context) {
        TasksStore.clear(context);
        if (!WidgetRenderer.needsRefresh(context)) WidgetRefreshWorker.cancel(context);
    }
}
