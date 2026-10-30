package app.bepair.vpare.widget;

import org.json.JSONObject;

/**
 * The server's snapshot (see src/lib/widgetSnapshot.ts). All wording arrives
 * ready-made, so the widget never decides grammar or what is still sealed.
 */
public final class WidgetSnapshot {
    public final String dateLabel;
    public final String headline;
    public final String sub;

    public final boolean meMarked;
    public final String meColor;

    public final boolean hasPartner;
    public final boolean partnerMarked;
    public final boolean partnerUnlocked;
    public final String partnerColor;

    public final int togetherDays;
    public final String togetherLabel;

    public final boolean streakEnabled;
    public final int streakCurrent;
    public final String streakLabel;

    public final int waitingLetters;
    public final int waitingTasks;

    private WidgetSnapshot(JSONObject json) {
        dateLabel = json.optString("dateLabel", "");
        headline = json.optString("headline", "");
        sub = json.optString("sub", "");

        JSONObject me = json.optJSONObject("me");
        meMarked = me != null && me.optBoolean("marked", false);
        meColor = me != null && !me.isNull("color") ? me.optString("color", null) : null;

        JSONObject partner = json.optJSONObject("partner");
        hasPartner = partner != null;
        partnerMarked = partner != null && partner.optBoolean("marked", false);
        partnerUnlocked = partner != null && partner.optBoolean("unlocked", false);
        partnerColor = partner != null && !partner.isNull("color") ? partner.optString("color", null) : null;

        JSONObject together = json.optJSONObject("together");
        togetherDays = together != null ? together.optInt("days", 0) : 0;
        togetherLabel = together != null ? together.optString("label", "") : "";

        JSONObject streak = json.optJSONObject("streak");
        streakEnabled = streak == null || streak.optBoolean("enabled", true);
        streakCurrent = streak != null ? streak.optInt("current", 0) : 0;
        streakLabel = streak != null ? streak.optString("label", "") : "";

        JSONObject waiting = json.optJSONObject("waiting");
        waitingLetters = waiting != null ? waiting.optInt("letters", 0) : 0;
        waitingTasks = waiting != null ? waiting.optInt("tasks", 0) : 0;
    }

    public static WidgetSnapshot parse(String raw) {
        if (raw == null) return null;
        try {
            return new WidgetSnapshot(new JSONObject(raw));
        } catch (Exception e) {
            return null;
        }
    }
}
