import Foundation

struct Photo: Codable, Identifiable, Equatable {
    let id: Int
    let taskId: Int?
    let jobId: Int?
    let photoType: PhotoType?
    let url: String?
    let thumbnailUrl: String?
    let mediumUrl: String?
    let latitude: Double?
    let longitude: Double?
    let takenAt: Date?
    let uploadedById: Int?
    let uploadedByName: String?
    let notes: String?
    let createdAt: Date?
    let updatedAt: Date?

    var displayUrl: String? {
        mediumUrl ?? url
    }

    var hasLocation: Bool {
        latitude != nil && longitude != nil
    }

    var formattedDate: String? {
        guard let date = takenAt ?? createdAt else { return nil }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

enum PhotoType: String, Codable, CaseIterable {
    case completion = "completion"
    case progress = "progress"
    case issue = "issue"
    case before = "before"
    case after = "after"
    case general = "general"

    var displayName: String {
        switch self {
        case .completion:
            return "Completion"
        case .progress:
            return "Progress"
        case .issue:
            return "Issue"
        case .before:
            return "Before"
        case .after:
            return "After"
        case .general:
            return "General"
        }
    }

    var iconName: String {
        switch self {
        case .completion:
            return "checkmark.circle"
        case .progress:
            return "clock"
        case .issue:
            return "exclamationmark.triangle"
        case .before:
            return "arrow.left.circle"
        case .after:
            return "arrow.right.circle"
        case .general:
            return "photo"
        }
    }
}
