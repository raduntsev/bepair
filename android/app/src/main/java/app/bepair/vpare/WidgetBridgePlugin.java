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

import app.bepair.vpare.widget.LockStatus;
import app.bepair.vpare.widget.PhotoStore;
import app.bepair.vpare.widget.WidgetRefreshWorker;
import app.bepair.vpare.widget.WidgetRenderer;
import app.bepair.vpare.widget.WidgetStore;

/**
 * The web app's handle on the home-screen widgets (src/lib/native.ts).
 * configure → store the read-only key; refresh → redraw now; clear → forget.
 */
@CapacitorPlugin(
    name = "WidgetBridge",
    permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications") }
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

    @PluginMethod
    public void refresh(PluginCall call) {
        if (WidgetStore.isConfigured(getContext())) WidgetRefreshWorker.refreshNow(getContext());
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        WidgetStore.clear(getContext());
        PhotoStore.clear(getContext());
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
}
