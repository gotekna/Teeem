import Foundation

@MainActor
class SyncManager: ObservableObject {
    static let shared = SyncManager()
    @Published var isSyncing = false
    @Published var pendingCount = 0
    @Published var lastSyncDate: Date?
    @Published var syncError: String?

    func processQueue() async {
        isSyncing = true
        // Process pending items
        isSyncing = false
        lastSyncDate = Date()
    }

    func clearCache() {
        pendingCount = 0
        lastSyncDate = nil
    }

    func getCachedJobs() -> [Job] { [] }
    func getCachedTasks() -> [SMTask] { [] }
}
