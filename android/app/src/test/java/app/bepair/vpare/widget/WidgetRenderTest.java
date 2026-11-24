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
import android.widget.ViewFlipper;

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
@Config(sdk = 35, qualifiers = "ru-xxhdpi")
public class WidgetRenderTest {

    private static final String SEALED =
        "{\"v\":1,\"date\":\"2026-10-29\",\"dateLabel\":\"Чт, 29 октября\",\"headline\":\"Аня отметила день\",\"sub\":\"Отметьте свой — и он откроется\","
            + "\"me\":{\"name\":\"Алекс\",\"marked\":false,\"color\":null,\"label\":null},"
            + "\"partner\":{\"name\":\"Аня\",\"marked\":true,\"unlocked\":false,\"color\":null,\"label\":null},"
            + "\"together\":{\"days\":497,\"label\":\"дней вместе\"},\"streak\":{\"enabled\":true,\"current\":0,\"best\":11,\"label\":\"серия впереди\"},"
            + "\"waiting\":{\"letters\":1,\"tasks\":2},\"hideMood\":false,\"updatedAt\":\"2026-10-29T12:00:00Z\"}";

    private static final String OPEN =
        "{\"v\":1,\"date\":\"2026-10-29\",\"dateLabel\":\"Чт, 29 октября\",\"headline\":\"Аня: день спокойный\",\"sub\":\"Ваш: непростой\","
            + "\"me\":{\"name\":\"Алекс\",\"marked\":true,\"color\":\"#e48b39\",\"label\":\"непростой\",\"level\":\"heavy\"},"
            + "\"partner\":{\"name\":\"Аня\",\"marked\":true,\"unlocked\":true,\"color\":\"#9ab64e\",\"label\":\"спокойный\",\"level\":\"light\"},"
            + "\"together\":{\"days\":497,\"label\":\"дней вместе\"},\"streak\":{\"enabled\":true,\"current\":12,\"best\":12,\"label\":\"дней подряд\"},"
            + "\"waiting\":{\"letters\":0,\"tasks\":0},\"hideMood\":false,\"updatedAt\":\"2026-10-29T12:00:00Z\"}";

