import Foundation
import SwiftUI

@MainActor
class AppState: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false

    private let authManager = AuthManager.shared

    func checkAuthStatus() async {
        isLoading = true
        if authManager.isLoggedIn {
            do {
                currentUser = try await authManager.getCurrentUser()
                isAuthenticated = true
            } catch {
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
