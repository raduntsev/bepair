import AppIntents
import Foundation
import UIKit
import WidgetKit

/// The server's snapshot (src/lib/widgetSnapshot.ts). Every sentence arrives
/// ready-made, so the widget never decides grammar or what is still sealed.
struct Snapshot: Codable, Equatable {
    struct Me: Codable, Equatable {
        let name: String
        let marked: Bool
        let color: String?
        let label: String?
        /// light / normal / heavy — the pose of the character; nil while unmarked or hidden.
        var level: String? = nil
    }

    struct Partner: Codable, Equatable {
        let name: String
        let marked: Bool
        let unlocked: Bool
        let color: String?
        let label: String?
        /// Only ever sent once the partner's day is open to you.
        var level: String? = nil
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
        headline: "Аня отметила день",
        sub: "Вы оба отметились",
        me: Me(name: "Алекс", marked: true, color: "#e48b39", label: "оранжевый", level: "heavy"),
        partner: Partner(name: "Аня", marked: true, unlocked: true, color: "#9ab64e", label: "салатовый", level: "light"),
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

// MARK: - «Фото»

/// The photo the «Фото» widget shows: one JPEG in the App Group container plus
/// the server's ETag (the photo's id), so an unchanged album downloads nothing.
enum PhotoStore {
    private static var defaults: UserDefaults? { UserDefaults(suiteName: WidgetStore.appGroup) }
    private static var fileURL: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: WidgetStore.appGroup)?
            .appendingPathComponent("widget_photo.jpg")
    }

    static var etag: String? { defaults?.string(forKey: "photo_etag") }
    static var isEmpty: Bool { defaults?.bool(forKey: "photo_empty") ?? false }

    /// Widgets have a tight memory budget: the photo is drawn at most 900 px on its long side.
    static func image() -> UIImage? {
        guard let url = fileURL, let data = try? Data(contentsOf: url), let image = UIImage(data: data) else { return nil }
        let longSide = max(image.size.width, image.size.height)
        guard longSide > 900 else { return image }
        let scale = 900 / longSide
        return image.preparingThumbnail(of: CGSize(width: image.size.width * scale, height: image.size.height * scale)) ?? image
    }

    static func save(_ data: Data, etag: String?) {
        guard let url = fileURL else { return }
        try? data.write(to: url, options: .atomic)
        defaults?.set(etag, forKey: "photo_etag")
        defaults?.set(false, forKey: "photo_empty")
    }

    static func markEmpty() {
        if let url = fileURL { try? FileManager.default.removeItem(at: url) }
        defaults?.removeObject(forKey: "photo_etag")
        defaults?.set(true, forKey: "photo_empty")
    }

    /// Signed out or revoked: nothing private stays on the device.
    static func clear() {
        if let url = fileURL { try? FileManager.default.removeItem(at: url) }
        defaults?.removeObject(forKey: "photo_etag")
        defaults?.removeObject(forKey: "photo_empty")
    }
}

enum PhotoState {
    case setup
    case loading
    case empty
    case ready(UIImage)
}

struct PhotoEntry: TimelineEntry {
    let date: Date
    let state: PhotoState
}

enum PhotoAPI {
    /// GET {api}/api/widget/photo. 304 — keep the stored photo; 204 — the album is empty.
    static func fetch() async -> PhotoState {
        guard let token = WidgetStore.token, let api = WidgetStore.api, let url = URL(string: api + "/api/widget/photo") else {
            return .setup
        }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let etag = PhotoStore.etag, PhotoStore.image() != nil {
            request.setValue(etag, forHTTPHeaderField: "If-None-Match")
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let http = response as? HTTPURLResponse
            switch http?.statusCode ?? 0 {
            case 401:
                WidgetStore.clear()
                PhotoStore.clear()
                return .setup
            case 204:
                PhotoStore.markEmpty()
                return .empty
            case 200 where !data.isEmpty:
                PhotoStore.save(data, etag: http?.value(forHTTPHeaderField: "ETag"))
            default:
                break
            }
        } catch {
            // offline: fall back to the stored photo below
        }
        if let image = PhotoStore.image() { return .ready(image) }
        return PhotoStore.isEmpty ? .empty : .loading
    }
}

struct PhotoProvider: TimelineProvider {
    func placeholder(in context: Context) -> PhotoEntry {
        PhotoEntry(date: Date(), state: .loading)
    }

