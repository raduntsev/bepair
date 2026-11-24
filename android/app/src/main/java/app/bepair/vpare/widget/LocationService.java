package app.bepair.vpare.widget;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import androidx.core.location.LocationListenerCompat;
import androidx.core.location.LocationManagerCompat;
import androidx.core.location.LocationRequestCompat;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import app.bepair.vpare.MainActivity;
import app.bepair.vpare.R;

/**
 * «Где мы»: sends this phone's point every five minutes and redraws the
 * «Карта» widget with the partner's.
 *
 * Android lets background work wake only every 15 minutes, so five needs a
 * foreground service — and with it a quiet notification for as long as the
 * phone shares. That is on purpose: you always see that you are sharing, and
 * «Не делиться» on the notification switches it off for the account, not only
 * for this phone. Only the latest point is sent; the server keeps no track.
 *
 * The service stops itself the moment the server says sharing is off (it was
 * switched off in the app or on another phone), or the widget key is revoked.
 */
public class LocationService extends Service {
    static final String ACTION_STOP = "app.bepair.vpare.location.STOP";
    static final String CHANNEL = "location";
    static final int ID = 4200;
    static final long INTERVAL_MS = 5 * 60 * 1000L;
    /* A point is sent again sooner only when the phone has really moved. */
    private static final long MIN_RESEND_MS = 4 * 60 * 1000L + 30_000L;
    private static final float MOVED_M = 150f;

