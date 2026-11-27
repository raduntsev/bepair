package app.bepair.vpare.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.test.core.app.ApplicationProvider;

import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

import java.io.File;
import java.io.FileOutputStream;

import app.bepair.vpare.R;

/**
 * The «Карта» widget in the states that matter, and the tile math that keeps
 * both pins inside whatever the launcher crops. With -Dwidget.previews set it
 * also draws a real map (OpenStreetMap tiles over the network) into PNG previews.
 */
@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = 35, qualifiers = "ru-xxhdpi")
public class MapWidgetTest {

    private static final String OFF =
        "{\"v\":1,\"state\":\"off\",\"sharing\":false,\"title\":\"Где мы\",\"line\":\"Аня делится местоположением — включите своё, чтобы видеть друг друга\","
            + "\"me\":null,\"partner\":null,\"updatedAt\":\"2026-11-24T12:00:00Z\"}";

    private static final String OK =
        "{\"v\":1,\"state\":\"ok\",\"sharing\":true,\"title\":\"Аня\",\"line\":\"3,1 км от вас · 4 мин назад\","
            + "\"me\":{\"lat\":55.7558,\"lng\":37.6173,\"initial\":\"А\",\"stale\":false},"
            + "\"partner\":{\"lat\":55.7339,\"lng\":37.5886,\"initial\":\"А\",\"stale\":false},\"updatedAt\":\"2026-11-24T12:00:00Z\"}";

    private static final String TOGETHER =
        "{\"v\":1,\"state\":\"ok\",\"sharing\":true,\"title\":\"Аня\",\"line\":\"Вы рядом · только что\","
            + "\"me\":{\"lat\":59.9343,\"lng\":30.3351,\"initial\":\"А\",\"stale\":false},"
            + "\"partner\":{\"lat\":59.9345,\"lng\":30.3355,\"initial\":\"А\",\"stale\":false},\"updatedAt\":\"2026-11-24T12:00:00Z\"}";

    private Context context() {
        return ApplicationProvider.getApplicationContext();
    }

    private View inflate() {
        Context context = context();
        return MapRenderer.render(context).apply(context, new FrameLayout(context));
    }

    private String text(View root, int id) {
        return ((TextView) root.findViewById(id)).getText().toString();
    }

    private void use(String payload) {
        WidgetStore.configure(context(), "test-token", "https://vpare.example");
        LocationStore.clear(context());
        if (payload != null) LocationStore.savePayload(context(), payload);
    }

    @After
    public void tearDown() {
        LocationStore.clear(context());
        WidgetStore.clear(context());
    }

    @Test
    public void notConfiguredAsksToOpenTheApp() {
        WidgetStore.clear(context());
        View map = inflate();
        assertEquals(View.VISIBLE, map.findViewById(R.id.widget_map_empty).getVisibility());
        assertEquals(View.GONE, map.findViewById(R.id.widget_map_image).getVisibility());
        assertEquals("Откройте Впаре", text(map, R.id.widget_map_empty_text));
        preview(map, "map-setup");
    }

    @Test
    public void notSharingShowsNoMapAndSaysWhy() {
        use(OFF);
        View map = inflate();
        assertEquals(View.VISIBLE, map.findViewById(R.id.widget_map_empty).getVisibility());
        assertEquals(View.GONE, map.findViewById(R.id.widget_map_caption).getVisibility());
        assertEquals("Где мы", text(map, R.id.widget_map_empty_title));
        assertTrue(text(map, R.id.widget_map_empty_text).startsWith("Аня делится"));
        preview(map, "map-off");
    }

    @Test
    public void bothSharingShowsTheMapAndOneLine() {
        use(OK);
        MapRenderer.compose(context());
        assertTrue(LocationStore.mapFile(context()).isFile());

        View map = inflate();
        assertEquals(View.VISIBLE, map.findViewById(R.id.widget_map_image).getVisibility());
        assertEquals(View.VISIBLE, map.findViewById(R.id.widget_map_attribution).getVisibility());
        assertEquals(View.GONE, map.findViewById(R.id.widget_map_empty).getVisibility());
        assertEquals("Аня", text(map, R.id.widget_map_title));
        assertEquals("3,1 км от вас · 4 мин назад", text(map, R.id.widget_map_line));
        preview(map, "map-ok");
    }

    @Test
    public void togetherDrawsTwoPinsSideBySide() {
        use(TOGETHER);
        MapRenderer.compose(context());
        View map = inflate();
        assertEquals("Вы рядом · только что", text(map, R.id.widget_map_line));
        preview(map, "map-together");
    }

    @Test
    @Config(qualifiers = "ru-night-xxhdpi")
    public void darkTheme() {
        use(OK);
        assertTrue(MapTiles.dark(context()));
        MapRenderer.compose(context());
        preview(inflate(), "dark-map-ok");
    }

    @Test
    public void signOutForgetsThePoints() {
        use(OK);
        MapRenderer.compose(context());
        LocationStore.setSharing(context(), true);
        LocationStore.clear(context());
        assertFalse(LocationStore.mapFile(context()).isFile());
        assertNull(LocationStore.payload(context()));
        assertFalse(LocationStore.sharing(context()));
    }

