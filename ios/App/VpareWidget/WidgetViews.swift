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

// MARK: - The pair mark

/// Your ring and your partner's disc — the same device as in the app.
/// Dotted = not marked yet; filled with the day's colour once you may see it;
/// an amber disc with a lock while their day is still sealed for you.
struct PairMark: View {
    let snapshot: Snapshot?
    let palette: Palette

    var body: some View {
        let meMarked = snapshot?.me.marked ?? false
        let partner = snapshot?.partner
        let partnerMarked = partner?.marked ?? false
        let together = meMarked && partnerMarked

        GeometryReader { geo in
            let unit = min(geo.size.width / 96, geo.size.height / 56)
            let ringX = (together ? 40 : 30) * unit
            let discX = (together ? 56 : 66) * unit
            let cy = 28 * unit

            ZStack {
                if partnerMarked, let partner = partner {
                    Circle()
                        .fill(partner.unlocked && partner.color != nil ? Color(hex: partner.color!) : palette.partner)
                        .frame(width: 36 * unit, height: 36 * unit)
                        .position(x: discX, y: cy)
                    if !partner.unlocked {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 13 * unit, weight: .semibold))
                            .foregroundColor(palette.background)
                            .position(x: discX + (together ? 4 * unit : 0), y: cy)
                    }
                } else {
                    Circle()
                        .stroke(palette.partner, style: StrokeStyle(lineWidth: 2.5 * unit, lineCap: .round, dash: [4 * unit, 5 * unit]))
                        .frame(width: 34 * unit, height: 34 * unit)
                        .position(x: discX, y: cy)
                }

                if meMarked {
                    Circle()
                        .stroke(snapshot?.me.color.map { Color(hex: $0) } ?? palette.accent, lineWidth: 5 * unit)
                        .frame(width: 33 * unit, height: 33 * unit)
                        .position(x: ringX, y: cy)
                } else {
                    Circle()
                        .stroke(palette.accent, style: StrokeStyle(lineWidth: 3 * unit, lineCap: .round, dash: [4 * unit, 5 * unit]))
                        .frame(width: 33 * unit, height: 33 * unit)
                        .position(x: ringX, y: cy)
                }
            }
        }
        .accessibilityHidden(true)
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
                .frame(width: 72, height: 42)
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
                        .frame(width: 72, height: 42)
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
