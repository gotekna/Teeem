import Foundation
import Combine

/// WebSocket service for real-time email updates using ActionCable
class EmailWebSocketService: ObservableObject {
    static let shared = EmailWebSocketService()

    @Published var isConnected = false
    @Published var lastMessage: WebSocketMessage?

    private var webSocket: URLSessionWebSocketTask?
    private var session: URLSession?
    private var pingTimer: Timer?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 5

    private var onNewEmail: ((Email) -> Void)?
    private var onEmailUpdated: ((Int, [String: Any]) -> Void)?
    private var onEmailDeleted: ((Int) -> Void)?

    private init() {}

    // MARK: - Connection

    func connect() {
        guard !isConnected else { return }

        #if DEBUG
        let wsURL = "ws://localhost:3001/cable"
        #else
        let wsURL = "wss://teeemlive-ce8e2660a615.herokuapp.com/cable"
        #endif

        guard let url = URL(string: wsURL) else { return }

        var request = URLRequest(url: url)
        if let token = AuthManager.shared.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        session = URLSession(configuration: .default)
        webSocket = session?.webSocketTask(with: request)

        webSocket?.resume()

        receiveMessages()
        subscribeToEmailChannel()
        startPingTimer()

        isConnected = true
        reconnectAttempts = 0
    }

    func disconnect() {
        pingTimer?.invalidate()
        pingTimer = nil
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        session = nil
        isConnected = false
    }

    // MARK: - Subscriptions

    private func subscribeToEmailChannel() {
        let subscribeMessage: [String: Any] = [
            "command": "subscribe",
            "identifier": "{\"channel\":\"EmailChannel\"}"
        ]

        sendMessage(subscribeMessage)
    }

    private func sendMessage(_ message: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: message),
              let string = String(data: data, encoding: .utf8) else {
            return
        }

        webSocket?.send(.string(string)) { error in
            if let error = error {
                print("WebSocket send error: \(error)")
            }
        }
    }

    // MARK: - Receive Messages

    private func receiveMessages() {
        webSocket?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self?.handleMessage(text)
                    }
                @unknown default:
                    break
                }

                // Continue receiving
                self?.receiveMessages()

            case .failure(let error):
                print("WebSocket receive error: \(error)")
                self?.handleDisconnect()
            }
        }
    }

    private func handleMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return
        }

        // Parse ActionCable message
        guard let type = json["type"] as? String else {
            // This might be a data message
            if let message = json["message"] as? [String: Any] {
                handleDataMessage(message)
            }
            return
        }

        switch type {
        case "welcome":
            print("WebSocket connected")
        case "confirm_subscription":
            print("Subscribed to EmailChannel")
        case "ping":
            // ActionCable ping, no action needed
            break
        case "disconnect":
            handleDisconnect()
        default:
            break
        }
    }

    private func handleDataMessage(_ message: [String: Any]) {
        guard let type = message["type"] as? String else { return }

        DispatchQueue.main.async { [weak self] in
            switch type {
            case "new_email":
                if let emailData = message["email"] as? [String: Any],
                   let email = self?.parseEmail(emailData) {
                    self?.onNewEmail?(email)
                    self?.lastMessage = .newEmail(email)
                }

            case "email_state_change":
                if let emailId = message["email_id"] as? Int,
                   let changes = message["changes"] as? [String: Any] {
                    self?.onEmailUpdated?(emailId, changes)
                    self?.lastMessage = .emailUpdated(emailId)
                }

            case "email_deleted":
                if let emailId = message["email_id"] as? Int {
                    self?.onEmailDeleted?(emailId)
                    self?.lastMessage = .emailDeleted(emailId)
                }

            case "sync_completed":
                if let stats = message["stats"] as? [String: Any] {
                    let newCount = stats["new_emails"] as? Int ?? 0
                    self?.lastMessage = .syncCompleted(newCount)
                }

            default:
                break
            }
        }
    }

    // MARK: - Callbacks

    func onNewEmail(_ handler: @escaping (Email) -> Void) {
        onNewEmail = handler
    }

    func onEmailUpdated(_ handler: @escaping (Int, [String: Any]) -> Void) {
        onEmailUpdated = handler
    }

    func onEmailDeleted(_ handler: @escaping (Int) -> Void) {
        onEmailDeleted = handler
    }

    // MARK: - Helpers

    private func parseEmail(_ data: [String: Any]) -> Email? {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: data) else {
            return nil
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601

        return try? decoder.decode(Email.self, from: jsonData)
    }

    private func startPingTimer() {
        pingTimer?.invalidate()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            self?.webSocket?.sendPing { error in
                if let error = error {
                    print("Ping error: \(error)")
                }
            }
        }
    }

    private func handleDisconnect() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            self.isConnected = false
            self.pingTimer?.invalidate()

            // Attempt reconnect
            if self.reconnectAttempts < self.maxReconnectAttempts {
                self.reconnectAttempts += 1
                let delay = Double(self.reconnectAttempts) * 2.0

                DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                    self.connect()
                }
            }
        }
    }
}

// MARK: - WebSocket Message Types

enum WebSocketMessage {
    case newEmail(Email)
    case emailUpdated(Int)
    case emailDeleted(Int)
    case syncCompleted(Int)
}
