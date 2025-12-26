import Foundation

class APIClient {
    static let shared = APIClient()
    private let baseURL = "https://teeemlive-ce8e2660a615.herokuapp.com/api/v1"
    private let session = URLSession.shared
    private let authManager = AuthManager.shared
    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
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
            throw APIError.requestFailed
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
