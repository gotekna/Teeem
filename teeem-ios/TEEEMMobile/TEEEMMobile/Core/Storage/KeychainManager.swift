import Foundation
import Security

class KeychainManager {
    static let shared = KeychainManager()
    private let service = "com.teeem.mobile"

    func set(_ value: String, forKey key: String) {
        guard let data = value.data(using: .utf8) else { return }
        // Delete any existing item first
        delete(key)
        // Add new item with accessibility that persists across app restarts
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]
        let status = SecItemAdd(query as CFDictionary, nil)
        print("Keychain SET '\(key)': \(status == errSecSuccess ? "SUCCESS" : "FAILED (\(status))")")
    }

    func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecSuccess, let data = result as? Data {
            let value = String(data: data, encoding: .utf8)
            print("Keychain GET '\(key)': FOUND (length: \(value?.count ?? 0))")
            return value
        } else {
            print("Keychain GET '\(key)': NOT FOUND (status: \(status))")
            return nil
        }
    }

    func delete(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }
}
