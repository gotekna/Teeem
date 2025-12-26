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
        print("Checking auth status... isLoggedIn: \(authManager.isLoggedIn)")
        if authManager.isLoggedIn {
            do {
                currentUser = try await authManager.getCurrentUser()
                isAuthenticated = true
                print("Auth restored for user: \(currentUser?.displayName ?? "unknown")")
            } catch {
                print("Auth check failed: \(error)")
                isAuthenticated = false
            }
        }
        isLoading = false
    }

    func login(email: String, password: String) async throws {
        let user = try await authManager.login(email: email, password: password)
        currentUser = user
        isAuthenticated = true
    }

    func logout() {
        authManager.logout()
        currentUser = nil
        isAuthenticated = false
    }
}
