package app.bepair.vpare.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StrikethroughSpan;
import android.view.View;
import android.widget.RemoteViews;

import java.util.Set;

import app.bepair.vpare.MainActivity;
import app.bepair.vpare.R;

/**
 * Draws the «Дела» widget: up to six requests, open ones first. Tapping an
 * open one ticks it off (a broadcast to {@link TasksWidgetProvider}); a done
 * one, the header or the empty space open the day in the app.
 */
public final class TasksRenderer {
    static final int ROWS = 6;
    private static final int[] ROW = { R.id.task_row_0, R.id.task_row_1, R.id.task_row_2, R.id.task_row_3, R.id.task_row_4, R.id.task_row_5 };
    private static final int[] CHECK = { R.id.task_check_0, R.id.task_check_1, R.id.task_check_2, R.id.task_check_3, R.id.task_check_4, R.id.task_check_5 };
    private static final int[] TEXT = { R.id.task_text_0, R.id.task_text_1, R.id.task_text_2, R.id.task_text_3, R.id.task_text_4, R.id.task_text_5 };
    private static final int[] DONE = { R.id.task_done_0, R.id.task_done_1, R.id.task_done_2, R.id.task_done_3, R.id.task_done_4, R.id.task_done_5 };

    private TasksRenderer() {}

    public static int[] ids(Context context) {
        return AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context, TasksWidgetProvider.class));
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : ids(context)) manager.updateAppWidget(id, render(context));
    }

    static RemoteViews render(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_tasks);
        boolean configured = WidgetStore.isConfigured(context);
        TasksStore.Payload payload = configured ? TasksStore.payload(context) : null;
        Set<String> pending = TasksStore.pending(context);

        PendingIntent openDay = open(context);
        views.setOnClickPendingIntent(R.id.widget_root, openDay);
        views.setOnClickPendingIntent(R.id.tasks_header, openDay);

        if (payload == null) {
            views.setTextViewText(R.id.tasks_title, context.getString(R.string.widget_tasks_title));
            views.setTextViewText(R.id.tasks_left, "");
            showEmpty(views, context.getString(configured ? R.string.widget_tasks_loading : R.string.widget_setup_headline));
            views.setContentDescription(R.id.widget_root, context.getString(R.string.widget_tasks_name));
            return views;
        }

        /* «осталось N» counts what is still open on this screen, including taps not yet sent. */
        int open = 0;
        for (TasksStore.Item item : payload.items) if (!item.done && !pending.contains(item.id)) open++;
        views.setTextViewText(R.id.tasks_title, payload.title);
        views.setTextViewText(R.id.tasks_left, open == 0 ? "" : payload.left.replaceAll("\\d+", String.valueOf(open)));

        if (payload.items.isEmpty()) {
            showEmpty(views, payload.empty);
            views.setContentDescription(R.id.widget_root, payload.title + ". " + payload.empty);
            return views;
        }

        views.setViewVisibility(R.id.tasks_empty, View.GONE);
        views.setViewVisibility(R.id.tasks_list, View.VISIBLE);
        for (int i = 0; i < ROWS; i++) {
            if (i >= payload.items.size()) {
                views.setViewVisibility(ROW[i], View.GONE);
                continue;
            }
            TasksStore.Item item = payload.items.get(i);
            boolean done = item.done || pending.contains(item.id);
            views.setViewVisibility(ROW[i], View.VISIBLE);
            views.setInt(CHECK[i], "setBackgroundResource", done ? R.drawable.widget_check_done : R.drawable.widget_check_open);
            views.setTextViewText(CHECK[i], done ? "✓" : "");
            views.setViewVisibility(TEXT[i], done ? View.GONE : View.VISIBLE);
            views.setViewVisibility(DONE[i], done ? View.VISIBLE : View.GONE);
            if (done) {
                SpannableString struck = new SpannableString(item.content);
                struck.setSpan(new StrikethroughSpan(), 0, struck.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                views.setTextViewText(DONE[i], struck);
                views.setOnClickPendingIntent(ROW[i], openDay);
                views.setContentDescription(ROW[i], item.content);
            } else {
                views.setTextViewText(TEXT[i], item.content);
                views.setOnClickPendingIntent(ROW[i], complete(context, item.id, i));
                views.setContentDescription(ROW[i], context.getString(R.string.widget_tasks_mark, item.content));
            }
        }
        views.setContentDescription(R.id.widget_root, payload.title);
        return views;
    }

    private static void showEmpty(RemoteViews views, String text) {
        views.setViewVisibility(R.id.tasks_list, View.GONE);
        views.setViewVisibility(R.id.tasks_empty, View.VISIBLE);
        views.setTextViewText(R.id.tasks_empty, text);
    }

    private static PendingIntent open(Context context) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("vpare://day"), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, 30, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /* One request code per row, and the id in the data URI, so each row keeps its own intent. */
    private static PendingIntent complete(Context context, String taskId, int row) {
        Intent intent = new Intent(context, TasksWidgetProvider.class)
            .setAction(TasksWidgetProvider.ACTION_COMPLETE)
            .setData(Uri.parse("vpare-task://" + taskId))
            .putExtra(TasksWidgetProvider.EXTRA_ID, taskId);
        return PendingIntent.getBroadcast(context, 40 + row, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
