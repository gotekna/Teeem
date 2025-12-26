import Foundation

enum Endpoint {
    // Auth
    case login
    case me

    // Jobs
    case jobs
    case job(id: Int)
    case updateJobStage(id: Int)

    // Tasks
    case tasks
    case myTasks
    case task(id: Int)
    case startTask(id: Int)
    case completeTask(id: Int)
    case holdTask(id: Int)
    case releaseHold(id: Int)

    // Photos
    case uploadPhoto
    case taskPhotos(taskId: Int)
    case deletePhoto(id: Int)

    // Documents
    case documents
    case document(id: Int)

    // Contacts
    case contacts
    case contact(id: Int)

    // Notifications
    case notifications
    case unreadCount
    case markRead(id: Int)
    case markAllRead

    // Field Operations
    case checkIn
    case voiceNote

    var path: String {
        switch self {
        // Auth
        case .login:
            return "auth/login"
        case .me:
            return "auth/me"

        // Jobs
        case .jobs:
            return "jobs"
        case .job(let id):
            return "jobs/\(id)"
        case .updateJobStage(let id):
            return "jobs/\(id)/stage"

        // Tasks
        case .tasks:
            return "sm_tasks"
        case .myTasks:
            return "sm_tasks?mine=true"
        case .task(let id):
            return "sm_tasks/\(id)"
        case .startTask(let id):
            return "sm_tasks/\(id)/start"
        case .completeTask(let id):
            return "sm_tasks/\(id)/complete"
        case .holdTask(let id):
            return "sm_tasks/\(id)/hold"
        case .releaseHold(let id):
            return "sm_tasks/\(id)/release_hold"

        // Photos
        case .uploadPhoto:
            return "sm_field/upload_photo"
        case .taskPhotos(let taskId):
            return "sm_tasks/\(taskId)/photos"
        case .deletePhoto(let id):
            return "sm_field/photos/\(id)"

        // Documents
        case .documents:
            return "documents"
        case .document(let id):
            return "documents/\(id)"

        // Contacts
        case .contacts:
            return "contacts"
        case .contact(let id):
            return "contacts/\(id)"

        // Notifications
        case .notifications:
            return "notifications"
        case .unreadCount:
            return "notifications/unread_count"
        case .markRead(let id):
            return "notifications/\(id)/mark_read"
        case .markAllRead:
            return "notifications/mark_all_read"

        // Field Operations
        case .checkIn:
            return "sm_field/checkin"
        case .voiceNote:
            return "sm_field/record_voice_note"
        }
    }

    var method: String {
        switch self {
        case .login, .startTask, .completeTask, .holdTask, .releaseHold,
             .uploadPhoto, .checkIn, .voiceNote, .markRead, .markAllRead:
            return "POST"
        case .updateJobStage:
            return "PATCH"
        case .deletePhoto:
            return "DELETE"
        default:
            return "GET"
        }
    }
}
