package app.bepair.vpare.widget;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.RemoteViews;
import android.widget.TextView;

import androidx.test.core.app.ApplicationProvider;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

import java.io.File;
import java.io.FileOutputStream;

import app.bepair.vpare.R;

/**
 * Inflates the real RemoteViews the launcher receives, in every state that
 * matters, and checks the reciprocity rule holds on the home screen too.
 * With -Dwidget.previews set, it also writes PNG previews (light and dark).
 */
@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = 35, qualifiers = "xxhdpi")
public class WidgetRenderTest {

    private static final String SEALED =
        "{\"v\":1,\"date\":\"2026-10-29\",\"dateLabel\":\"Чт, 29 октября\",\"headline\":\"Аня отметила день\",\"sub\":\"Отметьте свой — и он откроется\","
            + "\"me\":{\"name\":\"Алекс\",\"marked\":false,\"color\":null,\"label\":null},"
            + "\"partner\":{\"name\":\"Аня\",\"marked\":true,\"unlocked\":false,\"color\":null,\"label\":null},"
            + "\"together\":{\"days\":497,\"label\":\"дней вместе\"},\"streak\":{\"enabled\":true,\"current\":0,\"best\":11,\"label\":\"серия впереди\"},"
            + "\"waiting\":{\"letters\":1,\"tasks\":2},\"hideMood\":false,\"updatedAt\":\"2026-10-29T12:00:00Z\"}";

    private static final String OPEN =
        "{\"v\":1,\"date\":\"2026-10-29\",\"dateLabel\":\"Чт, 29 октября\",\"headline\":\"Аня: день спокойный\",\"sub\":\"Ваш: непростой\","
            + "\"me\":{\"name\":\"Алекс\",\"marked\":true,\"color\":\"#e48b39\",\"label\":\"непростой\"},"
            + "\"partner\":{\"name\":\"Аня\",\"marked\":true,\"unlocked\":true,\"color\":\"#9ab64e\",\"label\":\"спокойный\"},"
            + "\"together\":{\"days\":497,\"label\":\"дней вместе\"},\"streak\":{\"enabled\":true,\"current\":12,\"best\":12,\"label\":\"дней подряд\"},"
            + "\"waiting\":{\"letters\":0,\"tasks\":0},\"hideMood\":false,\"updatedAt\":\"2026-10-29T12:00:00Z\"}";

    private static final String WAITING =
        "{\"v\":1,\"date\":\"2026-10-29\",\"dateLabel\":\"Чт, 29 октября\",\"headline\":\"Аня ещё не отметила день\",\"sub\":\"Ваш день: лёгкий\","
            + "\"me\":{\"name\":\"Алекс\",\"marked\":true,\"color\":\"#4fab67\",\"label\":\"лёгкий\"},"
            + "\"partner\":{\"name\":\"Аня\",\"marked\":false,\"unlocked\":true,\"color\":null,\"label\":null},"
            + "\"together\":null,\"streak\":{\"enabled\":false,\"current\":0,\"best\":3,\"label\":\"\"},"
            + "\"waiting\":{\"letters\":0,\"tasks\":1},\"hideMood\":false,\"updatedAt\":\"2026-10-29T12:00:00Z\"}";

    private Context context() {
        return ApplicationProvider.getApplicationContext();
    }

    private View inflate(boolean couple) {
        Context context = context();
        RemoteViews views = WidgetRenderer.render(context, couple);
        return views.apply(context, new FrameLayout(context));
    }

    private String text(View root, int id) {
        return ((TextView) root.findViewById(id)).getText().toString();
    }

    private void use(String snapshot) {
        WidgetStore.configure(context(), "test-token", "https://vpare.example");
        if (snapshot != null) WidgetStore.saveSnapshot(context(), snapshot);
    }

    @Test
    public void notConfiguredAsksToOpenTheApp() {
        WidgetStore.clear(context());
        View day = inflate(false);
        assertEquals("Откройте Впаре", text(day, R.id.widget_headline));
        preview(day, false, "day-setup");
    }

    @Test
    public void sealedPartnerShowsOnlyTheFact() {
        use(SEALED);
        WidgetSnapshot s = WidgetSnapshot.parse(SEALED);
        assertNotNull(s);
        assertNull("sealed partner colour must not reach the widget", s.partnerColor);

        View day = inflate(false);
        assertEquals("Аня отметила день", text(day, R.id.widget_headline));
        preview(day, false, "day-sealed");

        View couple = inflate(true);
        assertEquals("497", text(couple, R.id.widget_together_days));
        assertEquals("Письмо ждёт, просьб: 2", text(couple, R.id.widget_waiting));
        assertEquals("Отметить", text(couple, R.id.widget_action_day));
        preview(couple, true, "couple-sealed");
    }

    @Test
    public void openDayShowsBothColours() {
        use(OPEN);
        View couple = inflate(true);
        assertEquals("Аня: день спокойный", text(couple, R.id.widget_headline));
        assertEquals("12", text(couple, R.id.widget_streak_days));
        assertEquals("Мой день", text(couple, R.id.widget_action_day));
        assertEquals(View.GONE, couple.findViewById(R.id.widget_waiting).getVisibility());
        preview(inflate(false), false, "day-open");
        preview(couple, true, "couple-open");
    }

    @Test
    public void streakOffAndNoDateHideTheirBlocks() {
        use(WAITING);
        View couple = inflate(true);
        assertEquals(View.GONE, couple.findViewById(R.id.widget_together).getVisibility());
        assertEquals(View.GONE, couple.findViewById(R.id.widget_streak).getVisibility());
        preview(couple, true, "couple-waiting");
    }

    @Test
    public void darkTheme() {
        RuntimeEnvironment.setQualifiers("+night");
        use(SEALED);
        preview(inflate(false), false, "dark-day-sealed");
        use(OPEN);
        preview(inflate(true), true, "dark-couple-open");
    }

    /* Draws the inflated widget on a wallpaper-ish backdrop at launcher cell sizes. */
    private void preview(View view, boolean couple, String name) {
        String dir = System.getProperty("widget.previews");
        float density = context().getResources().getDisplayMetrics().density;
        int width = Math.round((couple ? 340 : 165) * density);
        int height = Math.round(165 * density);
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
