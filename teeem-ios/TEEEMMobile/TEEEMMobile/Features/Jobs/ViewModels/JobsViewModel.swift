import Foundation
import Combine

@MainActor
class JobsViewModel: ObservableObject {
    @Published var jobs: [Job] = []
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage = ""

    private let apiClient = APIClient.shared
    private let cache = CacheManager.shared

    init() {
        // Load cached data immediately
        if let cached = cache.load([Job].self, forKey: CacheManager.jobsKey) {
            jobs = cached
        }
    }

    func loadJobs() async {
        isLoading = true
        print("Starting to load jobs...")
        do {
            let loadedJobs: [Job] = try await apiClient.get("jobs")
            jobs = loadedJobs
            cache.save(loadedJobs, forKey: CacheManager.jobsKey)
            print("SUCCESS: Loaded \(jobs.count) jobs")
        } catch let decodingError as DecodingError {
            // Detailed decoding error info
            switch decodingError {
            case .keyNotFound(let key, let context):
                print("DECODE ERROR: Key '\(key.stringValue)' not found: \(context.debugDescription)")
                print("  Path: \(context.codingPath.map { $0.stringValue }.joined(separator: "."))")
            case .typeMismatch(let type, let context):
                print("DECODE ERROR: Type mismatch for \(type): \(context.debugDescription)")
                print("  Path: \(context.codingPath.map { $0.stringValue }.joined(separator: "."))")
            case .valueNotFound(let type, let context):
                print("DECODE ERROR: Value not found for \(type): \(context.debugDescription)")
                print("  Path: \(context.codingPath.map { $0.stringValue }.joined(separator: "."))")
            case .dataCorrupted(let context):
                print("DECODE ERROR: Data corrupted: \(context.debugDescription)")
                print("  Path: \(context.codingPath.map { $0.stringValue }.joined(separator: "."))")
            @unknown default:
                print("DECODE ERROR: Unknown: \(decodingError)")
            }
            errorMessage = "Decode error - check console"
            showError = true
        } catch {
            errorMessage = "Failed to load jobs: \(error)"
            showError = true
            print("FAILED: Job load error: \(error)")
        }
        isLoading = false
    }
}
