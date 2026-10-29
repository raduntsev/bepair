import UIKit
import Capacitor

/// Registers the app's own plugins with the bridge before the web app loads.
class BridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
    }
}
