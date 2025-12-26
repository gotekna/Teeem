import Foundation
import CoreData
import Combine

/// Manages offline sync queue and data synchronization
@MainActor
class SyncManager: ObservableObject {
    static let shared = SyncManager()

    @Published var isSyncing = false
    @Published var pendingCount = 0
    @Published var lastSyncDate: Date?
    @Published var syncError: String?

    private let persistence = PersistenceController.shared
    private let networkMonitor = NetworkMonitor.shared
    private let apiClient = APIClient.shared

    private var syncTask: Task<Void, Never>?
    private var cancellables = Set<AnyCancellable>()

    private init() {
        setupNetworkObserver()
        updatePendingCount()
    }

    // MARK: - Network Observer

    private func setupNetworkObserver() {
        networkMonitor.$isConnected
            .removeDuplicates()
            .sink { [weak self] isConnected in
                if isConnected {
                    Task { @MainActor in
                        await self?.processQueue()
                    }
                }
            }
            .store(in: &cancellables)
    }

    // MARK: - Queue Operations

    /// Add an action to the sync queue
    func enqueue(
        entityType: String,
        entityId: Int,
        action: SyncAction,
        payload: Data? = nil,
        priority: Int = 0
    ) {
        persistence.performBackgroundTask { context in
            let pendingSync = NSEntityDescription.insertNewObject(
                forEntityName: "PendingSync",
                into: context
            )

            pendingSync.setValue(UUID(), forKey: "id")
            pendingSync.setValue(entityType, forKey: "entityType")
            pendingSync.setValue(Int64(entityId), forKey: "entityId")
            pendingSync.setValue(action.rawValue, forKey: "action")
            pendingSync.setValue(payload, forKey: "payload")
            pendingSync.setValue(Date(), forKey: "createdAt")
            pendingSync.setValue(Int16(0), forKey: "retryCount")
            pendingSync.setValue(Int16(priority), forKey: "priority")

            try? context.save()

            Task { @MainActor in
                self.updatePendingCount()
                if self.networkMonitor.isConnected {
                    await self.processQueue()
                }
            }
        }
    }

    /// Process all pending sync items
    func processQueue() async {
        guard !isSyncing, networkMonitor.isConnected else { return }

        isSyncing = true
        syncError = nil

        let context = persistence.newBackgroundContext()

        await context.perform {
            let request = NSFetchRequest<NSManagedObject>(entityName: "PendingSync")
            request.sortDescriptors = [
                NSSortDescriptor(key: "priority", ascending: false),
                NSSortDescriptor(key: "createdAt", ascending: true)
            ]
            request.predicate = NSPredicate(format: "retryCount < 5")

            guard let items = try? context.fetch(request), !items.isEmpty else {
                return
            }

            for item in items {
                let entityType = item.value(forKey: "entityType") as? String ?? ""
                let entityId = item.value(forKey: "entityId") as? Int64 ?? 0
                let action = item.value(forKey: "action") as? String ?? ""
                let payload = item.value(forKey: "payload") as? Data

                Task {
                    let success = await self.processItem(
                        entityType: entityType,
                        entityId: Int(entityId),
                        action: SyncAction(rawValue: action) ?? .update,
                        payload: payload
                    )

                    await context.perform {
                        if success {
                            context.delete(item)
                        } else {
                            let retryCount = (item.value(forKey: "retryCount") as? Int16 ?? 0) + 1
                            item.setValue(retryCount, forKey: "retryCount")
                        }
                        try? context.save()
                    }
                }
            }
        }

        isSyncing = false
        lastSyncDate = Date()
        updatePendingCount()
    }

    private func processItem(
        entityType: String,
        entityId: Int,
        action: SyncAction,
        payload: Data?
    ) async -> Bool {
        do {
            switch entityType {
            case "task":
                try await processTaskAction(entityId: entityId, action: action, payload: payload)
            case "photo":
                try await processPhotoUpload(entityId: entityId, payload: payload)
            default:
                return false
            }
            return true
        } catch {
            await MainActor.run {
                syncError = error.localizedDescription
            }
            return false
        }
    }

    private func processTaskAction(entityId: Int, action: SyncAction, payload: Data?) async throws {
        switch action {
        case .start:
            _ = try await apiClient.startTask(id: entityId)
        case .complete:
            var notes: String? = nil
            if let payload = payload,
               let json = try? JSONSerialization.jsonObject(with: payload) as? [String: Any] {
                notes = json["notes"] as? String
            }
            _ = try await apiClient.completeTask(id: entityId, notes: notes)
        case .hold:
            var reason = ""
            if let payload = payload,
               let json = try? JSONSerialization.jsonObject(with: payload) as? [String: Any] {
                reason = json["reason"] as? String ?? ""
            }
            _ = try await apiClient.holdTask(id: entityId, reason: reason)
        default:
            break
        }
    }

    private func processPhotoUpload(entityId: Int, payload: Data?) async throws {
        guard let payload = payload,
              let json = try? JSONSerialization.jsonObject(with: payload) as? [String: Any],
              let taskId = json["taskId"] as? Int,
              let photoType = json["photoType"] as? String,
              let imagePath = json["imagePath"] as? String,
              let imageData = FileManager.default.contents(atPath: imagePath) else {
            return
        }

        let latitude = json["latitude"] as? Double
        let longitude = json["longitude"] as? Double

        _ = try await apiClient.uploadPhoto(
            taskId: taskId,
            imageData: imageData,
            photoType: photoType,
            latitude: latitude,
            longitude: longitude
        )

        // Clean up local image file
        try? FileManager.default.removeItem(atPath: imagePath)
    }

