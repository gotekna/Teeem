import Foundation
import SwiftUI

struct SMTask: Codable, Identifiable, Hashable {
    let id: Int
    let name: String?
    let description: String?
    let status: TaskStatus?
    let trade: String?
    let jobId: Int?
    let jobNumber: String?
    let jobName: String?
    let plannedStartDate: Date?
    let plannedEndDate: Date?
    let actualStartDate: Date?
    let actualEndDate: Date?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case id, name, description, status, trade, notes
        case jobId = "job_id"
        case jobNumber = "job_number"
        case jobName = "job_name"
        case plannedStartDate = "planned_start_date"
        case plannedEndDate = "planned_end_date"
        case actualStartDate = "actual_start_date"
        case actualEndDate = "actual_end_date"
    }

    var displayName: String { name ?? "Task #\(id)" }
    var jobDisplayName: String? {
        if let num = jobNumber, let jName = jobName { return "\(num) - \(jName)" }
        return jobName ?? jobNumber
    }

    var isOverdue: Bool {
        guard let dueDate = plannedEndDate else { return false }
        return dueDate < Date() && status != .completed
    }

    var isDueSoon: Bool {
        guard let dueDate = plannedEndDate else { return false }
        let threeDays = Calendar.current.date(byAdding: .day, value: 3, to: Date())!
        return dueDate <= threeDays && dueDate >= Date()
    }

    var formattedDueDate: String? {
        guard let date = plannedEndDate else { return nil }
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
