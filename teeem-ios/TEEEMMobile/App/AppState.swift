import SwiftUI
import Combine

@MainActor
class AppState: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var error: AppError?

    private let authManager = AuthManager.shared
    private let apiClient = APIClient.shared

    func checkAuthStatus() async {
        isLoading = true
        defer { isLoading = false }

        guard authManager.hasValidToken else {
            isAuthenticated = false
            return
        }

        do {
            let user = try await apiClient.getCurrentUser()
            self.currentUser = user
            self.isAuthenticated = true
        } catch {
            // Token invalid or expired
            authManager.clearToken()
            isAuthenticated = false
        }
    }

    func login(email: String, password: String) async throws {
        isLoading = true
        defer { isLoading = false }

        let response = try await apiClient.login(email: email, password: password)
        authManager.saveToken(response.token)
        self.currentUser = response.user
        self.isAuthenticated = true
    }

    func logout() {
        authManager.clearToken()
        currentUser = nil
        isAuthenticated = false
    }
}

enum AppError: Error, LocalizedError {
    case networkError(String)
    case authenticationFailed
    case serverError(String)
    case unknown

    var errorDescription: String? {
        switch self {
        case .networkError(let message):
            return "Network error: \(message)"
        case .authenticationFailed:
            return "Authentication failed. Please check your credentials."
        case .serverError(let message):
            return "Server error: \(message)"
        case .unknown:
            return "An unknown error occurred."
        }
    }
}
