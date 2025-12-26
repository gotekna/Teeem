import UIKit
import UserNotifications

/// App Delegate for handling push notifications and app lifecycle
class AppDelegate: NSObject, UIApplicationDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Set up notification center delegate
        UNUserNotificationCenter.current().delegate = NotificationManager.shared

        // Check for notification that launched the app
        if let notification = launchOptions?[.remoteNotification] as? [AnyHashable: Any] {
            Task { @MainActor in
                NotificationManager.shared.handleNotification(userInfo: notification)
            }
        }

        return true
    }

    // MARK: - Push Notification Registration

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            NotificationManager.shared.handleDeviceToken(deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in
            NotificationManager.shared.handleRegistrationError(error)
        }
    }

    // MARK: - Remote Notification Handling

    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        Task { @MainActor in
            NotificationManager.shared.handleNotification(userInfo: userInfo)
            completionHandler(.newData)
        }
    }
}
