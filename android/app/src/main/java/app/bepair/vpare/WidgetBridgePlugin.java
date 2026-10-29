package app.bepair.vpare;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import app.bepair.vpare.widget.WidgetRefreshWorker;
import app.bepair.vpare.widget.WidgetRenderer;
import app.bepair.vpare.widget.WidgetStore;

/**
 * The web app's handle on the home-screen widgets (src/lib/native.ts).
 * configure → store the read-only key; refresh → redraw now; clear → forget.
 */
@CapacitorPlugin(name = "WidgetBridge")
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
}
