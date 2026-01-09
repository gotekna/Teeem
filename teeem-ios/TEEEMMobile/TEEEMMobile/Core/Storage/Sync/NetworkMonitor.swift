import Foundation
import Network
import Combine

class NetworkMonitor: ObservableObject {
    static let shared = NetworkMonitor()
    @Published var isConnected = true
    @Published var connectionType: ConnectionType = .unknown

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")

    enum ConnectionType { case wifi, cellular, ethernet, unknown }

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
                if path.usesInterfaceType(.wifi) { self?.connectionType = .wifi }
                else if path.usesInterfaceType(.cellular) { self?.connectionType = .cellular }
                else { self?.connectionType = .unknown }
            }
        }
        monitor.start(queue: queue)
    }
}
