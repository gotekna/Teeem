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
        let body: [String: Any] = ["user": ["email": email, "password": password]]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw AuthError.networkError("No response")
        }
        // Parse the response JSON
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw AuthError.networkError("Invalid response")
        }
        // Check for success flag
        if let success = json["success"] as? Bool, !success {
            let error = json["error"] as? String ?? "Login failed"
            throw AuthError.serverError(error)
        }
        if http.statusCode != 200 && http.statusCode != 201 {
            let error = json["error"] as? String ?? "Invalid credentials"
            throw AuthError.serverError(error)
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
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw AuthError.notAuthenticated
        }
        // Parse wrapped response { "success": true, "user": {...} }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let userDict = json["user"] {
            let userData = try JSONSerialization.data(withJSONObject: userDict)
            return try decoder.decode(User.self, from: userData)
        }
        return try decoder.decode(User.self, from: data)
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

enum AuthError: LocalizedError {
    case invalidCredentials, notAuthenticated
    case serverError(String)
    case networkError(String)

    var errorDescription: String? {
        switch self {
        case .invalidCredentials: return "Invalid email or password"
        case .notAuthenticated: return "Not authenticated"
        case .serverError(let msg): return msg
        case .networkError(let msg): return msg
        }
    }
}

struct LoginResponse: Codable {
    let success: Bool
    let token: String
    let user: User
}
