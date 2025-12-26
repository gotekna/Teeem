import Foundation
import SwiftUI

struct SMTask: Identifiable, Hashable {
    let id: Int
    let name: String?
    let description: String?
    let status: String?
    let trade: String?
    let constructionId: Int?
    let jobName: String?
    let startDate: String?
    let endDate: String?
    let durationDays: Int?
    let isOverdueFromApi: Bool?
    let daysUntilDue: Int?
    let assignedUserName: String?
    let isHoldTask: Bool?
    let holdReason: String?

    var displayName: String { name ?? "Task #\(id)" }

    var taskStatus: TaskStatus {
        TaskStatus(rawValue: status ?? "") ?? .notStarted
    }

    var jobDisplayName: String? { jobName }

    private var parsedEndDate: Date? {
        guard let dateStr = endDate else { return nil }
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: dateStr) { return date }
        let simple = DateFormatter()
        simple.dateFormat = "yyyy-MM-dd"
        return simple.date(from: dateStr)
    }

    var isOverdue: Bool {
        // Use API value if available, otherwise calculate
        if let apiValue = isOverdueFromApi { return apiValue }
        guard let dueDate = parsedEndDate else { return false }
        return dueDate < Date() && status != "completed"
    }

    var isDueSoon: Bool {
        if let days = daysUntilDue {
            return days >= 0 && days <= 3
        }
        guard let dueDate = parsedEndDate else { return false }
        let threeDays = Calendar.current.date(byAdding: .day, value: 3, to: Date())!
        return dueDate <= threeDays && dueDate >= Date()
    }

    var formattedDueDate: String? {
        guard let date = parsedEndDate else { return endDate }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    var dueStatusColor: Color {
        if isOverdue { return .red }
        if isDueSoon { return .orange }
        return .secondary
    }

    // Hashable - use id only
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: SMTask, rhs: SMTask) -> Bool {
        lhs.id == rhs.id
    }
}

extension SMTask: Decodable {
    private enum CodingKeys: String, CodingKey {
        case id, name, description, status, trade
        case constructionId = "construction_id"
        case jobName = "job_name"
        case startDate = "start_date"
        case endDate = "end_date"
        case durationDays = "duration_days"
        case isOverdueFromApi = "is_overdue"
        case daysUntilDue = "days_until_due"
        case assignedUserName = "assigned_user_name"
        case isHoldTask = "is_hold_task"
        case holdReason = "hold_reason"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        trade = try container.decodeIfPresent(String.self, forKey: .trade)
        constructionId = try container.decodeIfPresent(Int.self, forKey: .constructionId)
        jobName = try container.decodeIfPresent(String.self, forKey: .jobName)
        startDate = try container.decodeIfPresent(String.self, forKey: .startDate)
        endDate = try container.decodeIfPresent(String.self, forKey: .endDate)
        durationDays = try container.decodeIfPresent(Int.self, forKey: .durationDays)
        isOverdueFromApi = try container.decodeIfPresent(Bool.self, forKey: .isOverdueFromApi)
        daysUntilDue = try container.decodeIfPresent(Int.self, forKey: .daysUntilDue)
        assignedUserName = try container.decodeIfPresent(String.self, forKey: .assignedUserName)
        isHoldTask = try container.decodeIfPresent(Bool.self, forKey: .isHoldTask)
        holdReason = try container.decodeIfPresent(String.self, forKey: .holdReason)
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