    @Test
    public void payloadParses() {
        MapPayload p = MapPayload.parse(OK);
        assertNotNull(p);
        assertTrue(p.sharing);
        assertTrue(p.hasMap());
        assertEquals("А", p.partner.initial);
        MapPayload off = MapPayload.parse(OFF);
        assertNotNull(off);
        assertFalse(off.hasMap());
        assertNull(MapPayload.parse("{\"v\":2}"));
        assertNull(MapPayload.parse("not json"));
    }

    @Test
    public void zoomKeepsBothPinsInsideEveryCrop() {
        MapPayload p = MapPayload.parse(OK);
        int z = MapTiles.zoomFor(p.me, p.partner);
        assertTrue(z >= MapTiles.MIN_ZOOM && z <= MapTiles.MAX_ZOOM);
        double dx = Math.abs(MapTiles.worldX(p.me.lng, z) - MapTiles.worldX(p.partner.lng, z));
        double dy = Math.abs(MapTiles.worldY(p.me.lat, z) - MapTiles.worldY(p.partner.lat, z));
        assertTrue(dx <= MapTiles.FIT_W && dy <= MapTiles.FIT_H);
        /* One zoom closer would no longer fit: the map is as close as it can be. */
        if (z < MapTiles.MAX_ZOOM) {
            double dx2 = Math.abs(MapTiles.worldX(p.me.lng, z + 1) - MapTiles.worldX(p.partner.lng, z + 1));
            double dy2 = Math.abs(MapTiles.worldY(p.me.lat, z + 1) - MapTiles.worldY(p.partner.lat, z + 1));
            assertTrue(dx2 > MapTiles.FIT_W || dy2 > MapTiles.FIT_H);
        }
        /* Moscow and Vladivostok still fit, far out. */
        MapPayload far = MapPayload.parse(OK.replace("55.7339", "43.1155").replace("37.5886", "131.8855"));
        assertTrue(MapTiles.zoomFor(far.me, far.partner) <= 4);
        /* One point alone: a street-level view. */
        assertEquals(MapTiles.SINGLE_ZOOM, MapTiles.zoomFor(p.me, null));
    }

    @Test
    public void partnerPhotoParses() {
        MapPayload plain = MapPayload.parse(OK);
        assertFalse(plain.partner.hasPhoto());
        MapPayload withPhoto = MapPayload.parse(OK.replace(
            "\"partner\":{\"lat\":55.7339,\"lng\":37.5886,\"initial\":\"А\",\"stale\":false}",
            "\"partner\":{\"lat\":55.7339,\"lng\":37.5886,\"initial\":\"А\",\"stale\":false,"
                + "\"photo\":\"https://example.com/a.jpg?token=1\",\"photoKey\":\"space/avatars/a.jpg\"}"));
        assertTrue(withPhoto.partner.hasPhoto());
        assertEquals("space/avatars/a.jpg", withPhoto.partner.photoKey);
        /* A new photo is a new picture; a re-signed URL for the same photo is not. */
        assertFalse(MapTiles.key(withPhoto, false, true).equals(MapTiles.key(plain, false, false)));
        MapPayload resigned = MapPayload.parse(OK.replace(
            "\"partner\":{\"lat\":55.7339,\"lng\":37.5886,\"initial\":\"А\",\"stale\":false}",
            "\"partner\":{\"lat\":55.7339,\"lng\":37.5886,\"initial\":\"А\",\"stale\":false,"
                + "\"photo\":\"https://example.com/a.jpg?token=2\",\"photoKey\":\"space/avatars/a.jpg\"}"));
        assertEquals(MapTiles.key(withPhoto, false, true), MapTiles.key(resigned, false, true));
    }

    @Test
    public void onlyThePartnerMakesAMap() {
        assertFalse(MapPayload.parse(OK.replace(
            "\"partner\":{\"lat\":55.7339,\"lng\":37.5886,\"initial\":\"А\",\"stale\":false}", "\"partner\":null")).hasMap());
    }

    @Test
    public void sameMapIsNotDrawnTwice() {
        MapPayload p = MapPayload.parse(OK);
        assertEquals(MapTiles.key(p, false), MapTiles.key(MapPayload.parse(OK), false));
        assertFalse(MapTiles.key(p, false).equals(MapTiles.key(p, true)));
        assertFalse(MapTiles.key(p, false).equals(MapTiles.key(MapPayload.parse(TOGETHER), false)));
    }

    /* A 4×2 widget on a wallpaper-ish backdrop, and a 2×2 one to check the crop. */
    private void preview(View view, String name) {
        draw(view, name, 340, 165);
        draw(view, name + "-square", 165, 165);
    }

    private void draw(View view, String name, int widthDp, int heightDp) {
        String dir = System.getProperty("widget.previews");
        float density = context().getResources().getDisplayMetrics().density;
        int width = Math.round(widthDp * density);
        int height = Math.round(heightDp * density);
        view.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
        view.layout(0, 0, width, height);
        if (dir == null) return;

        int pad = Math.round(16 * density);
        Bitmap bitmap = Bitmap.createBitmap(width + pad * 2, height + pad * 2, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(name.startsWith("dark") ? 0xFF22223A : 0xFF8FA3C8);
        canvas.translate(pad, pad);
        view.draw(canvas);
        new File(dir).mkdirs();
        try (FileOutputStream out = new FileOutputStream(new File(dir, name + ".png"))) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
