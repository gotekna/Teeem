import Foundation
import LocalAuthentication

class AuthManager {
    static let shared = AuthManager()
    private let keychain = KeychainManager.shared
    private let tokenKey = "auth_token"

    var accessToken: String? {
        get { keychain.get(tokenKey) }
        set {
            if let value = newValue { keychain.set(value, forKey: tokenKey) }
            else { keychain.delete(tokenKey) }
        }
    }

    var isLoggedIn: Bool { accessToken != nil }

    var biometricType: BiometricType {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return .none
        }
        switch context.biometryType {
        case .faceID: return .faceID
        case .touchID: return .touchID
        default: return .none
        }
    }

    var isBiometricEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: "biometric_enabled") }
        set { UserDefaults.standard.set(newValue, forKey: "biometric_enabled") }
    }

    func login(email: String, password: String) async throws -> User {
        let url = URL(string: "https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/auth/login")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = ["email": email, "password": password]
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw AuthError.invalidCredentials
        }
        let result = try JSONDecoder().decode(LoginResponse.self, from: data)
        accessToken = result.token
        return result.user
    }

    func getCurrentUser() async throws -> User {
        guard let token = accessToken else { throw AuthError.notAuthenticated }
        let url = URL(string: "https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/auth/me")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(User.self, from: data)
    }

    func logout() {
        accessToken = nil
    }

    func authenticateWithBiometrics() async -> Bool {
        let context = LAContext()
        do {
            return try await context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "Unlock TEEEM")
        } catch {
            return false
        }
    }
}

enum BiometricType {
    case none, touchID, faceID
    var displayName: String {
        switch self {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .none: return "None"
        }
    }
    var systemImageName: String {
        switch self {
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        case .none: return "lock"
        }
    }
}

enum AuthError: Error {
    case invalidCredentials, notAuthenticated
}

struct LoginResponse: Codable {
    let token: String
    let user: User
}
