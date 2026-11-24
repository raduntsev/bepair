import SwiftUI
import WidgetKit

// MARK: - Palette (mirrors src/app/globals.css)

struct Palette {
    let background: Color
    let ink: Color
    let inkSoft: Color
    let inkFaint: Color
    let accent: Color
    let accentInk: Color
    let accentSoft: Color
    let accentSoftInk: Color
    let partner: Color
    let partnerInk: Color
    let partnerSoft: Color

    static func of(_ scheme: ColorScheme) -> Palette {
        scheme == .dark
            ? Palette(background: Color(hex: "#1a1a25"), ink: Color(hex: "#f0f0f6"), inkSoft: Color(hex: "#b3b3ca"), inkFaint: Color(hex: "#9595ae"),
                      accent: Color(hex: "#8b85ff"), accentInk: Color(hex: "#16162a"), accentSoft: Color(hex: "#262441"), accentSoftInk: Color(hex: "#c3bfff"),
                      partner: Color(hex: "#e8a552"), partnerInk: Color(hex: "#f0b56b"), partnerSoft: Color(hex: "#2e2417"))
            : Palette(background: .white, ink: Color(hex: "#1a1a28"), inkSoft: Color(hex: "#4b4b63"), inkFaint: Color(hex: "#68687f"),
                      accent: Color(hex: "#5b54e8"), accentInk: .white, accentSoft: Color(hex: "#edecfd"), accentSoftInk: Color(hex: "#3f38c4"),
                      partner: Color(hex: "#d98324"), partnerInk: Color(hex: "#94500f"), partnerSoft: Color(hex: "#fdf1e2"))
    }
}

extension Color {
    init(hex: String) {
        var value: UInt64 = 0
        Scanner(string: hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))).scanHexInt64(&value)
        self.init(
            .sRGB,
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255,
            opacity: 1
        )
    }
}

// MARK: - The pair, as two characters

/// The two round characters from the app's loader (src/components/PairLoader.tsx),
/// indigo for you and amber for your partner, each acting out its own day:
/// asleep (not marked), light (happy ^ ^, a little hop), normal (open eyes),
/// heavy (drooping eyes, sunk lower; the other leans towards it), sealed (the
/// partner's day you may not see yet: eyes shut, a lock), hidden (marked, mood
/// hidden on this phone) and absent (no partner yet). A visible day fills the
/// body with its colour and keeps a ring of the person's own colour.
///
/// The same drawing as android/…/PairCharacters.java, frame 0. A widget on iOS
/// cannot loop an animation; from iOS 17 the change between two states is
/// animated when the timeline moves on — the hop lands, the eyes open, the
/// character straightens up.
enum Pose: Equatable {
    case asleep, light, normal, heavy, sealed, hidden, absent

    static func me(_ s: Snapshot?) -> Pose {
        guard let me = s?.me, me.marked else { return .asleep }
        return level(me.level, color: me.color)
    }

    static func partner(_ s: Snapshot?) -> Pose {
        guard let p = s?.partner else { return .absent }
        if !p.marked { return .asleep }
        if !p.unlocked { return .sealed }
        return level(p.level, color: p.color)
    }

    private static func level(_ level: String?, color: String?) -> Pose {
        switch level {
        case "light": return .light
        case "heavy": return .heavy
        case "normal": return .normal
        default: return color != nil ? .normal : .hidden
        }
    }

    var showsMood: Bool { self == .light || self == .normal || self == .heavy }
}

struct PairMark: View {
    let snapshot: Snapshot?
    let palette: Palette

