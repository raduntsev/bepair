package app.bepair.vpare.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import app.bepair.vpare.MainActivity;
import app.bepair.vpare.R;

/** Turns the stored snapshot into RemoteViews for every placed widget. */
public final class WidgetRenderer {
    private WidgetRenderer() {}

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : manager.getAppWidgetIds(new ComponentName(context, DayWidgetProvider.class))) {
            manager.updateAppWidget(id, render(context, false));
        }
        for (int id : manager.getAppWidgetIds(new ComponentName(context, CoupleWidgetProvider.class))) {
            manager.updateAppWidget(id, render(context, true));
        }
        PhotoRenderer.updateAll(context);
        TasksRenderer.updateAll(context);
        /* The lock-screen line reads the same snapshot, so it changes with the widgets. */
        LockStatus.update(context);
    }

    /* Periodic refresh is needed while anything shows today: a widget or the lock-screen line. */
    public static boolean needsRefresh(Context context) {
        return hasAnyWidget(context) || WidgetStore.lockStatus(context);
    }

    public static boolean hasAnyWidget(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        return manager.getAppWidgetIds(new ComponentName(context, DayWidgetProvider.class)).length > 0
            || manager.getAppWidgetIds(new ComponentName(context, CoupleWidgetProvider.class)).length > 0
            || PhotoRenderer.ids(context).length > 0
            || TasksRenderer.ids(context).length > 0;
    }

    /* vpare://day opens the app on that screen; MainActivity hands it to the web app. */
    private static PendingIntent open(Context context, String path, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("vpare://" + path), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static RemoteViews render(Context context, boolean couple) {
        RemoteViews views = new RemoteViews(context.getPackageName(), couple ? R.layout.widget_couple : R.layout.widget_day);
        boolean configured = WidgetStore.isConfigured(context);
        WidgetSnapshot s = configured ? WidgetSnapshot.parse(WidgetStore.snapshot(context)) : null;

        PairCharacters.apply(context, views, s, 84);

        if (s == null) {
            views.setTextViewText(R.id.widget_date, "Впаре");
            views.setTextViewText(R.id.widget_headline,
                context.getString(configured ? R.string.widget_loading : R.string.widget_setup_headline));
            views.setTextViewText(R.id.widget_sub, configured ? "" : context.getString(R.string.widget_setup_sub));
        } else {
            views.setTextViewText(R.id.widget_date, s.dateLabel);
            views.setTextViewText(R.id.widget_headline, s.headline);
            views.setTextViewText(R.id.widget_sub, s.sub);
        }

        if (couple) {
            /* Days together live in the app; the widget keeps only the run and one action. */
            views.setViewVisibility(R.id.widget_together, View.GONE);

            if (s != null && s.streakEnabled) {
                views.setViewVisibility(R.id.widget_streak, View.VISIBLE);
                views.setTextViewText(R.id.widget_streak_days, String.valueOf(s.streakCurrent));
                views.setTextViewText(R.id.widget_streak_label, s.streakLabel);
            } else {
                views.setViewVisibility(R.id.widget_streak, View.GONE);
            }

            String waiting = s != null ? waitingLine(s) : null;
            views.setViewVisibility(R.id.widget_waiting, waiting != null ? View.VISIBLE : View.GONE);
            if (waiting != null) views.setTextViewText(R.id.widget_waiting, waiting);

            /* Once today is marked, the button is a way back to the day, not a request to mark it. */
            views.setViewVisibility(R.id.widget_action_day, View.GONE);
            views.setOnClickPendingIntent(R.id.widget_action_ping, open(context, "ping", 12));
            views.setOnClickPendingIntent(R.id.widget_today, open(context, "day", 13));
            views.setOnClickPendingIntent(R.id.widget_streak, open(context, "couple", 15));
        } else {
            views.setOnClickPendingIntent(R.id.widget_root, open(context, "day", 10));
        }

        String description = s != null ? s.headline + ". " + s.sub : context.getString(R.string.widget_setup_headline);
        views.setContentDescription(R.id.widget_root, description);
        return views;
    }

    private static String waitingLine(WidgetSnapshot s) {
        if (s.waitingLetters == 0 && s.waitingTasks == 0) return null;
        StringBuilder line = new StringBuilder();
        if (s.waitingLetters > 0) line.append(s.waitingLetters == 1 ? "Письмо ждёт" : "Писем: " + s.waitingLetters);
        if (s.waitingTasks > 0) {
            if (line.length() > 0) line.append(", ");
            line.append(s.waitingTasks == 1 ? "1 просьба" : "просьб: " + s.waitingTasks);
        }
        return line.toString();
    }
}
