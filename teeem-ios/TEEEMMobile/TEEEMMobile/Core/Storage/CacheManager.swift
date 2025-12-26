import Foundation

class CacheManager {
    static let shared = CacheManager()

    private let fileManager = FileManager.default
    private var cacheDirectory: URL {
        fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("TEEEMCache")
    }

    init() {
        // Create cache directory if needed
        try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    }

    // MARK: - Save

    func save<T: Encodable>(_ data: T, forKey key: String) {
        let fileURL = cacheDirectory.appendingPathComponent("\(key).json")
        do {
            let encoded = try JSONEncoder().encode(data)
            try encoded.write(to: fileURL)
            print("Cache: Saved \(key)")
        } catch {
            print("Cache: Failed to save \(key): \(error)")
        }
    }

    // MARK: - Load

    func load<T: Decodable>(_ type: T.Type, forKey key: String) -> T? {
        let fileURL = cacheDirectory.appendingPathComponent("\(key).json")
        guard fileManager.fileExists(atPath: fileURL.path) else { return nil }

        do {
            let data = try Data(contentsOf: fileURL)
            let decoded = try JSONDecoder().decode(T.self, from: data)
            print("Cache: Loaded \(key)")
            return decoded
        } catch {
            print("Cache: Failed to load \(key): \(error)")
            return nil
        }
    }

    // MARK: - Clear

    func clear(forKey key: String) {
        let fileURL = cacheDirectory.appendingPathComponent("\(key).json")
        try? fileManager.removeItem(at: fileURL)
    }

    func clearAll() {
        try? fileManager.removeItem(at: cacheDirectory)
        try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    }
}

// MARK: - Cache Keys

extension CacheManager {
    static let jobsKey = "jobs"
    static let tasksKey = "tasks"
    static let contactsKey = "contacts"
    static let emailsKey = "emails"
}