    var body: some View {
        let me = Pose.me(snapshot)
        let them = Pose.partner(snapshot)
        // The one who is fine leans towards the one having a heavy day.
        let meLean: CGFloat = them == .heavy && me != .heavy && me != .asleep ? 1 : 0
        let themLean: CGFloat = me == .heavy && ![Pose.heavy, .asleep, .absent, .sealed].contains(them) ? -1 : 0

        GeometryReader { geo in
            // The loader's 120×60 box.
            let u = min(geo.size.width / 120, geo.size.height / 60)
            ZStack(alignment: .topLeading) {
                PairCharacter(pose: me, facing: 1, own: palette.accent, mood: snapshot?.me.color, lean: meLean, outline: palette.inkFaint, u: u)
                    .position(x: 34 * u, y: 33 * u)
                PairCharacter(pose: them, facing: -1, own: palette.partner, mood: snapshot?.partner?.color, lean: themLean, outline: palette.inkFaint, u: u)
                    .position(x: 86 * u, y: 33 * u)
            }
            .animation(.spring(response: 0.6, dampingFraction: 0.6), value: me)
            .animation(.spring(response: 0.6, dampingFraction: 0.6), value: them)
        }
        .accessibilityHidden(true)
    }
}

private struct PairCharacter: View {
    let pose: Pose
    let facing: CGFloat
    let own: Color
    let mood: String?
    let lean: CGFloat
    let outline: Color
    let u: CGFloat

    var body: some View {
        let r: CGFloat = 17 * u
        let known = pose.showsMood && mood != nil
        let ink = known ? Color(hex: "#101018") : Color.white

        if pose == .absent {
            Circle()
                .stroke(outline, style: StrokeStyle(lineWidth: 2 * u, lineCap: .round, dash: [3.5 * u, 4.5 * u]))
                .frame(width: 2 * r - 2 * u, height: 2 * r - 2 * u)
        } else {
            ZStack {
                Circle()
                    .fill(known ? Color(hex: mood!) : own)
                    .opacity(pose == .asleep ? 0.45 : 1)
                if known {
                    Circle().stroke(own, lineWidth: 2.6 * u).padding(1.3 * u)
                }
                eyes(ink: ink)
                if pose == .sealed {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 8 * u, weight: .bold))
                        .foregroundColor(.white)
                        .offset(y: 8.5 * u)
                }
                if pose == .asleep {
                    Text("z")
                        .font(.system(size: 7 * u, weight: .bold))
                        .foregroundColor(own)
                        .offset(x: facing * 13 * u, y: -21 * u)
                }
            }
            .frame(width: 2 * r, height: 2 * r)
            .scaleEffect(x: pose == .heavy ? 1.03 : 1, y: pose == .heavy ? 0.95 : 1, anchor: .bottom)
            .offset(x: 2.5 * u * lean, y: pose == .heavy ? 2.5 * u : 0)
            .rotationEffect(.degrees(9 * Double(lean)))
        }
    }

    @ViewBuilder
    private func eyes(ink: Color) -> some View {
        let lx = (1.8 * facing - 4) * u
        let rx = (1.8 * facing + 4.4) * u
        let ey: CGFloat = -7.5 * u
        switch pose {
        case .light:
            ZStack {
                Arc(up: true).stroke(ink, style: StrokeStyle(lineWidth: 2.3 * u, lineCap: .round)).frame(width: 4.8 * u, height: 3.8 * u).offset(x: lx, y: ey + 1 * u)
                Arc(up: true).stroke(ink, style: StrokeStyle(lineWidth: 2.3 * u, lineCap: .round)).frame(width: 4.8 * u, height: 3.8 * u).offset(x: rx, y: ey + 1 * u)
            }
        case .normal, .hidden:
            ZStack {
                Capsule().fill(ink).frame(width: 3.6 * u, height: 8.5 * u).rotationEffect(.degrees(18 * Double(facing))).offset(x: lx, y: ey)
                Capsule().fill(ink).frame(width: 3.6 * u, height: 8.5 * u).rotationEffect(.degrees(18 * Double(facing))).offset(x: rx, y: ey + 1 * u)
            }
        case .heavy:
            ZStack {
                Capsule().fill(ink).frame(width: 3.6 * u, height: 5.5 * u).rotationEffect(.degrees(-24)).offset(x: lx, y: ey + 3.5 * u)
                Capsule().fill(ink).frame(width: 3.6 * u, height: 5.5 * u).rotationEffect(.degrees(24)).offset(x: rx, y: ey + 3.5 * u)
            }
        case .asleep:
            ZStack {
                Arc(up: false).stroke(ink, style: StrokeStyle(lineWidth: 2.3 * u, lineCap: .round)).frame(width: 4.8 * u, height: 3 * u).offset(x: lx, y: ey + 2 * u)
                Arc(up: false).stroke(ink, style: StrokeStyle(lineWidth: 2.3 * u, lineCap: .round)).frame(width: 4.8 * u, height: 3 * u).offset(x: rx, y: ey + 2 * u)
            }
        case .sealed:
            ZStack {
                Capsule().fill(ink).frame(width: 3.6 * u, height: 2.3 * u).offset(x: lx, y: ey + 1.5 * u)
                Capsule().fill(ink).frame(width: 3.6 * u, height: 2.3 * u).offset(x: rx, y: ey + 1.5 * u)
            }
        case .absent:
            EmptyView()
        }
    }
}

