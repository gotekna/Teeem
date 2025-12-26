import Foundation
import SwiftUI

struct SMTask: Codable, Identifiable, Equatable {
    let id: Int
    let jobId: Int?
    let name: String?
    let description: String?
    let status: TaskStatus?
    let priority: String?
    let trade: String?
    let assignedUserId: Int?
    let assignedUserName: String?
    let plannedStartDate: Date?
    let plannedEndDate: Date?
    let actualStartDate: Date?
    let actualEndDate: Date?
    let durationDays: Int?
    let holdReason: String?
    let completionNotes: String?
    let sequence: Int?
    let jobName: String?
    let jobNumber: String?
    let createdAt: Date?
    let updatedAt: Date?

    var displayName: String {
        name ?? "Task #\(id)"
    }

    var jobDisplayName: String? {
        if let number = jobNumber, let name = jobName {
            return "\(number) - \(name)"
        } else if let name = jobName {
            return name
        } else if let number = jobNumber {
            return number
        }
        return nil
    }

    var isOverdue: Bool {
        guard let endDate = plannedEndDate, status != .completed else { return false }
        return endDate < Date()
    }

    var isDueSoon: Bool {
        guard let endDate = plannedEndDate, status != .completed else { return false }
        let twoDaysFromNow = Calendar.current.date(byAdding: .day, value: 2, to: Date())!
        return endDate <= twoDaysFromNow && endDate >= Date()
    }

    var dueStatusColor: Color {
        if isOverdue {
            return .red
        } else if isDueSoon {
            return .orange
        } else {
            return .primary
        }
    }

    var formattedDueDate: String? {
        guard let date = plannedEndDate else { return nil }
        let formatter = DateFormatter()

        if Calendar.current.isDateInToday(date) {
            return "Today"
        } else if Calendar.current.isDateInTomorrow(date) {
            return "Tomorrow"
        } else {
            formatter.dateStyle = .medium
            return formatter.string(from: date)
        }
    }
}

enum TaskStatus: String, Codable, CaseIterable {
    case notStarted = "not_started"
    case inProgress = "in_progress"
    case onHold = "on_hold"
    case completed = "completed"
    case cancelled = "cancelled"

    var displayName: String {
        switch self {
        case .notStarted:
            return "Not Started"
        case .inProgress:
            return "In Progress"
        case .onHold:
            return "On Hold"
        case .completed:
            return "Completed"
        case .cancelled:
            return "Cancelled"
        }
    }

    var color: Color {
        switch self {
        case .notStarted:
            return .gray
        case .inProgress:
            return .blue
        case .onHold:
            return .orange
        case .completed:
            return .green
        case .cancelled:
            return .red
        }
    }

    var iconName: String {
        switch self {
        case .notStarted:
            return "circle"
        case .inProgress:
            return "play.circle.fill"
        case .onHold:
            return "pause.circle.fill"
        case .completed:
            return "checkmark.circle.fill"
        case .cancelled:
            return "xmark.circle.fill"
        }
    }
}
