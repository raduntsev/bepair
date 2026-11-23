package app.bepair.vpare.widget;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/**
 * Sends one tick from the «Дела» widget. Offline, it waits for a network and
 * the row stays ticked meanwhile; if the server says no (already gone, key
 * revoked), the row goes back to what the server says.
 */
public class TaskCompleteWorker extends Worker {
    private static final String KEY_ID = "id";

    public TaskCompleteWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    public static void enqueue(Context context, String id) {
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(TaskCompleteWorker.class)
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setInputData(new Data.Builder().putString(KEY_ID, id).build())
            .build();
        WorkManager.getInstance(context).enqueueUniqueWork("vpare-task-" + id, ExistingWorkPolicy.KEEP, request);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        String id = getInputData().getString(KEY_ID);
        if (id == null) return Result.failure();

        WidgetApi.Result result = WidgetApi.completeTask(context, id);
        if (result == WidgetApi.Result.FAILED && getRunAttemptCount() < 5) return Result.retry();

        TasksStore.removePending(context, id);
        /* The partner's side changed too: the day widgets' «просьб» count follows. */
        if (result == WidgetApi.Result.OK) WidgetApi.refresh(context);
        WidgetRenderer.updateAll(context);
        return Result.success();
    }
}
