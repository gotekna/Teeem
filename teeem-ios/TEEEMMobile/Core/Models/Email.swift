import Foundation
import SwiftUI

struct Email: Codable, Identifiable, Equatable {
    let id: Int
    let subject: String?
    let snippet: String?
    let body: String?
    let htmlBody: String?
    let fromAddress: String?
    let fromName: String?
    let toAddresses: [String]?
    let ccAddresses: [String]?
    let receivedAt: Date?
    let sentAt: Date?
    let isRead: Bool?
    let isStarred: Bool?
    let isDraft: Bool?
    let isSent: Bool?
    let hasAttachments: Bool?
    let attachmentCount: Int?
    let folderId: Int?
    let folderName: String?
    let threadId: String?
    let jobId: Int?
    let jobName: String?
    let contactId: Int?
    let contactName: String?
    let createdAt: Date?
    let updatedAt: Date?

    var displaySubject: String {
        subject ?? "(No Subject)"
    }

    var displayFrom: String {
        if let name = fromName, !name.isEmpty {
            return name
        }
        return fromAddress ?? "Unknown"
    }

    var displaySnippet: String {
        snippet ?? body?.prefix(100).description ?? ""
    }

    var isUnread: Bool {
        !(isRead ?? true)
    }

    var formattedDate: String {
        guard let date = receivedAt ?? sentAt ?? createdAt else { return "" }

        let calendar = Calendar.current
        let formatter = DateFormatter()

        if calendar.isDateInToday(date) {
            formatter.dateFormat = "h:mm a"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else if calendar.isDate(date, equalTo: Date(), toGranularity: .weekOfYear) {
            formatter.dateFormat = "EEEE" // Day name
        } else if calendar.isDate(date, equalTo: Date(), toGranularity: .year) {
            formatter.dateFormat = "MMM d"
        } else {
            formatter.dateFormat = "MMM d, yyyy"
        }

        return formatter.string(from: date)
    }

    var senderInitials: String {
        let name = fromName ?? fromAddress ?? "?"
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            return "\(parts[0].prefix(1))\(parts[1].prefix(1))".uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }

    var senderColor: Color {
        // Generate consistent color based on sender
        let hash = abs((fromAddress ?? "").hashValue)
        let colors: [Color] = [.blue, .green, .orange, .purple, .pink, .teal, .indigo, .mint]
        return colors[hash % colors.count]
    }
}

// MARK: - Email Folder

struct EmailFolder: Codable, Identifiable, Equatable {
    let id: Int
    let name: String
    let type: FolderType?
    let unreadCount: Int?
    let totalCount: Int?

    var icon: String {
        switch type {
        case .inbox:
            return "tray.fill"
        case .sent:
            return "paperplane.fill"
        case .drafts:
            return "doc.fill"
        case .trash:
            return "trash.fill"
        case .spam:
            return "xmark.shield.fill"
        case .archive:
            return "archivebox.fill"
        case .starred:
            return "star.fill"
        default:
            return "folder.fill"
        }
    }
}

enum FolderType: String, Codable {
    case inbox
    case sent
    case drafts
    case trash
    case spam
    case archive
    case starred
    case custom
}

// MARK: - Email Attachment

struct EmailAttachment: Codable, Identifiable, Equatable {
    let id: Int
    let filename: String?
    let contentType: String?
    let size: Int?
    let url: String?

    var displayName: String {
        filename ?? "Attachment"
    }

    var formattedSize: String {
        guard let bytes = size else { return "" }

        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(bytes))
    }

    var icon: String {
        guard let contentType = contentType?.lowercased() else { return "doc" }

        if contentType.contains("pdf") {
            return "doc.fill"
        } else if contentType.contains("image") {
            return "photo"
        } else if contentType.contains("video") {
            return "video"
        } else if contentType.contains("audio") {
            return "waveform"
        } else if contentType.contains("spreadsheet") || contentType.contains("excel") {
            return "tablecells"
        } else if contentType.contains("word") || contentType.contains("document") {
            return "doc.text"
        } else if contentType.contains("zip") || contentType.contains("compressed") {
            return "doc.zipper"
        }

        return "doc"
    }
}

// MARK: - Compose Email

struct ComposeEmail {
    var to: [String] = []
    var cc: [String] = []
    var bcc: [String] = []
    var subject: String = ""
    var body: String = ""
    var replyToId: Int?
    var forwardFromId: Int?
    var jobId: Int?

    var isValid: Bool {
        !to.isEmpty && to.allSatisfy { $0.contains("@") }
    }
}
