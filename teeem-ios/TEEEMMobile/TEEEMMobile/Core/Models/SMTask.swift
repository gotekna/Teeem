import Foundation
import SwiftUI

struct SMTask: Codable, Identifiable, Hashable {
    let id: Int
    let name: String?
    let description: String?
    let status: String?
    let trade: String?
    let jobId: Int?
    let jobNumber: String?
    let jobName: String?
    let plannedStartDate: String?  // Keep as string to avoid date parsing issues
    let plannedEndDate: String?
    let actualStartDate: String?
    let actualEndDate: String?
    let notes: String?

    var displayName: String { name ?? "Task #\(id)" }

    var taskStatus: TaskStatus {
        TaskStatus(rawValue: status ?? "") ?? .notStarted
    }
    var jobDisplayName: String? {
        if let num = jobNumber, let jName = jobName { return "\(num) - \(jName)" }
        return jobName ?? jobNumber
    }

    private var parsedEndDate: Date? {
        guard let dateStr = plannedEndDate else { return nil }
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: dateStr) { return date }
        let simple = DateFormatter()
        simple.dateFormat = "yyyy-MM-dd"
        return simple.date(from: dateStr)
    }

    var isOverdue: Bool {
        guard let dueDate = parsedEndDate else { return false }
        return dueDate < Date() && status != "completed"
    }

    var isDueSoon: Bool {
        guard let dueDate = parsedEndDate else { return false }
        let threeDays = Calendar.current.date(byAdding: .day, value: 3, to: Date())!
        return dueDate <= threeDays && dueDate >= Date()
    }

    var formattedDueDate: String? {
        guard let date = parsedEndDate else { return plannedEndDate }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    var dueStatusColor: Color {
        if isOverdue { return .red }
        if isDueSoon { return .orange }
        return .secondary
    }
}

enum TaskStatus: String, Codable {
    case notStarted = "not_started"
    case inProgress = "in_progress"
    case onHold = "on_hold"
    case completed = "completed"

    var displayName: String {
        switch self {
        case .notStarted: return "Not Started"
        case .inProgress: return "In Progress"
        case .onHold: return "On Hold"
        case .completed: return "Completed"
        }
    }

    var color: Color {
        switch self {
        case .notStarted: return .gray
        case .inProgress: return .blue
        case .onHold: return .orange
        case .completed: return .green
        }
    }
}
