package app.bepair.vpare.widget;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * The «Дела» widget's last list from {api}/api/widget/tasks, plus the requests
 * ticked on the home screen that are still on their way to the server — those
 * show as done at once, whatever the network is doing.
 */
public final class TasksStore {
    private static final String PREFS = "vpare_widget_tasks";
    private static final String KEY_PAYLOAD = "payload";
    private static final String KEY_PENDING = "pending";

    private TasksStore() {}

    public static final class Item {
        public final String id;
        public final String content;
        public final boolean done;

        Item(String id, String content, boolean done) {
            this.id = id;
            this.content = content;
            this.done = done;
        }
    }

    public static final class Payload {
        public final String title;
        public final String empty;
        public final String left;
        public final List<Item> items;

        Payload(String title, String empty, String left, List<Item> items) {
            this.title = title;
            this.empty = empty;
            this.left = left;
            this.items = items;
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Parses and keeps a server payload; false if it is not one. */
    public static boolean save(Context context, String json) {
        if (parse(json) == null) return false;
        prefs(context).edit().putString(KEY_PAYLOAD, json).apply();
        return true;
    }

    public static Payload payload(Context context) {
        String json = prefs(context).getString(KEY_PAYLOAD, null);
        return json == null ? null : parse(json);
    }

    static Payload parse(String json) {
        try {
            JSONObject root = new JSONObject(json);
            JSONArray array = root.optJSONArray("items");
            List<Item> items = new ArrayList<>();
            if (array != null) {
                for (int i = 0; i < array.length(); i++) {
                    JSONObject item = array.getJSONObject(i);
                    items.add(new Item(item.getString("id"), item.optString("content", ""), item.optBoolean("done", false)));
                }
            }
            return new Payload(root.optString("title", ""), root.optString("empty", ""), root.optString("left", ""), items);
        } catch (Exception e) {
            return null;
        }
    }

    public static Set<String> pending(Context context) {
        return new HashSet<>(prefs(context).getStringSet(KEY_PENDING, new HashSet<>()));
    }

    public static void addPending(Context context, String id) {
        Set<String> set = pending(context);
        set.add(id);
        prefs(context).edit().putStringSet(KEY_PENDING, set).apply();
    }

    public static void removePending(Context context, String id) {
        Set<String> set = pending(context);
        set.remove(id);
        prefs(context).edit().putStringSet(KEY_PENDING, set).apply();
    }

    public static void clear(Context context) {
        prefs(context).edit().clear().apply();
    }
}
