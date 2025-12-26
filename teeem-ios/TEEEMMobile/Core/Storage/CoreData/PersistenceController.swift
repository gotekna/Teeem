import CoreData
import Foundation

/// Core Data persistence controller for offline storage
class PersistenceController {
    static let shared = PersistenceController()

    let container: NSPersistentContainer

    var viewContext: NSManagedObjectContext {
        container.viewContext
    }

    init(inMemory: Bool = false) {
        // Create the model programmatically since we can't create .xcdatamodeld files
        let model = Self.createManagedObjectModel()
        container = NSPersistentContainer(name: "TEEEMMobile", managedObjectModel: model)

        if inMemory {
            container.persistentStoreDescriptions.first?.url = URL(fileURLWithPath: "/dev/null")
        }

        container.loadPersistentStores { description, error in
            if let error = error {
                print("Core Data failed to load: \(error.localizedDescription)")
            }
        }

        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    }

    // MARK: - Create Model Programmatically

    private static func createManagedObjectModel() -> NSManagedObjectModel {
        let model = NSManagedObjectModel()

        // CachedJob Entity
        let jobEntity = NSEntityDescription()
        jobEntity.name = "CachedJob"
        jobEntity.managedObjectClassName = "CachedJob"
        jobEntity.properties = [
            createAttribute(name: "id", type: .integer64AttributeType),
            createAttribute(name: "jobNumber", type: .stringAttributeType, optional: true),
            createAttribute(name: "name", type: .stringAttributeType, optional: true),
            createAttribute(name: "clientName", type: .stringAttributeType, optional: true),
            createAttribute(name: "status", type: .stringAttributeType, optional: true),
            createAttribute(name: "stage", type: .stringAttributeType, optional: true),
            createAttribute(name: "address", type: .stringAttributeType, optional: true),
            createAttribute(name: "suburb", type: .stringAttributeType, optional: true),
            createAttribute(name: "jsonData", type: .binaryDataAttributeType, optional: true),
            createAttribute(name: "lastSyncedAt", type: .dateAttributeType, optional: true),
            createAttribute(name: "isModifiedLocally", type: .booleanAttributeType)
        ]

        // CachedTask Entity
        let taskEntity = NSEntityDescription()
        taskEntity.name = "CachedTask"
        taskEntity.managedObjectClassName = "CachedTask"
        taskEntity.properties = [
            createAttribute(name: "id", type: .integer64AttributeType),
            createAttribute(name: "jobId", type: .integer64AttributeType),
            createAttribute(name: "name", type: .stringAttributeType, optional: true),
            createAttribute(name: "status", type: .stringAttributeType, optional: true),
            createAttribute(name: "trade", type: .stringAttributeType, optional: true),
            createAttribute(name: "plannedEndDate", type: .dateAttributeType, optional: true),
            createAttribute(name: "jsonData", type: .binaryDataAttributeType, optional: true),
            createAttribute(name: "lastSyncedAt", type: .dateAttributeType, optional: true),
            createAttribute(name: "isModifiedLocally", type: .booleanAttributeType)
        ]

        // CachedEmail Entity
        let emailEntity = NSEntityDescription()
        emailEntity.name = "CachedEmail"
        emailEntity.managedObjectClassName = "CachedEmail"
        emailEntity.properties = [
            createAttribute(name: "id", type: .integer64AttributeType),
            createAttribute(name: "subject", type: .stringAttributeType, optional: true),
            createAttribute(name: "fromAddress", type: .stringAttributeType, optional: true),
            createAttribute(name: "fromName", type: .stringAttributeType, optional: true),
            createAttribute(name: "snippet", type: .stringAttributeType, optional: true),
            createAttribute(name: "receivedAt", type: .dateAttributeType, optional: true),
            createAttribute(name: "isRead", type: .booleanAttributeType),
            createAttribute(name: "isStarred", type: .booleanAttributeType),
            createAttribute(name: "folderId", type: .integer64AttributeType),
            createAttribute(name: "jsonData", type: .binaryDataAttributeType, optional: true),
            createAttribute(name: "lastSyncedAt", type: .dateAttributeType, optional: true)
        ]

        // PendingSync Entity (for offline queue)
        let pendingSyncEntity = NSEntityDescription()
        pendingSyncEntity.name = "PendingSync"
        pendingSyncEntity.managedObjectClassName = "PendingSync"
        pendingSyncEntity.properties = [
            createAttribute(name: "id", type: .UUIDAttributeType),
            createAttribute(name: "entityType", type: .stringAttributeType), // job, task, email, photo
            createAttribute(name: "entityId", type: .integer64AttributeType),
            createAttribute(name: "action", type: .stringAttributeType), // create, update, delete
            createAttribute(name: "payload", type: .binaryDataAttributeType, optional: true),
            createAttribute(name: "createdAt", type: .dateAttributeType),
            createAttribute(name: "retryCount", type: .integer16AttributeType),
            createAttribute(name: "lastError", type: .stringAttributeType, optional: true),
            createAttribute(name: "priority", type: .integer16AttributeType)
        ]

        // PendingPhoto Entity (for photo upload queue)
        let pendingPhotoEntity = NSEntityDescription()
        pendingPhotoEntity.name = "PendingPhotoUpload"
        pendingPhotoEntity.managedObjectClassName = "PendingPhotoUpload"
        pendingPhotoEntity.properties = [
            createAttribute(name: "id", type: .UUIDAttributeType),
            createAttribute(name: "taskId", type: .integer64AttributeType),
            createAttribute(name: "photoType", type: .stringAttributeType),
            createAttribute(name: "latitude", type: .doubleAttributeType, optional: true),
            createAttribute(name: "longitude", type: .doubleAttributeType, optional: true),
            createAttribute(name: "takenAt", type: .dateAttributeType),
            createAttribute(name: "localImagePath", type: .stringAttributeType),
            createAttribute(name: "isUploading", type: .booleanAttributeType),
            createAttribute(name: "retryCount", type: .integer16AttributeType),
            createAttribute(name: "lastError", type: .stringAttributeType, optional: true)
        ]

        model.entities = [jobEntity, taskEntity, emailEntity, pendingSyncEntity, pendingPhotoEntity]
        return model
    }

    private static func createAttribute(name: String, type: NSAttributeType, optional: Bool = false) -> NSAttributeDescription {
        let attribute = NSAttributeDescription()
        attribute.name = name
        attribute.attributeType = type
        attribute.isOptional = optional

        // Set default values
        if type == .booleanAttributeType {
            attribute.defaultValue = false
        } else if type == .integer16AttributeType || type == .integer64AttributeType {
            attribute.defaultValue = 0
        }

        return attribute
    }

    // MARK: - Save Context

    func save() {
        let context = viewContext
        if context.hasChanges {
            do {
                try context.save()
            } catch {
                print("Core Data save error: \(error)")
            }
        }
    }

    // MARK: - Background Context

    func newBackgroundContext() -> NSManagedObjectContext {
        let context = container.newBackgroundContext()
        context.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
        return context
    }

    func performBackgroundTask(_ block: @escaping (NSManagedObjectContext) -> Void) {
        container.performBackgroundTask(block)
    }
}

// MARK: - Preview Helper

extension PersistenceController {
    static var preview: PersistenceController = {
        let controller = PersistenceController(inMemory: true)
        return controller
    }()
}