    private static volatile boolean running = false;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private LocationManager manager;
    private String provider;
    private final LocationListenerCompat listener = this::onFix;
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            onTick();
            handler.postDelayed(this, INTERVAL_MS);
        }
    };

    public static boolean isRunning() {
        return running;
    }

    public static boolean permitted(Context context) {
        return granted(context, Manifest.permission.ACCESS_FINE_LOCATION) || granted(context, Manifest.permission.ACCESS_COARSE_LOCATION);
    }

    /* «Allow all the time»: the service may come back after a reboot without the app being opened. */
    public static boolean backgroundPermitted(Context context) {
        if (Build.VERSION.SDK_INT < 29) return permitted(context);
        return granted(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION);
    }

    private static boolean granted(Context context, String permission) {
        return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED;
    }

    /** Starts the service if this phone shares and may. False when Android refuses. */
    public static boolean start(Context context) {
        if (!LocationStore.sharing(context) || !WidgetStore.isConfigured(context) || !permitted(context)) return false;
        try {
            ContextCompat.startForegroundService(context, new Intent(context, LocationService.class));
            return true;
        } catch (Exception e) {
            /* Started from the background without the exemption (Android 12+): the app's next open starts it. */
            return false;
        }
    }

    public static void stop(Context context) {
        context.stopService(new Intent(context, LocationService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        manager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            ServiceCompat.startForeground(this, ID, notification(), Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0);
        } catch (Exception e) {
            /* No location permission any more, or started from the background: nothing to do here. */
            stopSelf();
            return START_NOT_STICKY;
        }

        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            worker.execute(() -> {
                WidgetApi.stopSharing(this);
                LocationStore.setSharing(this, false);
                redraw();
                handler.post(this::stopSelf);
            });
            return START_NOT_STICKY;
        }

        if (!LocationStore.sharing(this) || !WidgetStore.isConfigured(this) || !permitted(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if (!running) {
            running = true;
            listen();
            handler.post(tick);
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        handler.removeCallbacks(tick);
        if (manager != null) LocationManagerCompat.removeUpdates(manager, listener);
        worker.shutdown();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    /* Wi-Fi and cell towers first: a couple's map does not need GPS, the battery does not want it. */
    private String chooseProvider() {
        if (manager == null) return null;
        boolean fine = granted(this, Manifest.permission.ACCESS_FINE_LOCATION);
        if (Build.VERSION.SDK_INT >= 31 && manager.hasProvider(LocationManager.FUSED_PROVIDER) && manager.isProviderEnabled(LocationManager.FUSED_PROVIDER)) {
            return LocationManager.FUSED_PROVIDER;
        }
        if (manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) return LocationManager.NETWORK_PROVIDER;
        if (fine && manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) return LocationManager.GPS_PROVIDER;
        return null;
    }

    private void listen() {
        String next = chooseProvider();
        if (next == null || next.equals(provider)) return;
        try {
            if (provider != null) LocationManagerCompat.removeUpdates(manager, listener);
            provider = next;
            LocationRequestCompat request = new LocationRequestCompat.Builder(INTERVAL_MS)
                .setQuality(LocationRequestCompat.QUALITY_BALANCED_POWER_ACCURACY)
                .setMinUpdateIntervalMillis(INTERVAL_MS - 60_000L)
                .build();
            LocationManagerCompat.requestLocationUpdates(manager, provider, request, listener, Looper.getMainLooper());
            Location known = manager.getLastKnownLocation(provider);
            if (known != null && System.currentTimeMillis() - known.getTime() < INTERVAL_MS) onFix(known);
        } catch (SecurityException e) {
            provider = null;
        }
    }

    private void onFix(@NonNull Location location) {
        worker.execute(() -> send(location, false));
    }

    /* Every five minutes, whether or not the phone moved: the partner may have. */
    private void onTick() {
        listen();
        if (provider == null) {
            worker.execute(() -> {
                WidgetApi.refreshLocation(this);
                redraw();
            });
            return;
        }
        if (System.currentTimeMillis() - LocationStore.sentAt(this) < INTERVAL_MS - 30_000L) {
            worker.execute(() -> {
                handle(WidgetApi.refreshLocation(this));
                redraw();
            });
            return;
        }
        try {
            LocationManagerCompat.getCurrentLocation(manager, provider, (android.os.CancellationSignal) null, worker, location -> {
                if (location != null) send(location, true);
                else {
                    handle(WidgetApi.refreshLocation(this));
                    redraw();
                }
            });
        } catch (SecurityException e) {
            stopSelf();
        }
    }

    /* Runs on the worker thread. */
    private void send(Location location, boolean due) {
        double[] last = LocationStore.sentPoint(this);
        long since = System.currentTimeMillis() - LocationStore.sentAt(this);
        if (!due && last != null && since < MIN_RESEND_MS) {
            float[] moved = new float[1];
            Location.distanceBetween(last[0], last[1], location.getLatitude(), location.getLongitude(), moved);
            if (moved[0] < MOVED_M) return;
        }
        WidgetApi.Result result = WidgetApi.sendLocation(this, location.getLatitude(), location.getLongitude(),
            location.hasAccuracy() ? location.getAccuracy() : 0f, location.getTime());
        if (result == WidgetApi.Result.OK) LocationStore.markSent(this, location.getLatitude(), location.getLongitude());
        handle(result);
        redraw();
    }

    /* The server's word is final: sharing off anywhere, or the key gone, ends the service. */
    private void handle(WidgetApi.Result result) {
        if (result == WidgetApi.Result.REVOKED || result == WidgetApi.Result.NOT_CONFIGURED) {
            LocationStore.setSharing(this, false);
            handler.post(this::stopSelf);
            return;
        }
        MapPayload payload = MapPayload.parse(LocationStore.payload(this));
        if (result == WidgetApi.Result.OK && payload != null && !payload.sharing) {
            LocationStore.setSharing(this, false);
            handler.post(this::stopSelf);
        }
    }

    private void redraw() {
        MapRenderer.compose(this);
        MapRenderer.updateAll(this);
    }

    private Notification notification() {
        NotificationManager notifications = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26 && notifications != null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, getString(R.string.location_channel), NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            channel.setSound(null, null);
            channel.enableVibration(false);
            notifications.createNotificationChannel(channel);
        }

        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("vpare://map"), this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openIntent = PendingIntent.getActivity(this, 60, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent stop = new Intent(this, LocationService.class).setAction(ACTION_STOP);
        PendingIntent stopIntent = PendingIntent.getService(this, 61, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_vpare)
            .setColor(0xFF5856D6)
            .setContentTitle(getString(R.string.location_notification_title))
            .setContentText(getString(R.string.location_notification_text))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(openIntent)
            .addAction(0, getString(R.string.location_notification_stop), stopIntent)
            .build();
    }
}
