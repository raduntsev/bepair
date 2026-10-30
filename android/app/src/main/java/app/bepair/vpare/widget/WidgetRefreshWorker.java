package app.bepair.vpare.widget;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.concurrent.TimeUnit;

/**
 * Fetches a fresh snapshot and redraws every widget. Runs every 30 minutes
 * while at least one widget is placed, and once on demand from the app.
 */
public class WidgetRefreshWorker extends Worker {
    private static final String PERIODIC = "vpare-widget-periodic";
    private static final String ONCE = "vpare-widget-once";

    public WidgetRefreshWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        WidgetApi.Result result = WidgetApi.refresh(context);
        WidgetRenderer.updateAll(context);
        return result == WidgetApi.Result.FAILED ? Result.retry() : Result.success();
    }

    private static Constraints online() {
        return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
    }

    public static void refreshNow(Context context) {
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(WidgetRefreshWorker.class)
            .setConstraints(online())
            .build();
        WorkManager.getInstance(context).enqueueUniqueWork(ONCE, ExistingWorkPolicy.REPLACE, request);
    }

    public static void schedule(Context context) {
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(WidgetRefreshWorker.class, 30, TimeUnit.MINUTES)
            .setConstraints(online())
            .build();
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request);
    }

    public static void cancel(Context context) {
        WorkManager.getInstance(context).cancelUniqueWork(PERIODIC);
    }
}
