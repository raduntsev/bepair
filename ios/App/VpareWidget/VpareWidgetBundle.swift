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
        TasksWidget()
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

/// «Дела»: what your partner asked of you today; on iOS 17+ the circle ticks it off right here.
struct TasksWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "VpareTasks", provider: TasksProvider()) { entry in
            TasksWidgetView(entry: entry)
        }
        .configurationDisplayName("Дела")
        .description("Что партнёр попросил сделать сегодня — отмечайте прямо отсюда.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct TasksWidgetView: View {
    let entry: TasksEntry
    @Environment(\.colorScheme) private var scheme
    @Environment(\.widgetFamily) private var family

    var body: some View {
        let palette = Palette.of(scheme)
        let payload: TasksPayload? = { if case .ready(let p) = entry.state { return p } else { return nil } }()
        let rows = family == .systemLarge ? 7 : 3

        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text(payload?.title ?? "Дела на сегодня")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(palette.ink)
                    .lineLimit(1)
                Spacer(minLength: 8)
                if let left = payload?.left, !left.isEmpty {
                    Text(left)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(palette.accent)
                        .lineLimit(1)
                }
            }

            if let payload = payload, !payload.items.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(payload.items.prefix(rows)) { item in
                        TaskRow(item: item, palette: palette)
                    }
                }
                .padding(.top, 8)
                Spacer(minLength: 0)
            } else {
                Spacer(minLength: 4)
                Text(message(payload))
                    .font(.system(size: 14))
                    .foregroundColor(palette.inkFaint)
                    .lineLimit(3)
                Spacer(minLength: 4)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetBackground(palette.background)
        .widgetURL(URL(string: "vpare://day"))
    }

    private func message(_ payload: TasksPayload?) -> String {
        switch entry.state {
        case .setup: return "Откройте Впаре"
        case .loading: return "Загружаем дела…"
        case .ready: return payload?.empty ?? ""
        }
    }
}

private struct TaskRow: View {
    let item: TasksPayload.Item
    let palette: Palette

    var body: some View {
        if item.done {
            content
        } else if #available(iOSApplicationExtension 17.0, *) {
            Button(intent: CompleteTaskIntent(taskId: item.id)) { content }
                .buttonStyle(.plain)
        } else {
            content
        }
    }

    private var content: some View {
        HStack(spacing: 12) {
            ZStack {
                if item.done {
                    Circle().fill(palette.accent)
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(palette.accentInk)
                } else {
                    Circle().strokeBorder(palette.inkFaint.opacity(0.55), lineWidth: 2)
                }
            }
            .frame(width: 22, height: 22)

            Text(item.content)
                .font(.system(size: 15))
                .foregroundColor(item.done ? palette.inkFaint : palette.ink)
                .strikethrough(item.done, color: palette.inkFaint)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .frame(minHeight: 30)
        .contentShape(Rectangle())
    }
}