/// ^ (up) or ‿ (down), drawn in its frame.
private struct Arc: Shape {
    let up: Bool
    func path(in rect: CGRect) -> Path {
        var p = Path()
        if up {
            p.move(to: CGPoint(x: rect.minX, y: rect.maxY))
            p.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.maxY), control: CGPoint(x: rect.midX, y: rect.minY - rect.height * 0.6))
        } else {
            p.move(to: CGPoint(x: rect.minX, y: rect.minY))
            p.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.minY), control: CGPoint(x: rect.midX, y: rect.maxY + rect.height * 0.6))
        }
        return p
    }
}

// MARK: - Background on every iOS version

extension View {
    @ViewBuilder
    func widgetBackground(_ color: Color) -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(for: .widget) { color }
        } else {
            padding().background(color)
        }
    }
}

private func text(for state: WidgetState) -> (date: String, headline: String, sub: String) {
    switch state {
    case .setup:
        return ("Впаре", "Откройте Впаре", "Войдите — и здесь появится ваш день")
    case .loading:
        return ("Впаре", "Загружаем день…", "")
    case .ready(let s):
        return (s.dateLabel, s.headline, s.sub)
    }
}

private func snapshot(of state: WidgetState) -> Snapshot? {
    if case .ready(let s) = state { return s }
    return nil
}

// MARK: - «День», small

struct DayWidgetView: View {
    let entry: DayEntry
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let palette = Palette.of(scheme)
        let copy = text(for: entry.state)
        VStack(alignment: .leading, spacing: 0) {
            Text(copy.date)
                .font(.system(size: 12))
                .foregroundColor(palette.inkFaint)
                .lineLimit(1)
            PairMark(snapshot: snapshot(of: entry.state), palette: palette)
                .frame(width: 84, height: 42)
                .padding(.top, 6)
            Spacer(minLength: 4)
            Text(copy.headline)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(palette.ink)
                .lineLimit(2)
                .minimumScaleFactor(0.85)
            if !copy.sub.isEmpty {
                Text(copy.sub)
                    .font(.system(size: 12))
                    .foregroundColor(palette.inkSoft)
                    .lineLimit(2)
                    .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetBackground(palette.background)
        .widgetURL(URL(string: "vpare://day"))
    }
}

// MARK: - «Пара», medium

struct CoupleWidgetView: View {
    let entry: DayEntry
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let palette = Palette.of(scheme)
        let copy = text(for: entry.state)
        let s = snapshot(of: entry.state)

