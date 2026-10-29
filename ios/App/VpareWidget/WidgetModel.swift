import Foundation
import WidgetKit

/// The server's snapshot (src/lib/widgetSnapshot.ts). Every sentence arrives
/// ready-made, so the widget never decides grammar or what is still sealed.
struct Snapshot: Codable, Equatable {
    struct Me: Codable, Equatable {
        let name: String
        let marked: Bool
        let color: String?
        let label: String?
    }

    struct Partner: Codable, Equatable {
        let name: String
        let marked: Bool
        let unlocked: Bool
        let color: String?
        let label: String?
    }

    struct Together: Codable, Equatable {
        let days: Int
        let label: String
    }

    struct Streak: Codable, Equatable {
        let enabled: Bool
        let current: Int
        let best: Int
        let label: String
    }

    struct Waiting: Codable, Equatable {
        let letters: Int
        let tasks: Int
    }

    let date: String
    let dateLabel: String
    let headline: String
    let sub: String
    let me: Me
    let partner: Partner?
    let together: Together?
    let streak: Streak
    let waiting: Waiting
    let hideMood: Bool

    var waitingLine: String? {
        var parts: [String] = []
        if waiting.letters == 1 { parts.append("Письмо ждёт") } else if waiting.letters > 1 { parts.append("Писем: \(waiting.letters)") }
        if waiting.tasks == 1 { parts.append("1 просьба") } else if waiting.tasks > 1 { parts.append("просьб: \(waiting.tasks)") }
        return parts.isEmpty ? nil : parts.joined(separator: ", ")
    }

    static let sample = Snapshot(
        date: "2026-10-29",
        dateLabel: "Чт, 29 октября",
        headline: "Аня: день спокойный",
        sub: "Ваш: непростой",
        me: Me(name: "Алекс", marked: true, color: "#e48b39", label: "непростой"),
        partner: Partner(name: "Аня", marked: true, unlocked: true, color: "#9ab64e", label: "спокойный"),
        together: Together(days: 497, label: "дней вместе"),
        streak: Streak(enabled: true, current: 12, best: 12, label: "дней подряд"),
        waiting: Waiting(letters: 0, tasks: 0),
        hideMood: false
    )
}

/// Shared with the app through the App Group (see WidgetBridgePlugin.swift).
enum WidgetStore {
    static let appGroup = "group.app.bepair.vpare"
    private static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

    static var token: String? { defaults?.string(forKey: "token") }
    static var api: String? { defaults?.string(forKey: "api") }
    static var isConfigured: Bool { token != nil && api != nil }

    static var cached: Snapshot? {
        guard let data = defaults?.data(forKey: "snapshot") else { return nil }
        return try? JSONDecoder().decode(Snapshot.self, from: data)
    }

    static func save(_ data: Data) {
        defaults?.set(data, forKey: "snapshot")
    }

    /// Revoked in settings or signed out: stop showing anything private.
    static func clear() {
        defaults?.removeObject(forKey: "token")
        defaults?.removeObject(forKey: "api")
        defaults?.removeObject(forKey: "snapshot")
    }
}

enum WidgetState: Equatable {
    case setup
    case loading
    case ready(Snapshot)
}

struct DayEntry: TimelineEntry {
    let date: Date
    let state: WidgetState
}

enum SnapshotAPI {
    /// GET {api}/api/widget with the widget's own read-only key.
    static func fetch() async -> WidgetState {
        guard let token = WidgetStore.token, let api = WidgetStore.api, let url = URL(string: api + "/api/widget") else {
            return .setup
        }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if status == 401 {
                WidgetStore.clear()
                return .setup
            }
            if status == 200, let snapshot = try? JSONDecoder().decode(Snapshot.self, from: data) {
                WidgetStore.save(data)
                return .ready(snapshot)
            }
        } catch {
            // offline: fall back to the last good snapshot below
        }
        if let cached = WidgetStore.cached { return .ready(cached) }
        return .loading
    }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> DayEntry {
        DayEntry(date: Date(), state: .ready(.sample))
    }

    func getSnapshot(in context: Context, completion: @escaping (DayEntry) -> Void) {
        if context.isPreview {
            completion(DayEntry(date: Date(), state: .ready(.sample)))
            return
        }
        if let cached = WidgetStore.cached {
            completion(DayEntry(date: Date(), state: .ready(cached)))
        } else {
            completion(DayEntry(date: Date(), state: WidgetStore.isConfigured ? .loading : .setup))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DayEntry>) -> Void) {
        Task {
            let state = await SnapshotAPI.fetch()
            let now = Date()
            // Every 20 minutes, and right after local midnight when «сегодня» changes.
            let soon = now.addingTimeInterval(20 * 60)
            let midnight = Calendar.current.nextDate(after: now, matching: DateComponents(hour: 0, minute: 1), matchingPolicy: .nextTime) ?? soon
            completion(Timeline(entries: [DayEntry(date: now, state: state)], policy: .after(min(soon, midnight))))
        }
    }
}
