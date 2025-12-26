import SwiftUI

@main
struct TEEEMMobileApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var appState = AppState()
    @StateObject private var networkMonitor = NetworkMonitor.shared
    @StateObject private var syncManager = SyncManager.shared
    @StateObject private var notificationManager = NotificationManager.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .environmentObject(networkMonitor)
                .environmentObject(syncManager)
                .environmentObject(notificationManager)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        Group {
            if appState.isAuthenticated {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .task {
            await appState.checkAuthStatus()
        }
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            JobsListView()
                .tabItem {
                    Label("Jobs", systemImage: "briefcase.fill")
                }

            TasksListView()
                .tabItem {
                    Label("Tasks", systemImage: "checklist")
                }

            EmailListView()
                .tabItem {
                    Label("Email", systemImage: "envelope.fill")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
        }
    }
}

#Preview {
    RootView()
        .environmentObject(AppState())
}
