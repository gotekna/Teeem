import Foundation

struct Photo: Codable, Identifiable {
    let id: Int
    let url: String?
    let thumbnailUrl: String?
    let photoType: String?
    let latitude: Double?
    let longitude: Double?
    let takenAt: Date?
    let taskId: Int?

    enum CodingKeys: String, CodingKey {
        case id, url, latitude, longitude
        case thumbnailUrl = "thumbnail_url"
        case photoType = "photo_type"
        case takenAt = "taken_at"
        case taskId = "task_id"
    }
}
