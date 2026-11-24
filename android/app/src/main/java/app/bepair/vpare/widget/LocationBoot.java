package app.bepair.vpare.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * After a reboot or an app update, «Где мы» comes back by itself — but only
 * with «Allow all the time». Without it the service waits for the app to open:
 * Android does not let a location service start unseen.
 */
public class LocationBoot extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) return;
        if (LocationStore.sharing(context) && LocationService.backgroundPermitted(context)) LocationService.start(context);
    }
}
