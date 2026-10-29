import Foundation
import Capacitor
import WidgetKit

/// The web app's handle on the home-screen and lock-screen widgets (src/lib/native.ts).
/// The key and server address go into the shared App Group, where the widget extension reads them.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "refresh", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
    ]

    static let appGroup = "group.app.bepair.vpare"
    private var defaults: UserDefaults? { UserDefaults(suiteName: Self.appGroup) }

    @objc func configure(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), let api = call.getString("api") else {
            call.reject("token and api are required")
            return
        }
        guard let defaults = defaults else {
            call.reject("App Group \(Self.appGroup) is not available — check the entitlements")
            return
        }
        var trimmed = api
        while trimmed.hasSuffix("/") { trimmed.removeLast() }
        defaults.set(token, forKey: "token")
        defaults.set(trimmed, forKey: "api")
        defaults.removeObject(forKey: "snapshot")
        reload()
        call.resolve()
    }

    @objc func refresh(_ call: CAPPluginCall) {
        reload()
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        defaults?.removeObject(forKey: "token")
        defaults?.removeObject(forKey: "api")
        defaults?.removeObject(forKey: "snapshot")
        reload()
        call.resolve()
    }

    @objc func status(_ call: CAPPluginCall) {
        let token = defaults?.string(forKey: "token")
        let api = defaults?.string(forKey: "api")
        var result: [String: Any] = ["configured": token != nil && api != nil]
        if let api = api { result["api"] = api }
        call.resolve(result)
    }

    private func reload() {
        WidgetCenter.shared.reloadAllTimelines()
    }
}
