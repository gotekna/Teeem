import SwiftUI

struct OfflineIndicator: View {
    @EnvironmentObject var networkMonitor: NetworkMonitor

    var body: some View {
        if !networkMonitor.isConnected {
            HStack(spacing: 6) {
                Image(systemName: "wifi.slash")
                Text("Offline")
            }
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Color.red)
            .foregroundColor(.white)
            .cornerRadius(12)
        }
    }
}

struct OfflineBanner: View {
    @EnvironmentObject var networkMonitor: NetworkMonitor

    var body: some View {
        if !networkMonitor.isConnected {
            HStack {
                Image(systemName: "wifi.slash")
                Text("You're offline")
                Spacer()
            }
            .font(.caption)
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(Color.orange)
            .foregroundColor(.white)
        }
    }
}
