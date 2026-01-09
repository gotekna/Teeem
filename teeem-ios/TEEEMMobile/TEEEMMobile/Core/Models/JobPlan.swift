import Foundation
import SwiftUI

struct JobPlan: Identifiable, Codable, Hashable {
    let id: Int
    let jobId: Int
    let displayName: String
    let planType: PlanType?
    let currentRevision: PlanRevision?
    let revisionCount: Int

    var thumbnailURL: URL? {
        guard let urlString = currentRevision?.thumbnailUrl else { return nil }
        return URL(string: urlString)
    }

    var microThumbnailData: Data? {
        guard let base64 = currentRevision?.microThumbnailBase64 else { return nil }
        return Data(base64Encoded: base64)
    }

    var fileName: String {
        currentRevision?.fileName ?? displayName
    }

    var fileSize: String {
        currentRevision?.formattedFileSize ?? ""
    }

    var revisionLabel: String {
        currentRevision?.revisionLabel ?? ""
    }

    var categoryName: String {
        planType?.categoryName ?? "Uncategorized"
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case jobId = "job_id"
        case displayName = "display_name"
        case planType = "plan_type"
        case currentRevision = "current_revision"
        case revisionCount = "revision_count"
    }
}

struct PlanType: Codable, Hashable {
    let id: Int
    let code: String
    let name: String
    let categoryName: String?

    private enum CodingKeys: String, CodingKey {
        case id, code, name
        case categoryName = "category_name"
    }
}

struct PlanRevision: Codable, Hashable {
    let id: Int
    let revision: String
    let revisionLabel: String
    let revisionDate: String?
    let hasFile: Bool
    let fileName: String?
    let fileSize: Int?
    let formattedFileSize: String?
    let thumbnailUrl: String?
    let microThumbnailBase64: String?
    let sharepointWebUrl: String?
    let sharepointFileId: String?

    private enum CodingKeys: String, CodingKey {
        case id, revision
        case revisionLabel = "revision_label"
        case revisionDate = "revision_date"
        case hasFile = "has_file"
        case fileName = "file_name"
        case fileSize = "file_size"
        case formattedFileSize = "formatted_file_size"
        case thumbnailUrl = "thumbnail_url"
        case microThumbnailBase64 = "micro_thumbnail_base64"
        case sharepointWebUrl = "sharepoint_web_url"
        case sharepointFileId = "sharepoint_file_id"
    }
}
