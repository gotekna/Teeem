import Foundation
import SwiftUI
import Combine

@MainActor
class AppState: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false

    private let authManager = AuthManager.shared

    func checkAuthStatus() async {
        isLoading = true
        let hasToken = authManager.isLoggedIn
        print("🔐 Checking auth status... hasToken: \(hasToken)")

        if hasToken {
            do {
                currentUser = try await authManager.getCurrentUser()
                isAuthenticated = true
                print("✅ Auth restored for user: \(currentUser?.displayName ?? "unknown")")
            } catch {
                print("❌ Auth check failed: \(error)")
                // Token might be expired - clear it so user can log in fresh
                authManager.logout()
                isAuthenticated = false
            }
        } else {
            print("ℹ️ No stored token found")
            isAuthenticated = false
        }
        isLoading = false
    }

    func login(email: String, password: String) async throws {
        print("🔑 Attempting login for: \(email)")
        let user = try await authManager.login(email: email, password: password)
        currentUser = user
        isAuthenticated = true
        print("✅ Login successful for: \(user.displayName)")
    }

    func logout() {
        authManager.logout()
        currentUser = nil
        isAuthenticated = false
    }
}