        HStack(alignment: .top, spacing: 12) {
            Link(destination: URL(string: "vpare://day")!) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(copy.date)
                        .font(.system(size: 12))
                        .foregroundColor(palette.inkFaint)
                        .lineLimit(1)
                    PairMark(snapshot: s, palette: palette)
                        .frame(width: 84, height: 42)
                        .padding(.top, 6)
                    Spacer(minLength: 4)
                    Text(copy.headline)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(palette.ink)
                        .lineLimit(2)
                        .minimumScaleFactor(0.85)
                    if !copy.sub.isEmpty {
                        Text(copy.sub)
                            .font(.system(size: 12))
                            .foregroundColor(palette.inkSoft)
                            .lineLimit(1)
                            .padding(.top, 2)
                    }
                    if let waiting = s?.waitingLine {
                        Text(waiting)
                            .font(.system(size: 12))
                            .foregroundColor(palette.partnerInk)
                            .lineLimit(1)
                            .padding(.top, 2)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }

            VStack(spacing: 8) {
                HStack(spacing: 6) {
                    if let together = s?.together {
                        Counter(value: together.days, label: together.label, fill: palette.accentSoft, ink: palette.accentSoftInk, icon: nil)
                    }
                    if let streak = s?.streak, streak.enabled {
                        Counter(value: streak.current, label: streak.label, fill: palette.partnerSoft, ink: palette.partnerInk, icon: "flame.fill")
                    }
                }
                .frame(maxHeight: .infinity)

                HStack(spacing: 6) {
                    Link(destination: URL(string: "vpare://day")!) {
                        Text(s?.me.marked == true ? "Мой день" : "Отметить")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(palette.accentInk)
                            .frame(maxWidth: .infinity, minHeight: 36)
                            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(palette.accent))
                    }
                    Link(destination: URL(string: "vpare://ping")!) {
                        Text("Весточка")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(palette.accentSoftInk)
                            .frame(maxWidth: .infinity, minHeight: 36)
                            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(palette.accentSoft))
                    }
                }
            }
            .frame(maxWidth: .infinity)
        }
        .widgetBackground(palette.background)
    }
}

private struct Counter: View {
    let value: Int
    let label: String
    let fill: Color
    let ink: Color
    let icon: String?

    var body: some View {
        VStack(spacing: 1) {
            HStack(spacing: 2) {
                if let icon = icon {
                    Image(systemName: icon).font(.system(size: 11, weight: .semibold))
                }
                Text("\(value)")
                    .font(.system(size: 22, weight: .bold))
                    .monospacedDigit()
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
            }
            Text(label)
                .font(.system(size: 10))
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.85)
        }
        .foregroundColor(ink)
        .padding(4)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(fill))
    }
}

// MARK: - Lock screen (iOS 16+)

struct LockRectangularView: View {
    let entry: DayEntry

    var body: some View {
        let copy = text(for: entry.state)
        VStack(alignment: .leading, spacing: 1) {
            Text(copy.headline)
                .font(.headline)
                .lineLimit(1)
                .widgetAccentable()
            if !copy.sub.isEmpty {
                Text(copy.sub)
                    .font(.caption)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .widgetBackground(.clear)
        .widgetURL(URL(string: "vpare://day"))
    }
}

struct LockInlineView: View {
    let entry: DayEntry

    var body: some View {
        Text(text(for: entry.state).headline)
            .widgetBackground(.clear)
            .widgetURL(URL(string: "vpare://day"))
    }
}

struct LockStreakView: View {
    let entry: DayEntry

    var body: some View {
        let s = snapshot(of: entry.state)
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 0) {
                Image(systemName: s?.me.marked == true ? "flame.fill" : "circle.dashed")
                    .font(.system(size: 13, weight: .semibold))
                    .widgetAccentable()
                Text(s.map { "\($0.streak.current)" } ?? "–")
                    .font(.system(size: 18, weight: .bold))
                    .monospacedDigit()
            }
        }
        .accessibilityLabel(s.map { "\($0.streak.current), \($0.streak.label)" } ?? "Впаре")
        .widgetBackground(.clear)
        .widgetURL(URL(string: "vpare://day"))
    }
}
