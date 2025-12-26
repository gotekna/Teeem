import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @State private var showLogoutConfirmation = false

    private let authManager = AuthManager.shared

    var body: some View {
        NavigationStack {
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

                // Sync Section
                Section {
                    HStack {
                        Label("Offline Data", systemImage: "arrow.triangle.2.circlepath")
                        Spacer()
                        Text("Synced")
                            .foregroundColor(.secondary)
                    }

                    Button {
                        // Clear cache action
                    } label: {
                        Label("Clear Cache", systemImage: "trash")
                    }
                } header: {
                    Text("Data")
                }

                // About Section
                Section {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
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
                    appState.logout()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Are you sure you want to sign out?")
            }
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(AppState())
}
