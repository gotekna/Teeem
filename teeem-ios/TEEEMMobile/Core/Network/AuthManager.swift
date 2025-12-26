import Foundation
import LocalAuthentication

class AuthManager {
    static let shared = AuthManager()

    private let keychainManager = KeychainManager.shared
    private let tokenKey = "com.teeem.mobile.jwt_token"
    private let biometricEnabledKey = "biometric_enabled"

    private init() {}

    // MARK: - Token Management

    var token: String? {
        keychainManager.get(key: tokenKey)
    }

    var hasValidToken: Bool {
        guard let token = token else { return false }
        // Check if token is not empty and not expired
        // JWT tokens are base64 encoded with 3 parts: header.payload.signature
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return false }

        // Decode payload to check expiration
        guard let payloadData = Data(base64Encoded: String(parts[1]).base64Padded) else {
            return false
        }

        guard let payload = try? JSONDecoder().decode(JWTPayload.self, from: payloadData) else {
            return false
        }

        // Check if token is expired (with 5 minute buffer)
        let expirationDate = Date(timeIntervalSince1970: TimeInterval(payload.exp))
        return expirationDate > Date().addingTimeInterval(300)
    }

    func saveToken(_ token: String) {
        keychainManager.save(key: tokenKey, value: token)
    }

    func clearToken() {
        keychainManager.delete(key: tokenKey)
    }

    // MARK: - Biometric Authentication

    var isBiometricEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: biometricEnabledKey) }
        set { UserDefaults.standard.set(newValue, forKey: biometricEnabledKey) }
    }

    var biometricType: BiometricType {
        let context = LAContext()
        var error: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return .none
        }

        switch context.biometryType {
        case .faceID:
            return .faceID
        case .touchID:
            return .touchID
        case .opticID:
            return .opticID
        @unknown default:
            return .none
        }
    }

    func authenticateWithBiometrics() async -> Bool {
        let context = LAContext()
        var error: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return false
        }

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Unlock TEEEM Mobile"
            )
            return success
        } catch {
            return false
        }
    }
}

// MARK: - Supporting Types

enum BiometricType {
    case none
    case touchID
    case faceID
    case opticID

    var displayName: String {
        switch self {
        case .none:
            return "None"
        case .touchID:
            return "Touch ID"
        case .faceID:
            return "Face ID"
        case .opticID:
            return "Optic ID"
        }
    }

    var systemImageName: String {
        switch self {
        case .none:
            return "lock"
        case .touchID:
            return "touchid"
        case .faceID:
            return "faceid"
        case .opticID:
            return "opticid"
        }
    }
}

struct JWTPayload: Decodable {
    let exp: Int
    let userId: Int?

    enum CodingKeys: String, CodingKey {
        case exp
        case userId = "user_id"
    }
}

// MARK: - String Extension for Base64

extension String {
    var base64Padded: String {
        var base64 = self
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")

        let remainder = base64.count % 4
        if remainder > 0 {
            base64 += String(repeating: "=", count: 4 - remainder)
        }

        return base64
    }
}
