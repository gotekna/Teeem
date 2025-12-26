import Foundation
import SwiftUI

struct Email: Codable, Identifiable, Hashable {
    let id: Int
    let subject: String?
    let from: String?
    let to: String?
    let body: String?
    let snippet: String?
    let receivedAt: Date?
    let isRead: Bool?
    let isStarred: Bool?
    let hasAttachments: Bool?
    let folderId: Int?

    enum CodingKeys: String, CodingKey {
        case id, subject, from, to, body, snippet
        case receivedAt = "received_at"
        case isRead = "is_read"
        case isStarred = "is_starred"
        case hasAttachments = "has_attachments"
        case folderId = "folder_id"
    }

    var displaySubject: String { subject ?? "(No Subject)" }
    var displayFrom: String { from ?? "Unknown" }
    var displaySnippet: String { snippet ?? body ?? "" }
    var isUnread: Bool { !(isRead ?? true) }

    var senderInitials: String {
        let parts = displayFrom.split(separator: " ")
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return String(displayFrom.prefix(2)).uppercased()
    }

    var senderColor: Color {
        let colors: [Color] = [.blue, .green, .orange, .purple, .red, .pink]
        return colors[abs(displayFrom.hashValue) % colors.count]
    }

    var formattedDate: String {
        guard let date = receivedAt else { return "" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

struct EmailFolder: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let unreadCount: Int?

    var icon: String {
        switch name.lowercased() {
        case "inbox": return "tray.fill"
        case "sent": return "paperplane.fill"
        case "drafts": return "doc.fill"
        case "trash": return "trash.fill"
        case "archive": return "archivebox.fill"
        default: return "folder.fill"
        }
    }
}