    func getSnapshot(in context: Context, completion: @escaping (PhotoEntry) -> Void) {
        if let image = PhotoStore.image() {
            completion(PhotoEntry(date: Date(), state: .ready(image)))
        } else {
            completion(PhotoEntry(date: Date(), state: WidgetStore.isConfigured ? (PhotoStore.isEmpty ? .empty : .loading) : .setup))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PhotoEntry>) -> Void) {
        Task {
            let state = await PhotoAPI.fetch()
            // The album turns over every three hours by the clock; look again just after the next turn.
            let period: TimeInterval = 3 * 60 * 60
            let now = Date()
            let next = Date(timeIntervalSince1970: (now.timeIntervalSince1970 / period).rounded(.up) * period + 60)
            completion(Timeline(entries: [PhotoEntry(date: now, state: state)], policy: .after(next)))
        }
    }
}

// MARK: - «Дела»

/// What the partner asked of you (src/app/api/widget/tasks/route.ts): open
/// requests first, then those done today. Wording arrives ready-made.
struct TasksPayload: Codable, Equatable {
    struct Item: Codable, Equatable, Identifiable {
        let id: String
        let content: String
        let points: Int
        let done: Bool
    }

    let title: String
    let empty: String
    let left: String
    let open: Int
    let items: [Item]

    static let sample = TasksPayload(
        title: "Дела на сегодня",
        empty: "",
        left: "осталось 2",
        open: 2,
        items: [
            Item(id: "1", content: "Приготовить ужин", points: 3, done: false),
            Item(id: "2", content: "Забрать заказ", points: 2, done: false),
            Item(id: "3", content: "Разобрать посуду", points: 2, done: true),
        ]
    )
}

enum TasksStore {
    private static var defaults: UserDefaults? { UserDefaults(suiteName: WidgetStore.appGroup) }

    static var cached: TasksPayload? {
        guard let data = defaults?.data(forKey: "tasks") else { return nil }
        return try? JSONDecoder().decode(TasksPayload.self, from: data)
    }

    static func save(_ data: Data) {
        defaults?.set(data, forKey: "tasks")
    }

    static func clear() {
        defaults?.removeObject(forKey: "tasks")
    }
}

enum TasksState: Equatable {
    case setup
    case loading
    case ready(TasksPayload)
}

struct TasksEntry: TimelineEntry {
    let date: Date
    let state: TasksState
}

enum TasksAPI {
    /// GET {api}/api/widget/tasks — or, with an id, POST to tick that request off.
    static func fetch(completing id: String? = nil) async -> TasksState {
        guard let token = WidgetStore.token, let api = WidgetStore.api, let url = URL(string: api + "/api/widget/tasks") else {
            return .setup
        }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let id = id {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try? JSONEncoder().encode(["id": id])
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if status == 401 {
                WidgetStore.clear()
                TasksStore.clear()
                return .setup
            }
            if status == 200, let payload = try? JSONDecoder().decode(TasksPayload.self, from: data) {
                TasksStore.save(data)
                return .ready(payload)
            }
            // Gone or not yours: the fresh list puts the row right.
            if id != nil, status == 404 || status == 400 { return await fetch() }
        } catch {
            // offline: fall back to the last good list below
        }
        if let cached = TasksStore.cached { return .ready(cached) }
        return .loading
    }
}

/// The circle in a «Дела» row. Runs in the widget's process; WidgetKit redraws
/// the widget when it returns, already with the server's fresh list.
@available(iOS 17.0, *)
struct CompleteTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Отметить дело"
    static var isDiscoverable: Bool = false

    @Parameter(title: "Дело")
    var taskId: String

    init() {}

    init(taskId: String) {
        self.taskId = taskId
    }

    func perform() async throws -> some IntentResult {
        _ = await TasksAPI.fetch(completing: taskId)
        // The day widgets count open requests too.
        WidgetCenter.shared.reloadTimelines(ofKind: "VpareCouple")
        return .result()
    }
}

struct TasksProvider: TimelineProvider {
    func placeholder(in context: Context) -> TasksEntry {
        TasksEntry(date: Date(), state: .ready(.sample))
    }

    func getSnapshot(in context: Context, completion: @escaping (TasksEntry) -> Void) {
        if context.isPreview {
            completion(TasksEntry(date: Date(), state: .ready(.sample)))
        } else if let cached = TasksStore.cached {
            completion(TasksEntry(date: Date(), state: .ready(cached)))
        } else {
            completion(TasksEntry(date: Date(), state: WidgetStore.isConfigured ? .loading : .setup))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TasksEntry>) -> Void) {
        Task {
            let state = await TasksAPI.fetch()
            let now = Date()
            // Every 15 minutes, and right after midnight when «сегодня» starts over.
            let soon = now.addingTimeInterval(15 * 60)
            let midnight = Calendar.current.nextDate(after: now, matching: DateComponents(hour: 0, minute: 1), matchingPolicy: .nextTime) ?? soon
            completion(Timeline(entries: [TasksEntry(date: now, state: state)], policy: .after(min(soon, midnight))))
        }
    }
}