    // MARK: - Cache Management

    /// Cache jobs for offline access
    func cacheJobs(_ jobs: [Job]) {
        persistence.performBackgroundTask { context in
            for job in jobs {
                self.cacheJob(job, in: context)
            }
            try? context.save()
        }
    }

    private func cacheJob(_ job: Job, in context: NSManagedObjectContext) {
        let request = NSFetchRequest<NSManagedObject>(entityName: "CachedJob")
        request.predicate = NSPredicate(format: "id == %lld", Int64(job.id))

        let cachedJob: NSManagedObject
        if let existing = try? context.fetch(request).first {
            cachedJob = existing
        } else {
            cachedJob = NSEntityDescription.insertNewObject(forEntityName: "CachedJob", into: context)
            cachedJob.setValue(Int64(job.id), forKey: "id")
        }

        cachedJob.setValue(job.jobNumber, forKey: "jobNumber")
        cachedJob.setValue(job.name, forKey: "name")
        cachedJob.setValue(job.clientName, forKey: "clientName")
        cachedJob.setValue(job.status, forKey: "status")
        cachedJob.setValue(job.stage, forKey: "stage")
        cachedJob.setValue(job.address, forKey: "address")
        cachedJob.setValue(job.suburb, forKey: "suburb")
        cachedJob.setValue(Date(), forKey: "lastSyncedAt")
        cachedJob.setValue(false, forKey: "isModifiedLocally")

        // Store full JSON for complete data
        if let jsonData = try? JSONEncoder().encode(job) {
            cachedJob.setValue(jsonData, forKey: "jsonData")
        }
    }

    /// Cache tasks for offline access
    func cacheTasks(_ tasks: [SMTask]) {
        persistence.performBackgroundTask { context in
            for task in tasks {
                self.cacheTask(task, in: context)
            }
            try? context.save()
        }
    }

    private func cacheTask(_ task: SMTask, in context: NSManagedObjectContext) {
        let request = NSFetchRequest<NSManagedObject>(entityName: "CachedTask")
        request.predicate = NSPredicate(format: "id == %lld", Int64(task.id))

        let cachedTask: NSManagedObject
        if let existing = try? context.fetch(request).first {
            cachedTask = existing
        } else {
            cachedTask = NSEntityDescription.insertNewObject(forEntityName: "CachedTask", into: context)
            cachedTask.setValue(Int64(task.id), forKey: "id")
        }

        cachedTask.setValue(Int64(task.jobId ?? 0), forKey: "jobId")
        cachedTask.setValue(task.name, forKey: "name")
        cachedTask.setValue(task.status?.rawValue, forKey: "status")
        cachedTask.setValue(task.trade, forKey: "trade")
        cachedTask.setValue(task.plannedEndDate, forKey: "plannedEndDate")
        cachedTask.setValue(Date(), forKey: "lastSyncedAt")
        cachedTask.setValue(false, forKey: "isModifiedLocally")

        if let jsonData = try? JSONEncoder().encode(task) {
            cachedTask.setValue(jsonData, forKey: "jsonData")
        }
    }

    /// Get cached jobs when offline
    func getCachedJobs() -> [Job] {
        let request = NSFetchRequest<NSManagedObject>(entityName: "CachedJob")
        request.sortDescriptors = [NSSortDescriptor(key: "name", ascending: true)]

        guard let results = try? persistence.viewContext.fetch(request) else {
            return []
        }

        return results.compactMap { cached -> Job? in
            guard let jsonData = cached.value(forKey: "jsonData") as? Data else {
                return nil
            }
            return try? JSONDecoder().decode(Job.self, from: jsonData)
        }
    }

    /// Get cached tasks when offline
    func getCachedTasks() -> [SMTask] {
        let request = NSFetchRequest<NSManagedObject>(entityName: "CachedTask")
        request.sortDescriptors = [NSSortDescriptor(key: "plannedEndDate", ascending: true)]

        guard let results = try? persistence.viewContext.fetch(request) else {
            return []
        }

        return results.compactMap { cached -> SMTask? in
            guard let jsonData = cached.value(forKey: "jsonData") as? Data else {
                return nil
            }
            return try? JSONDecoder().decode(SMTask.self, from: jsonData)
        }
    }

    // MARK: - Helpers

    private func updatePendingCount() {
        let request = NSFetchRequest<NSManagedObject>(entityName: "PendingSync")
        request.predicate = NSPredicate(format: "retryCount < 5")

        if let count = try? persistence.viewContext.count(for: request) {
            pendingCount = count
        }
    }

    /// Clear all cached data
    func clearCache() {
        let entities = ["CachedJob", "CachedTask", "CachedEmail", "PendingSync", "PendingPhotoUpload"]

        persistence.performBackgroundTask { context in
            for entity in entities {
                let request = NSFetchRequest<NSFetchRequestResult>(entityName: entity)
                let deleteRequest = NSBatchDeleteRequest(fetchRequest: request)
                try? context.execute(deleteRequest)
            }
            try? context.save()
        }

        pendingCount = 0
        lastSyncDate = nil
    }
}

// MARK: - Sync Action

enum SyncAction: String {
    case create
    case update
    case delete
    case start
    case complete
    case hold
}
