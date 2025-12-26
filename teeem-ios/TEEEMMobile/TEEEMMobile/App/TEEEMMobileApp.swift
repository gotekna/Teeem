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
    @Environment(\.horizontalSizeClass) var horizontalSizeClass
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                JobsListView()
            }
            .tabItem {
                Label("Jobs", systemImage: "briefcase.fill")
            }
            .tag(0)

            NavigationStack {
                TasksListView()
            }
            .tabItem {
                Label("Tasks", systemImage: "checklist")
            }
            .tag(1)

            NavigationStack {
                ContactsListView()
            }
            .tabItem {
                Label("Contacts", systemImage: "person.2.fill")
            }
            .tag(2)

            NavigationStack {
                EmailListView()
            }
            .tabItem {
                Label("Email", systemImage: "envelope.fill")
            }
            .tag(3)

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Settings", systemImage: "gear")
            }
            .tag(4)
        }
    }
}
