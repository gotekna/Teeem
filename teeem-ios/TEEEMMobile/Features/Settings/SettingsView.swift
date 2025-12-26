import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var networkMonitor: NetworkMonitor
    @EnvironmentObject var syncManager: SyncManager
    @EnvironmentObject var notificationManager: NotificationManager
    @State private var showLogoutConfirmation = false
    @State private var showClearCacheConfirmation = false

    private let authManager = AuthManager.shared

    var body: some View {
        List {
            // User Profile Section
            if let user = appState.currentUser {
                Section {
                    HStack(spacing: 16) {
                        // Avatar
                        ZStack {
                            Circle()
                                .fill(Color.accentColor.gradient)
                                .frame(width: 60, height: 60)

                            Text(user.initials)
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text(user.displayName)
                                .font(.headline)

                            Text(user.email)
                                .font(.subheadline)
                                .foregroundColor(.secondary)

                            if let role = user.role {
                                Text(role.capitalized)
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(Color.accentColor.opacity(0.15))
                                    .foregroundColor(.accentColor)
                                    .cornerRadius(4)
                            }
                        }
                    }
                    .padding(.vertical, 8)
                }
            }

            // Sync Status Section
            Section {
                SyncStatusView()
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            } header: {
                Text("Sync Status")
            }

            // Notifications Section
            Section {
                if notificationManager.isAuthorized {
                    HStack {
                        Label("Push Notifications", systemImage: "bell.fill")
                        Spacer()
                        Text("Enabled")
                            .foregroundColor(.green)
                    }
                } else {
                    Button {
                        Task {
                            await notificationManager.requestAuthorization()
                        }
                    } label: {
                        Label("Enable Notifications", systemImage: "bell.badge")
                    }
                }

                if let token = notificationManager.deviceToken {
                    HStack {
                        Text("Device Token")
                        Spacer()
                        Text(String(token.prefix(8)) + "...")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            } header: {
                Text("Notifications")
            } footer: {
                Text("Get notified about new tasks, due dates, and emails.")
            }

            // Security Section
            Section {
                if authManager.biometricType != .none {
                    Toggle(isOn: .init(
                        get: { authManager.isBiometricEnabled },
                        set: { authManager.isBiometricEnabled = $0 }
                    )) {
                        Label(
                            "Use \(authManager.biometricType.displayName)",
                            systemImage: authManager.biometricType.systemImageName
                        )
                    }
                }
            } header: {
                Text("Security")
            }

            // Data Management Section
            Section {
                HStack {
                    Label("Cached Jobs", systemImage: "briefcase")
                    Spacer()
                    Text("\(syncManager.getCachedJobs().count)")
                        .foregroundColor(.secondary)
                }

                HStack {
                    Label("Cached Tasks", systemImage: "checklist")
                    Spacer()
                    Text("\(syncManager.getCachedTasks().count)")
                        .foregroundColor(.secondary)
                }

                Button(role: .destructive) {
                    showClearCacheConfirmation = true
                } label: {
                    Label("Clear Offline Cache", systemImage: "trash")
                }
            } header: {
                Text("Offline Data")
            } footer: {
                Text("Clearing cache will remove all offline data. It will be re-downloaded when online.")
            }

            // About Section
            Section {
                HStack {
                    Text("Version")
                    Spacer()
                    Text(Bundle.main.appVersion)
                        .foregroundColor(.secondary)
                }

                HStack {
                    Text("Build")
                    Spacer()
                    Text(Bundle.main.buildNumber)
                        .foregroundColor(.secondary)
                }

                Link(destination: URL(string: "https://teeem.com.au")!) {
                    Label("Visit Website", systemImage: "globe")
                }

                Link(destination: URL(string: "mailto:support@teeem.com.au")!) {
                    Label("Contact Support", systemImage: "envelope")
                }
            } header: {
                Text("About")
            }

            // Logout Section
            Section {
                Button(role: .destructive) {
                    showLogoutConfirmation = true
                } label: {
                    HStack {
                        Spacer()
                        Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        Spacer()
                    }
                }
            }
        }
        .navigationTitle("Settings")
        .confirmationDialog(
            "Sign Out",
            isPresented: $showLogoutConfirmation,
            titleVisibility: .visible
        ) {
            Button("Sign Out", role: .destructive) {
                syncManager.clearCache()
                notificationManager.clearBadge()
                appState.logout()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to sign out? Offline data will be cleared.")
        }
        .confirmationDialog(
            "Clear Cache",
            isPresented: $showClearCacheConfirmation,
            titleVisibility: .visible
        ) {
            Button("Clear Cache", role: .destructive) {
                syncManager.clearCache()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will remove all cached data. Jobs and tasks will be re-downloaded when online.")
        }
    }
}

// MARK: - Bundle Extension

extension Bundle {
    var appVersion: String {
        infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }

    var buildNumber: String {
        infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }
}

#Preview {
    NavigationStack {
        SettingsView()
            .environmentObject(AppState())
            .environmentObject(NetworkMonitor.shared)
            .environmentObject(SyncManager.shared)
            .environmentObject(NotificationManager.shared)
    }
}
