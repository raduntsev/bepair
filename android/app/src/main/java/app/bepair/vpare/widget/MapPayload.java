package app.bepair.vpare.widget;

import org.json.JSONObject;

/**
 * What /api/widget/location answers: the two points under the reciprocity rule
 * and one line about them, already worded in the owner's language.
 */
public final class MapPayload {
    public static final class Dot {
        public final double lat;
        public final double lng;
        public final String initial;
        public final boolean stale;

        Dot(double lat, double lng, String initial, boolean stale) {
            this.lat = lat;
            this.lng = lng;
            this.initial = initial;
            this.stale = stale;
        }
    }

    /* no-space, no-partner, off, partner-off, waiting, ok */
    public final String state;
    public final boolean sharing;
    public final String title;
    public final String line;
    public final Dot me;
    public final Dot partner;

    private MapPayload(String state, boolean sharing, String title, String line, Dot me, Dot partner) {
        this.state = state;
        this.sharing = sharing;
        this.title = title;
        this.line = line;
        this.me = me;
        this.partner = partner;
    }

    public boolean hasMap() {
        return me != null || partner != null;
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
                dot(o.optJSONObject("partner")));
        } catch (Exception e) {
            return null;
        }
    }

    private static Dot dot(JSONObject o) {
        if (o == null || !o.has("lat") || !o.has("lng")) return null;
        double lat = o.optDouble("lat");
        double lng = o.optDouble("lng");
        if (Double.isNaN(lat) || Double.isNaN(lng)) return null;
        return new Dot(lat, lng, o.optString("initial", "·"), o.optBoolean("stale", false));
    }
}
