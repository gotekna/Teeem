import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var notificationManager: NotificationManager
    @State private var showLogoutConfirmation = false

    private let authManager = AuthManager.shared

    var body: some View {
        List {
            if let user = appState.currentUser {
                Section {
                    HStack(spacing: 16) {
                        ZStack {
                            Circle().fill(Color.accentColor.gradient).frame(width: 60, height: 60)
                            Text(user.initials).font(.title2).fontWeight(.bold).foregroundColor(.white)
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text(user.displayName).font(.headline)
                            Text(user.email).font(.subheadline).foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 8)
                }
            }

            Section("Notifications") {
                if notificationManager.isAuthorized {
                    HStack {
                        Label("Push Notifications", systemImage: "bell.fill")
                        Spacer()
                        Text("Enabled").foregroundColor(.green)
                    }
                } else {
                    Button {
                        Task { await notificationManager.requestAuthorization() }
                    } label: {
                        Label("Enable Notifications", systemImage: "bell.badge")
                    }
                }
            }

            Section("Security") {
                if authManager.biometricType != .none {
                    Toggle(isOn: .init(
                        get: { authManager.isBiometricEnabled },
                        set: { authManager.isBiometricEnabled = $0 }
                    )) {
                        Label("Use \(authManager.biometricType.displayName)", systemImage: authManager.biometricType.systemImageName)
                    }
                }
            }

            Section("About") {
                LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
            }

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
        .confirmationDialog("Sign Out", isPresented: $showLogoutConfirmation, titleVisibility: .visible) {
            Button("Sign Out", role: .destructive) { appState.logout() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to sign out?")
        }
    }
}
