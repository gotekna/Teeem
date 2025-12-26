import SwiftUI

/// Shows offline status and pending sync count
struct OfflineIndicator: View {
    @ObservedObject var networkMonitor = NetworkMonitor.shared
    @ObservedObject var syncManager = SyncManager.shared

    var body: some View {
        if !networkMonitor.isConnected || syncManager.pendingCount > 0 {
            HStack(spacing: 8) {
                if !networkMonitor.isConnected {
                    Image(systemName: "wifi.slash")
                        .foregroundColor(.white)
                    Text("Offline")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.white)
                }

                if syncManager.pendingCount > 0 {
                    if networkMonitor.isConnected {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .foregroundColor(.white)
                    }
                    Text("\(syncManager.pendingCount) pending")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.white)

                    if syncManager.isSyncing {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(0.7)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(networkMonitor.isConnected ? Color.orange : Color.red)
            .cornerRadius(16)
        }
    }
}

/// Offline banner that shows at top of screen
struct OfflineBanner: View {
    @ObservedObject var networkMonitor = NetworkMonitor.shared
    @ObservedObject var syncManager = SyncManager.shared

    var body: some View {
        if !networkMonitor.isConnected {
            HStack {
                Image(systemName: "wifi.slash")
                Text("You're offline. Changes will sync when connected.")
                    .font(.caption)
                Spacer()
                if syncManager.pendingCount > 0 {
                    Text("\(syncManager.pendingCount)")
                        .font(.caption)
                        .fontWeight(.bold)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color.white.opacity(0.3))
                        .cornerRadius(10)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(Color.orange)
            .foregroundColor(.white)
        }
    }
}

/// Sync status view for settings
struct SyncStatusView: View {
    @ObservedObject var syncManager = SyncManager.shared
    @ObservedObject var networkMonitor = NetworkMonitor.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Connection Status
            HStack {
                Image(systemName: networkMonitor.isConnected ? "wifi" : "wifi.slash")
                    .foregroundColor(networkMonitor.isConnected ? .green : .red)
                Text(networkMonitor.isConnected ? "Connected" : "Offline")
                Spacer()
                Text(connectionTypeLabel)
                    .foregroundColor(.secondary)
            }

            Divider()

            // Pending Sync
            HStack {
                Image(systemName: "arrow.triangle.2.circlepath")
                Text("Pending Changes")
                Spacer()
                if syncManager.isSyncing {
                    ProgressView()
                        .scaleEffect(0.8)
                } else {
                    Text("\(syncManager.pendingCount)")
                        .foregroundColor(syncManager.pendingCount > 0 ? .orange : .secondary)
                }
            }

            // Last Sync
            if let lastSync = syncManager.lastSyncDate {
                HStack {
                    Image(systemName: "clock")
                    Text("Last Synced")
                    Spacer()
                    Text(formatDate(lastSync))
                        .foregroundColor(.secondary)
                }
            }

            // Error
            if let error = syncManager.syncError {
                HStack {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundColor(.red)
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.red)
                }
            }

            // Sync Button
            if syncManager.pendingCount > 0 && networkMonitor.isConnected {
                Button {
                    Task {
                        await syncManager.processQueue()
                    }
                } label: {
                    HStack {
                        Image(systemName: "arrow.clockwise")
                        Text("Sync Now")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(syncManager.isSyncing)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    private var connectionTypeLabel: String {
        switch networkMonitor.connectionType {
        case .wifi:
            return "WiFi"
        case .cellular:
            return "Cellular"
        case .ethernet:
            return "Ethernet"
        case .unknown:
            return ""
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

#Preview("Offline Indicator") {
    VStack {
        OfflineIndicator()
        Spacer()
    }
    .padding()
}

#Preview("Sync Status") {
    SyncStatusView()
        .padding()
}
