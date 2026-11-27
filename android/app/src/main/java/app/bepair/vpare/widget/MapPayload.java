package app.bepair.vpare.widget;

import org.json.JSONObject;

/**
 * What /api/widget/location answers: the partner's point under the reciprocity
 * rule (with their photo) and one line about it, already worded in the owner's
 * language. Older servers also sent the owner's own point; the widget ignores it.
 */
public final class MapPayload {
    public static final class Dot {
        public final double lat;
        public final double lng;
        public final String initial;
        public final boolean stale;
        /* A signed URL of the person's photo (expires), and its storage path: the stable key for the cached copy. */
        public final String photo;
        public final String photoKey;

        Dot(double lat, double lng, String initial, boolean stale) {
            this(lat, lng, initial, stale, null, null);
        }

        Dot(double lat, double lng, String initial, boolean stale, String photo, String photoKey) {
            this.lat = lat;
            this.lng = lng;
            this.initial = initial;
            this.stale = stale;
            this.photo = photo;
            this.photoKey = photoKey;
        }

        public boolean hasPhoto() {
            return photo != null && photoKey != null;
        }
    }

    /** The partner's phone charge under the same rule: 0–100, or -1 when unknown. */
    public static final class Battery {
        public final int level;
        public final boolean charging;

        Battery(int level, boolean charging) {
            this.level = level;
            this.charging = charging;
        }
    }

    /* no-space, no-partner, off, partner-off, waiting, ok */
    public final String state;
    public final boolean sharing;
    public final String title;
    public final String line;
    public final Dot me;
    public final Dot partner;
    public final Battery partnerBattery;

    private MapPayload(String state, boolean sharing, String title, String line, Dot me, Dot partner, Battery partnerBattery) {
        this.state = state;
        this.sharing = sharing;
        this.title = title;
        this.line = line;
        this.me = me;
        this.partner = partner;
        this.partnerBattery = partnerBattery;
    }

    public boolean hasMap() {
        return partner != null;
    }

    public static MapPayload parse(String json) {
        if (json == null) return null;
        try {
            JSONObject o = new JSONObject(json);
            if (o.optInt("v") != 1) return null;
            return new MapPayload(
                o.optString("state", "off"),
                o.optBoolean("sharing", false),
                o.optString("title", ""),
                o.optString("line", ""),
                dot(o.optJSONObject("me")),
                dot(o.optJSONObject("partner")),
                battery(o.optJSONObject("partnerBattery")));
        } catch (Exception e) {
            return null;
        }
    }

    private static Battery battery(JSONObject o) {
        if (o == null || !o.has("level")) return null;
        int level = o.optInt("level", -1);
        if (level < 0 || level > 100) return null;
        return new Battery(level, o.optBoolean("charging", false));
    }

    private static Dot dot(JSONObject o) {
        if (o == null || !o.has("lat") || !o.has("lng")) return null;
        double lat = o.optDouble("lat");
        double lng = o.optDouble("lng");
        if (Double.isNaN(lat) || Double.isNaN(lng)) return null;
        return new Dot(lat, lng, o.optString("initial", "·"), o.optBoolean("stale", false), text(o, "photo"), text(o, "photoKey"));
    }

    private static String text(JSONObject o, String key) {
        if (o.isNull(key)) return null;
        String value = o.optString(key, "");
        return value.isEmpty() ? null : value;
    }
}
