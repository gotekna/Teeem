import Foundation
import SwiftUI

struct PhotoFolder: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let childCount: Int
    let webUrl: String?

    var displayName: String {
        // Remove number prefix like "01 SITE" -> "Site"
        let parts = name.split(separator: " ", maxSplits: 1)
        if parts.count > 1, parts[0].allSatisfy({ $0.isNumber }) {
            return String(parts[1]).capitalized
        }
        return name.capitalized
    }

    var icon: String {
        let lowered = name.lowercased()
        if lowered.contains("site") { return "mappin.and.ellipse" }
        if lowered.contains("slab") { return "square.grid.3x3.fill" }
        if lowered.contains("frame") { return "square.dashed" }
        if lowered.contains("enclosed") { return "house.fill" }
        if lowered.contains("fixing") { return "wrench.and.screwdriver.fill" }
        if lowered.contains("practical") || lowered.contains("pc") { return "checkmark.seal.fill" }
        if lowered.contains("supervisor") { return "person.badge.shield.checkmark.fill" }
        if lowered.contains("client") { return "person.fill" }
        return "photo.fill"
    }

    var color: Color {
        let lowered = name.lowercased()
        if lowered.contains("site") { return .orange }
        if lowered.contains("slab") { return .gray }
        if lowered.contains("frame") { return .brown }
        if lowered.contains("enclosed") { return .blue }
        if lowered.contains("fixing") { return .purple }
        if lowered.contains("practical") || lowered.contains("pc") { return .green }
        if lowered.contains("supervisor") { return .indigo }
        if lowered.contains("client") { return .pink }
        return .gray
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case childCount = "child_count"
        case webUrl = "web_url"
    }
}

struct PhotoFile: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let size: Int?
    let webUrl: String?
    let thumbnailUrl: String?
    let createdAt: String?

    var formattedSize: String {
        guard let size = size else { return "" }
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(size))
    }

    var isImage: Bool {
        let ext = (name as NSString).pathExtension.lowercased()
        return ["jpg", "jpeg", "png", "gif", "heic", "webp"].contains(ext)
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case size
        case webUrl = "web_url"
        case thumbnailUrl = "thumbnail_url"
        case createdAt = "created_at"
    }
}

struct SharePointFolderResponse: Codable {
    let folders: [PhotoFolder]
    let files: [PhotoFile]?
    let currentFolder: FolderInfo?

    private enum CodingKeys: String, CodingKey {
        case folders
        case files
        case currentFolder = "current_folder"
    }
}

struct FolderInfo: Codable {
    let id: String
    let name: String
}
