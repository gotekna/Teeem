import Foundation
import UserNotifications
import UIKit

/// Manages push notifications and local notifications
@MainActor
class NotificationManager: NSObject, ObservableObject {
    static let shared = NotificationManager()

    @Published var isAuthorized = false
    @Published var deviceToken: String?
    @Published var pendingNotifications: [NotificationItem] = []

    private let notificationCenter = UNUserNotificationCenter.current()

    override init() {
        super.init()
        notificationCenter.delegate = self
        checkAuthorizationStatus()
    }

    // MARK: - Authorization

    func requestAuthorization() async -> Bool {
        do {
            let granted = try await notificationCenter.requestAuthorization(
                options: [.alert, .badge, .sound]
            )
            await MainActor.run {
                isAuthorized = granted
            }

            if granted {
                await registerForPushNotifications()
            }

            return granted
        } catch {
            print("Notification authorization error: \(error)")
            return false
        }
    }

    func checkAuthorizationStatus() {
        notificationCenter.getNotificationSettings { settings in
            Task { @MainActor in
                self.isAuthorized = settings.authorizationStatus == .authorized
            }
        }
    }

    // MARK: - Push Notifications

    private func registerForPushNotifications() async {
        await MainActor.run {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    func handleDeviceToken(_ token: Data) {
        let tokenString = token.map { String(format: "%02.2hhx", $0) }.joined()
        deviceToken = tokenString

        // Register with backend
        Task {
            await registerDeviceWithBackend(token: tokenString)
        }
    }

    func handleRegistrationError(_ error: Error) {
        print("Push notification registration failed: \(error)")
    }

    private func registerDeviceWithBackend(token: String) async {
        // TODO: Call backend API to register device token
        // POST /api/v1/devices
        // { token: "...", platform: "ios", device_name: "iPhone 15" }

        print("Would register device token: \(token)")
    }

    // MARK: - Handle Incoming Notifications

    func handleNotification(userInfo: [AnyHashable: Any]) {
        // Parse notification payload
        guard let aps = userInfo["aps"] as? [String: Any] else { return }

        let title = (aps["alert"] as? [String: Any])?["title"] as? String ?? ""
        let body = (aps["alert"] as? [String: Any])?["body"] as? String ?? ""
        let type = userInfo["type"] as? String ?? ""
        let entityId = userInfo["entity_id"] as? Int

        let notification = NotificationItem(
            id: UUID(),
            title: title,
            body: body,
            type: NotificationType(rawValue: type) ?? .general,
            entityId: entityId,
            receivedAt: Date()
        )

        pendingNotifications.insert(notification, at: 0)

        // Handle based on type
        handleNotificationType(notification)
    }

    private func handleNotificationType(_ notification: NotificationItem) {
        switch notification.type {
        case .taskAssigned:
            // Navigate to task detail
            NotificationCenter.default.post(
                name: .navigateToTask,
                object: notification.entityId
            )

        case .taskDueSoon, .taskOverdue:
            // Navigate to tasks list
            NotificationCenter.default.post(
                name: .navigateToTasks,
                object: nil
            )

        case .newEmail:
            // Navigate to email
            NotificationCenter.default.post(
                name: .navigateToEmail,
                object: notification.entityId
            )

        case .general:
            break
        }
    }

    // MARK: - Local Notifications

    func scheduleLocalNotification(
        title: String,
        body: String,
        delay: TimeInterval = 0,
        identifier: String = UUID().uuidString
    ) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: max(delay, 1),
            repeats: false
        )

        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: trigger
        )

        notificationCenter.add(request)
    }

    func cancelNotification(identifier: String) {
        notificationCenter.removePendingNotificationRequests(withIdentifiers: [identifier])
    }

    func cancelAllNotifications() {
        notificationCenter.removeAllPendingNotificationRequests()
    }

    // MARK: - Badge Management

    func setBadgeCount(_ count: Int) {
        Task { @MainActor in
            try? await notificationCenter.setBadgeCount(count)
        }
    }

    func clearBadge() {
        setBadgeCount(0)
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension NotificationManager: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        // Show notification even when app is in foreground
        return [.banner, .sound, .badge]
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo
        await MainActor.run {
            self.handleNotification(userInfo: userInfo)
        }
    }
}

// MARK: - Notification Item

struct NotificationItem: Identifiable {
    let id: UUID
    let title: String
    let body: String
    let type: NotificationType
    let entityId: Int?
    let receivedAt: Date
}

enum NotificationType: String {
    case taskAssigned = "task_assigned"
    case taskDueSoon = "task_due_soon"
    case taskOverdue = "task_overdue"
    case newEmail = "new_email"
    case general = "general"

    var icon: String {
        switch self {
        case .taskAssigned:
            return "person.badge.plus"
        case .taskDueSoon:
            return "clock.badge.exclamationmark"
        case .taskOverdue:
            return "exclamationmark.triangle"
        case .newEmail:
            return "envelope.badge"
        case .general:
            return "bell"
        }
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let navigateToTask = Notification.Name("navigateToTask")
    static let navigateToTasks = Notification.Name("navigateToTasks")
    static let navigateToEmail = Notification.Name("navigateToEmail")
}