    private static final String WAITING =
        "{\"v\":1,\"date\":\"2026-10-29\",\"dateLabel\":\"Чт, 29 октября\",\"headline\":\"Аня ещё не отметила день\",\"sub\":\"Ваш день: лёгкий\","
            + "\"me\":{\"name\":\"Алекс\",\"marked\":true,\"color\":\"#4fab67\",\"label\":\"лёгкий\",\"level\":\"light\"},"
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
        assertEquals(View.GONE, couple.findViewById(R.id.widget_together).getVisibility());
        assertEquals("Письмо ждёт, просьб: 2", text(couple, R.id.widget_waiting));
        assertEquals(View.GONE, couple.findViewById(R.id.widget_action_day).getVisibility());
        assertEquals(View.VISIBLE, couple.findViewById(R.id.widget_action_ping).getVisibility());
        preview(couple, true, "couple-sealed");
    }

    @Test
    public void openDayShowsBothDays() {
        use(OPEN);
        View couple = inflate(true);
        assertEquals("Аня: день спокойный", text(couple, R.id.widget_headline));
        assertEquals("12", text(couple, R.id.widget_streak_days));
        assertEquals(View.GONE, couple.findViewById(R.id.widget_waiting).getVisibility());
        preview(inflate(false), false, "day-open");
        preview(couple, true, "couple-open");
    }

    @Test
    public void streakOffHidesItsBlock() {
        use(WAITING);
        View couple = inflate(true);
        assertEquals(View.GONE, couple.findViewById(R.id.widget_together).getVisibility());
        assertEquals(View.GONE, couple.findViewById(R.id.widget_streak).getVisibility());
        preview(couple, true, "couple-waiting");
    }

    @Test
    public void charactersActOutTheDay() {
        WidgetSnapshot sealed = WidgetSnapshot.parse(SEALED);
        assertEquals(PairCharacters.Pose.ASLEEP, PairCharacters.mePose(sealed));
        assertEquals(PairCharacters.Pose.SEALED, PairCharacters.partnerPose(sealed));
        assertNull("a sealed partner's level must not reach the widget", sealed.partnerLevel);

        WidgetSnapshot open = WidgetSnapshot.parse(OPEN);
        assertEquals(PairCharacters.Pose.HEAVY, PairCharacters.mePose(open));
        assertEquals(PairCharacters.Pose.LIGHT, PairCharacters.partnerPose(open));

        WidgetSnapshot waiting = WidgetSnapshot.parse(WAITING);
        assertEquals(PairCharacters.Pose.LIGHT, PairCharacters.mePose(waiting));
        assertEquals(PairCharacters.Pose.ASLEEP, PairCharacters.partnerPose(waiting));
        assertEquals(PairCharacters.Pose.ABSENT, PairCharacters.partnerPose(null));

        /* The launcher gets the whole strip of frames in a flipper. */
        use(OPEN);
        View day = inflate(false);
        ViewFlipper flipper = day.findViewById(R.id.widget_mark);
        assertNotNull(flipper);
        assertEquals(PairCharacters.FRAMES, flipper.getChildCount());
        strip("frames-open", OPEN);
        strip("frames-sealed", SEALED);
        strip("frames-waiting", WAITING);
    }

    /* All frames of the characters side by side, so the motion can be checked by eye. */
    private void strip(String name, String json) {
        String dir = System.getProperty("widget.previews");
        if (dir == null) return;
        WidgetSnapshot s = WidgetSnapshot.parse(json);
        float density = context().getResources().getDisplayMetrics().density;
        int w = Math.round(84 * density);
        int h = Math.round(42 * density);
        Bitmap bitmap = Bitmap.createBitmap(w * PairCharacters.FRAMES, h, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(0xFFFFFFFF);
        for (int f = 0; f < PairCharacters.FRAMES; f++) {
            canvas.drawBitmap(PairCharacters.draw(context(), s, f, 84), f * w, 0, null);
        }
        new File(dir).mkdirs();
        try (FileOutputStream out = new FileOutputStream(new File(dir, name + ".png"))) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    public void darkTheme() {
        RuntimeEnvironment.setQualifiers("+night");
        use(SEALED);
        preview(inflate(false), false, "dark-day-sealed");
        use(OPEN);
        preview(inflate(true), true, "dark-couple-open");
    }

    private static final String TASKS =
        "{\"v\":1,\"title\":\"Дела на сегодня\",\"empty\":\"Аня пока ни о чём не просит\",\"left\":\"осталось 2\",\"open\":2,"
            + "\"items\":[{\"id\":\"00000000-0000-0000-0000-000000000001\",\"content\":\"Приготовить ужин\",\"points\":3,\"done\":false},"
            + "{\"id\":\"00000000-0000-0000-0000-000000000002\",\"content\":\"Забрать заказ\",\"points\":2,\"done\":false},"
            + "{\"id\":\"00000000-0000-0000-0000-000000000003\",\"content\":\"Разобрать посуду\",\"points\":2,\"done\":true}],"
            + "\"updatedAt\":\"2026-10-29T12:00:00Z\"}";

    private View inflateTasks() {
        Context context = context();
        return TasksRenderer.render(context).apply(context, new FrameLayout(context));
    }

    @Test
    public void tasksListOpenThenDone() {
        use(null);
        TasksStore.clear(context());
        TasksStore.save(context(), TASKS);
        View tasks = inflateTasks();
        assertEquals("Дела на сегодня", text(tasks, R.id.tasks_title));
        assertEquals("осталось 2", text(tasks, R.id.tasks_left));
        assertEquals(View.VISIBLE, tasks.findViewById(R.id.task_row_0).getVisibility());
        assertEquals("Приготовить ужин", text(tasks, R.id.task_text_0));
        assertEquals(View.VISIBLE, tasks.findViewById(R.id.task_done_2).getVisibility());
        assertEquals(View.GONE, tasks.findViewById(R.id.task_row_3).getVisibility());
        preview(tasks, true, "tasks");

        /* A tap shows as done at once and the count follows, before the server answers. */
        TasksStore.addPending(context(), "00000000-0000-0000-0000-000000000001");
        View ticked = inflateTasks();
        assertEquals(View.VISIBLE, ticked.findViewById(R.id.task_done_0).getVisibility());
        assertEquals("осталось 1", text(ticked, R.id.tasks_left));
        preview(ticked, true, "tasks-ticked");
        TasksStore.clear(context());
    }

    @Test
    public void tasksEmptySaysSo() {
        use(null);
        TasksStore.clear(context());
        TasksStore.save(context(), TASKS.replaceAll("\\[.*\\]", "[]"));
        View tasks = inflateTasks();
        assertEquals(View.VISIBLE, tasks.findViewById(R.id.tasks_empty).getVisibility());
        assertEquals("Аня пока ни о чём не просит", text(tasks, R.id.tasks_empty));
        TasksStore.clear(context());
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
