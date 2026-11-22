import SwiftUI
import UIKit
import WidgetKit

@main
struct VpareWidgetBundle: WidgetBundle {
    var body: some Widget {
        DayWidget()
        CoupleWidget()
        StreakWidget()
        PhotoWidget()
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

/// «Фото»: the couple's album, one photo at a time, edge to edge.
struct PhotoWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "VparePhoto", provider: PhotoProvider()) { entry in
            PhotoWidgetView(entry: entry)
        }
        .configurationDisplayName("Фото")
        .description("Ваши общие фото — по одному, сменяются каждые три часа.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        .edgeToEdge()
    }
}

extension WidgetConfiguration {
    /// The photo reaches the widget's edges on iOS 17+, where widgets get margins by default.
    func edgeToEdge() -> some WidgetConfiguration {
        if #available(iOSApplicationExtension 17.0, *) {
            return self.contentMarginsDisabled()
        } else {
            return self
        }
    }
}

struct PhotoWidgetView: View {
    let entry: PhotoEntry
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        switch entry.state {
        case .ready(let image):
            Color.clear
                .photoBackground(image)
                .widgetURL(URL(string: "vpare://album"))
        default:
            let palette = Palette.of(scheme)
            VStack(spacing: 10) {
                PairMark(snapshot: nil, palette: palette)
                    .frame(width: 64, height: 36)
                Text(message)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(palette.ink)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .widgetBackground(palette.background)
            .widgetURL(URL(string: "vpare://album"))
        }
    }

    private var message: String {
        switch entry.state {
        case .setup: return "Откройте Впаре"
        case .empty: return "Добавьте общие фото в приложении"
        default: return "Загружаем фото…"
        }
    }
}

extension View {
    @ViewBuilder
    func photoBackground(_ image: UIImage) -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(for: .widget) {
                Image(uiImage: image).resizable().scaledToFill()
            }
        } else {
            frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Image(uiImage: image).resizable().scaledToFill())
                .clipped()
        }
    }
}
