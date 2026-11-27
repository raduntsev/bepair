package app.bepair.vpare;

import android.Manifest;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import app.bepair.vpare.widget.LocationService;
import app.bepair.vpare.widget.LocationStore;
import app.bepair.vpare.widget.LockStatus;
import app.bepair.vpare.widget.MapRenderer;
import app.bepair.vpare.widget.PhotoStore;
import app.bepair.vpare.widget.TasksStore;
import app.bepair.vpare.widget.WidgetApi;
import app.bepair.vpare.widget.WidgetRefreshWorker;
import app.bepair.vpare.widget.WidgetRenderer;
import app.bepair.vpare.widget.WidgetStore;

/**
 * The web app's handle on the home-screen widgets (src/lib/native.ts).
 * configure → store the read-only key; refresh → redraw now; clear → forget.
 */
@CapacitorPlugin(
    name = "WidgetBridge",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications"),
        @Permission(strings = { Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION }, alias = "location"),
        @Permission(strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }, alias = "background")
    }
)
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void configure(PluginCall call) {
        String token = call.getString("token");
        String api = call.getString("api");
        if (token == null || api == null) {
            call.reject("token and api are required");
            return;
        }
        WidgetStore.configure(getContext(), token, api.replaceAll("/+$", ""));
        WidgetRenderer.updateAll(getContext());
        WidgetRefreshWorker.refreshNow(getContext());
        call.resolve();
    }

    /* The phone's charge for the open app's own «Где мы» point: the WebView does not tell it. */
    @PluginMethod
    public void battery(PluginCall call) {
        JSObject result = new JSObject();
        int[] b = WidgetApi.battery(getContext());
        if (b != null) {
            result.put("level", b[0]);
            result.put("charging", b[1] == 1);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void refresh(PluginCall call) {
        if (WidgetStore.isConfigured(getContext())) WidgetRefreshWorker.refreshNow(getContext());
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        /* Signed out: this phone stops sharing and forgets every point. */
        LocationService.stop(getContext());
        LocationStore.clear(getContext());
        WidgetStore.clear(getContext());
        PhotoStore.clear(getContext());
        TasksStore.clear(getContext());
        WidgetRenderer.updateAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("configured", WidgetStore.isConfigured(getContext()));
        String api = WidgetStore.api(getContext());
        if (api != null) result.put("api", api);
        call.resolve(result);
    }

    /*
     * Native push on Android goes through Firebase. Without google-services.json
     * the app has no Firebase project, and FirebaseMessaging.getInstance() kills
     * the process — no JavaScript catch can stop that. The build only generates
     * the google_app_id resource when the file is present, so its absence is a
     * safe, crash-free answer to «can this build receive push?».
     */
    @PluginMethod
    public void pushAvailable(PluginCall call) {
        int id = getContext().getResources().getIdentifier("google_app_id", "string", getContext().getPackageName());
        JSObject result = new JSObject();
        result.put("available", id != 0);
        call.resolve(result);
    }

    @PluginMethod
    public void lockStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabled", WidgetStore.lockStatus(getContext()));
        result.put("permitted", LockStatus.canPost(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void setLockStatus(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        if (enabled && Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "lockPermissionResult");
            return;
        }
        applyLockStatus(call, enabled);
    }

    @PermissionCallback
    private void lockPermissionResult(PluginCall call) {
        boolean granted = getPermissionState("notifications") == PermissionState.GRANTED;
        applyLockStatus(call, granted);
    }

    private void applyLockStatus(PluginCall call, boolean enabled) {
        WidgetStore.setLockStatus(getContext(), enabled);
        if (enabled) {
            WidgetRefreshWorker.schedule(getContext());
            WidgetRefreshWorker.refreshNow(getContext());
        } else if (!WidgetRenderer.needsRefresh(getContext())) {
            WidgetRefreshWorker.cancel(getContext());
        }
        LockStatus.update(getContext());
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        call.resolve(result);
    }

    /* «Где мы» — see src/lib/native.ts. */

    @PluginMethod
    public void locationStatus(PluginCall call) {
        call.resolve(locationState());
    }

    /* Asks for the permission; starts nothing — the app switches sharing on first, then calls ensureLocation. */
    @PluginMethod
    public void requestLocation(PluginCall call) {
        if (LocationService.permitted(getContext())) {
            askNotifications(call);
            return;
        }
        requestPermissionForAlias("location", call, "locationPermissionResult");
    }

    @PermissionCallback
    private void locationPermissionResult(PluginCall call) {
        if (LocationService.permitted(getContext())) askNotifications(call);
        else call.resolve(locationState());
    }

    /* The service's notification is the visible sign of sharing: without this permission Android hides it. */
    private void askNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "locationNotificationsResult");
            return;
        }
        call.resolve(locationState());
    }

    @PermissionCallback
    private void locationNotificationsResult(PluginCall call) {
        call.resolve(locationState());
    }

    /* Sharing is on in the database: run the service if permission is there. Never prompts. */
    @PluginMethod
    public void ensureLocation(PluginCall call) {
        LocationStore.setSharing(getContext(), true);
        if (!LocationService.isRunning()) LocationService.start(getContext());
        call.resolve(locationState(LocationService.permitted(getContext())));
    }

    @PluginMethod
    public void stopLocation(PluginCall call) {
        LocationStore.setSharing(getContext(), false);
        LocationService.stop(getContext());
        /* The widget learns «you don't share» from the server, in your words. */
        if (MapRenderer.ids(getContext()).length > 0) WidgetRefreshWorker.refreshNow(getContext());
        call.resolve(locationState(false));
    }

    @PluginMethod
    public void requestBackgroundLocation(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29 || LocationService.backgroundPermitted(getContext()) || !LocationService.permitted(getContext())) {
            call.resolve(locationState());
            return;
        }
        requestPermissionForAlias("background", call, "backgroundPermissionResult");
    }

    @PermissionCallback
    private void backgroundPermissionResult(PluginCall call) {
        call.resolve(locationState());
    }

    private JSObject locationState() {
        return locationState(LocationService.isRunning());
    }

    /* `running` is passed in right after a start or stop: the service flips its flag a moment later. */
    private JSObject locationState(boolean running) {
        JSObject result = new JSObject();
        result.put("running", running);
        result.put("foreground", LocationService.permitted(getContext()));
        result.put("background", LocationService.backgroundPermitted(getContext()));
        return result;
    }
}
