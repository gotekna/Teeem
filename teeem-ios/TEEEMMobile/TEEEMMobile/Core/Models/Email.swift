import Foundation
import SwiftUI

struct Email: Identifiable, Hashable {
    let id: Int
    let subject: String?
    let fromEmail: String?
    let toEmails: [String]?
    let bodyText: String?
    let bodyHtml: String?
    let receivedAt: String?  // Keep as string to avoid date parsing issues
    let hasAttachments: Bool?

    var displaySubject: String { subject ?? "(No Subject)" }
    var displayFrom: String { fromEmail ?? "Unknown" }
    var displaySnippet: String {
        let text = bodyText ?? ""
        return String(text.prefix(100))
    }
    var body: String? { bodyText }
    var isUnread: Bool { true }  // No is_read field in API

    var senderInitials: String {
        let email = displayFrom
        // Extract name from email if possible
        if let atIndex = email.firstIndex(of: "@") {
            let name = String(email[..<atIndex])
            let parts = name.split(separator: ".")
            if parts.count >= 2 {
                return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
            }
            return String(name.prefix(2)).uppercased()
        }
        return String(email.prefix(2)).uppercased()
    }

    var senderColor: Color {
        let colors: [Color] = [.blue, .green, .orange, .purple, .red, .pink]
        return colors[abs(displayFrom.hashValue) % colors.count]
    }

    var formattedDate: String {
        guard let dateStr = receivedAt else { return "" }
        // Try to parse ISO8601 date
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: dateStr) {
            let relFormatter = RelativeDateTimeFormatter()
            relFormatter.unitsStyle = .abbreviated
            return relFormatter.localizedString(for: date, relativeTo: Date())
        }
        return dateStr
    }
}

extension Email: Codable {
    private enum CodingKeys: String, CodingKey {
        case id, subject
        case fromEmail = "from_email"
        case toEmails = "to_emails"
        case bodyText = "body_text"
        case bodyHtml = "body_html"
        case receivedAt = "received_at"
        case hasAttachments = "has_attachments"
    }
}

struct EmailFolder: Codable, Identifiable, Hashable {
    let id: Int
    let name: String

    var icon: String {
        switch name.lowercased() {
        case "inbox": return "tray.fill"
        case "sent": return "paperplane.fill"
        case "drafts": return "doc.fill"
        case "trash": return "trash.fill"
        default: return "folder.fill"
        }
    }
}
