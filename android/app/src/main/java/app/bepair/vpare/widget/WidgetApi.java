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

    /**
     * The «Фото» widget's picture from {api}/api/widget/photo. Sends the ETag of
     * the photo it already has; 304 means keep it, 204 means the album is empty.
     */
    public static Result refreshPhoto(Context context) {
        String token = WidgetStore.token(context);
        String api = WidgetStore.api(context);
        if (token == null || api == null) return Result.NOT_CONFIGURED;

        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(api + "/api/widget/photo").openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(30_000);
            connection.setRequestProperty("Authorization", "Bearer " + token);
            String etag = PhotoStore.etag(context);
            if (etag != null && PhotoStore.hasPhoto(context)) connection.setRequestProperty("If-None-Match", etag);

            int status = connection.getResponseCode();
            if (status == 401) {
                WidgetStore.clear(context);
                PhotoStore.clear(context);
                return Result.REVOKED;
            }
            if (status == 304) return Result.OK;
            if (status == 204) {
                PhotoStore.markEmpty(context);
                return Result.OK;
            }
            if (status != 200) return Result.FAILED;

            byte[] bytes = readBytes(connection.getInputStream());
            if (bytes.length == 0) return Result.FAILED;
            PhotoStore.save(context, bytes, connection.getHeaderField("ETag"));
            return Result.OK;
        } catch (Exception e) {
            return Result.FAILED;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    /** The «Дела» widget's list from {api}/api/widget/tasks. */
    public static Result refreshTasks(Context context) {
        return tasks(context, "GET", null);
    }

    /** Ticks one request off; the answer is the fresh list. */
    public static Result completeTask(Context context, String id) {
        return tasks(context, "POST", "{\"id\":\"" + id.replaceAll("[^0-9a-fA-F-]", "") + "\"}");
    }

    private static Result tasks(Context context, String method, String body) {
        String token = WidgetStore.token(context);
        String api = WidgetStore.api(context);
        if (token == null || api == null) return Result.NOT_CONFIGURED;

        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(api + "/api/widget/tasks").openConnection();
            connection.setRequestMethod(method);
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(15_000);
            connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestProperty("Accept", "application/json");
            if (body != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                connection.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
            }

            int status = connection.getResponseCode();
            if (status == 401) {
                WidgetStore.clear(context);
                TasksStore.clear(context);
                return Result.REVOKED;
            }
            /* Gone or not yours: nothing to retry; a fresh list puts the row right. */
            if (status == 404 || status == 400) {
                if (body != null) tasks(context, "GET", null);
                return Result.REVOKED;
            }
            if (status != 200) return Result.FAILED;

            String text = read(connection.getInputStream());
            return TasksStore.save(context, text) ? Result.OK : Result.FAILED;
        } catch (Exception e) {
            return Result.FAILED;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static byte[] readBytes(InputStream stream) throws java.io.IOException {
        try (InputStream in = stream; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16384];
            int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            return out.toByteArray();
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
