import SwiftUI
import WidgetKit

@main
struct VpareWidgetBundle: WidgetBundle {
    var body: some Widget {
        DayWidget()
        CoupleWidget()
        StreakWidget()
    }
}

/// «День»: small on the home screen; one or two lines on the lock screen.
struct DayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "VpareDay", provider: Provider()) { entry in
            DayFamilyView(entry: entry)
        }
        .configurationDisplayName("День")
        .description("Ваш день и день партнёра — одним взглядом.")
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryInline])
    }
}

struct DayFamilyView: View {
    let entry: DayEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryRectangular:
            LockRectangularView(entry: entry)
        case .accessoryInline:
            LockInlineView(entry: entry)
        default:
            DayWidgetView(entry: entry)
        }
    }
}

/// «Пара»: today, days together, the run, and two quick actions.
struct CoupleWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "VpareCouple", provider: Provider()) { entry in
            CoupleWidgetView(entry: entry)
        }
        .configurationDisplayName("Пара")
        .description("День, дни вместе, серия и быстрые действия.")
        .supportedFamilies([.systemMedium])
    }
}

/// «Серия»: the run as a round lock-screen complication.
struct StreakWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "VpareStreak", provider: Provider()) { entry in
            LockStreakView(entry: entry)
        }
        .configurationDisplayName("Серия")
        .description("Сколько дней подряд вы оба отмечаетесь.")
        .supportedFamilies([.accessoryCircular])
    }
}
