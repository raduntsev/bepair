package app.bepair.vpare.widget;

import android.content.Context;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Fetches the snapshot from {api}/api/widget with the widget's own key. */
public final class WidgetApi {
    public enum Result { OK, REVOKED, NOT_CONFIGURED, FAILED }

    private WidgetApi() {}

    public static Result refresh(Context context) {
        String token = WidgetStore.token(context);
        String api = WidgetStore.api(context);
        if (token == null || api == null) return Result.NOT_CONFIGURED;

        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(api + "/api/widget").openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(15_000);
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestProperty("Accept", "application/json");

            int status = connection.getResponseCode();
            if (status == 401) {
                /* Revoked in settings or signed out elsewhere: stop showing anything private. */
                WidgetStore.clear(context);
                return Result.REVOKED;
            }
            if (status != 200) return Result.FAILED;

            String body = read(connection.getInputStream());
            if (WidgetSnapshot.parse(body) == null) return Result.FAILED;
            WidgetStore.saveSnapshot(context, body);
            return Result.OK;
        } catch (Exception e) {
            return Result.FAILED;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static String read(InputStream stream) throws java.io.IOException {
        try (InputStream in = stream; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }
}
