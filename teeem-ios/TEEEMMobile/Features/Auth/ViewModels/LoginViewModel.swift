import SwiftUI

@MainActor
class LoginViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage = ""

    private let authManager = AuthManager.shared

    var canLogin: Bool {
        !email.isEmpty && !password.isEmpty && email.contains("@")
    }

    var canUseBiometrics: Bool {
        authManager.isBiometricEnabled && authManager.hasValidToken && biometricType != .none
    }

    var biometricType: BiometricType {
        authManager.biometricType
    }

    func login(appState: AppState) async {
        isLoading = true
        defer { isLoading = false }

        do {
            try await appState.login(email: email, password: password)

            // Enable biometric login for future sessions
            if biometricType != .none {
                authManager.isBiometricEnabled = true
            }
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    func loginWithBiometrics(appState: AppState) async {
        let success = await authManager.authenticateWithBiometrics()

        if success {
            // Token is already stored, just verify it
            await appState.checkAuthStatus()
        } else {
            errorMessage = "Biometric authentication failed. Please sign in with your password."
            showError = true
        }
    }
}
