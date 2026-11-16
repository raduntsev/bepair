package app.bepair.vpare.widget;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import app.bepair.vpare.MainActivity;
import app.bepair.vpare.R;

/**
 * Today on the lock screen: one quiet, persistent notification that carries
 * the same sentence as the widget («Аня отметила день», «Ваш день: лёгкий»).
 * Off by default; switched on from the app (Профиль → Виджеты). It never
 * rings or vibrates — it is a status line, not an alert — and it follows the
 * same reciprocity rule as the widget because it reads the same snapshot.
 */
public final class LockStatus {
    static final String CHANNEL = "status";
    static final int ID = 4100;

    private LockStatus() {}

    public static boolean canPost(Context context) {
        return Build.VERSION.SDK_INT < 33
            || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    public static void update(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;

        if (!WidgetStore.lockStatus(context) || !WidgetStore.isConfigured(context)) {
            manager.cancel(ID);
            return;
        }
        if (!canPost(context)) return;

        WidgetSnapshot s = WidgetSnapshot.parse(WidgetStore.snapshot(context));
        if (s == null) return;

        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Статус дня", NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            channel.setSound(null, null);
            channel.enableVibration(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            manager.createNotificationChannel(channel);
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("vpare://day"), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open = PendingIntent.getActivity(context, 40, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_vpare)
            .setColor(0xFF5856D6)
            .setContentTitle(s.headline)
            .setContentText(s.sub)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(s.sub))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(open)
            .build();
        manager.notify(ID, notification);
    }
}
