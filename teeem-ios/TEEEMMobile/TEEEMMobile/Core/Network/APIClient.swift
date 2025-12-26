import Foundation

class APIClient {
    static let shared = APIClient()
    private let baseURL = "https://teeemlive-ce8e2660a615.herokuapp.com/api/v1"
    private let session = URLSession.shared
    private let authManager = AuthManager.shared
    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        // Handle multiple date formats from Rails API
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        d.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)
            // Try ISO8601 with fractional seconds
            if let date = formatter.date(from: dateString) { return date }
            // Try ISO8601 without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: dateString) { return date }
            // Try simple date format
            let simple = DateFormatter()
            simple.dateFormat = "yyyy-MM-dd"
            if let date = simple.date(from: dateString) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode date")
        }
        return d
    }()

    func get<T: Decodable>(_ path: String) async throws -> T {
        let url = URL(string: "\(baseURL)/\(path)")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = authManager.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
            print("API Error: HTTP \((response as? HTTPURLResponse)?.statusCode ?? 0)")
            throw APIError.requestFailed
        }
        // Debug: print raw response
        if let jsonString = String(data: data, encoding: .utf8) {
            print("API Response for \(path): \(jsonString.prefix(500))...")
        }
        // Try different response formats
        if let wrapper = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            // Format 1: { "jobs": [...] } or { "contacts": [...] } etc
            let resourceName = path.split(separator: "?").first.map(String.init) ?? path
            if let items = wrapper[resourceName] ?? wrapper["data"] {
                let itemsJSON = try JSONSerialization.data(withJSONObject: items)
                do {
                    return try decoder.decode(T.self, from: itemsJSON)
                } catch {
                    print("Decode error for \(path) (\(resourceName)): \(error)")
                    throw error
                }
            }
            // Format 2: { "data": { "entries": [...] } } (Foundation API)
            if let dataObj = wrapper["data"] as? [String: Any],
               let entries = dataObj["entries"] {
                let entriesJSON = try JSONSerialization.data(withJSONObject: entries)
                do {
                    return try decoder.decode(T.self, from: entriesJSON)
                } catch {
                    print("Decode error for \(path) entries: \(error)")
                    throw error
                }
            }
        }
        return try decoder.decode(T.self, from: data)
    }

    func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        let url = URL(string: "\(baseURL)/\(path)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        if let token = authManager.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
            throw APIError.requestFailed
        }
        return try decoder.decode(T.self, from: data)
    }

    func startTask(id: Int) async throws -> SMTask {
        try await post("sm_tasks/\(id)/start", body: EmptyBody())
    }

    func completeTask(id: Int, notes: String?) async throws -> SMTask {
        try await post("sm_tasks/\(id)/complete", body: ["notes": notes ?? ""])
    }

    func holdTask(id: Int, reason: String) async throws -> SMTask {
        try await post("sm_tasks/\(id)/hold", body: ["reason": reason])
    }

    func uploadPhoto(taskId: Int, imageData: Data, photoType: String, latitude: Double?, longitude: Double?) async throws -> Photo {
        let url = URL(string: "\(baseURL)/sm_field/upload_photo")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        if let token = authManager.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"photo\"; filename=\"photo.jpg\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"task_id\"\r\n\r\n\(taskId)\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body
        let (data, _) = try await session.data(for: request)
        return try decoder.decode(Photo.self, from: data)
    }
}

enum APIError: Error {
    case requestFailed, unauthorized, invalidResponse
}

struct EmptyBody: Encodable {}
