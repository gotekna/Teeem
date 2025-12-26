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
    @State private var navigateToTaskId: Int?
    @State private var navigateToEmailId: Int?

    var body: some View {
        Group {
            if horizontalSizeClass == .regular {
                // iPad: Use NavigationSplitView with sidebar
                iPadLayout
            } else {
                // iPhone: Use TabView
                iPhoneLayout
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .navigateToTask)) { notification in
            if let taskId = notification.object as? Int {
                navigateToTaskId = taskId
                selectedTab = 1 // Switch to Tasks tab
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .navigateToTasks)) { _ in
            selectedTab = 1 // Switch to Tasks tab
        }
        .onReceive(NotificationCenter.default.publisher(for: .navigateToEmail)) { notification in
            if let emailId = notification.object as? Int {
                navigateToEmailId = emailId
                selectedTab = 3 // Switch to Email tab (after Contacts)
            }
        }
    }

    // MARK: - iPhone Layout

    private var iPhoneLayout: some View {
        ZStack(alignment: .top) {
            TabView(selection: $selectedTab) {
                NavigationStack {
                    JobsListView()
                }
                .tabItem {
                    Label("Jobs", systemImage: "briefcase.fill")
                }
                .tag(0)

                NavigationStack {
                    TasksListView(navigateToTaskId: $navigateToTaskId)
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
                    EmailListView(navigateToEmailId: $navigateToEmailId)
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

            // Offline Banner
            VStack {
                OfflineBanner()
                Spacer()
            }
        }
    }

    // MARK: - iPad Layout

    private var iPadLayout: some View {
        NavigationSplitView {
            // Sidebar
            List(selection: $selectedTab) {
                Section("Main") {
                    Label("Jobs", systemImage: "briefcase.fill")
                        .tag(0)

                    Label("Tasks", systemImage: "checklist")
                        .tag(1)

                    Label("Contacts", systemImage: "person.2.fill")
                        .tag(2)

                    Label("Email", systemImage: "envelope.fill")
                        .tag(3)
                }

                Section {
                    Label("Settings", systemImage: "gear")
                        .tag(4)
                }
            }
            .navigationTitle("TEEEM")
            .safeAreaInset(edge: .top) {
                OfflineBanner()
            }
        } detail: {
            // Detail View based on selection
            switch selectedTab {
            case 0:
                NavigationStack {
                    JobsListView()
                }
            case 1:
                NavigationStack {
                    TasksListView(navigateToTaskId: $navigateToTaskId)
                }
            case 2:
                NavigationStack {
                    ContactsListView()
                }
            case 3:
                NavigationStack {
                    EmailListView(navigateToEmailId: $navigateToEmailId)
                }
            case 4:
                NavigationStack {
                    SettingsView()
                }
            default:
                NavigationStack {
                    JobsListView()
                }
            }
        }
        .navigationSplitViewStyle(.balanced)
    }
}

#Preview {
    RootView()
        .environmentObject(AppState())
}
