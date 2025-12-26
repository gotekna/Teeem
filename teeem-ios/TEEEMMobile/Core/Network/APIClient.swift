import Foundation

actor APIClient {
    static let shared = APIClient()

    private let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        #if DEBUG
        self.baseURL = URL(string: "http://localhost:3001/api/v1")!
        #else
        self.baseURL = URL(string: "https://teeemlive-ce8e2660a615.herokuapp.com/api/v1")!
        #endif

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 300
        self.session = URLSession(configuration: config)

        self.decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601

        self.encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
    }

    // MARK: - Authentication

    func login(email: String, password: String) async throws -> LoginResponse {
        let body = ["email": email, "password": password]
        return try await post(endpoint: .login, body: body)
    }

    func getCurrentUser() async throws -> User {
        let response: UserResponse = try await get(endpoint: .me)
        return response.user
    }

    // MARK: - Jobs

    func getJobs() async throws -> [Job] {
        let response: JobsResponse = try await get(endpoint: .jobs)
        return response.data
    }

    func getJob(id: Int) async throws -> Job {
        let response: JobResponse = try await get(endpoint: .job(id: id))
        return response.data
    }

    // MARK: - Tasks

    func getMyTasks() async throws -> [SMTask] {
        let response: TasksResponse = try await get(endpoint: .myTasks)
        return response.data
    }

    func getTask(id: Int) async throws -> SMTask {
        let response: TaskResponse = try await get(endpoint: .task(id: id))
        return response.data
    }

    func startTask(id: Int) async throws -> SMTask {
        let response: TaskResponse = try await post(endpoint: .startTask(id: id), body: EmptyBody())
        return response.data
    }

    func completeTask(id: Int, notes: String? = nil) async throws -> SMTask {
        var body: [String: Any] = [:]
        if let notes = notes {
            body["completion_notes"] = notes
        }
        let response: TaskResponse = try await post(endpoint: .completeTask(id: id), body: body)
        return response.data
    }

    func holdTask(id: Int, reason: String) async throws -> SMTask {
        let body = ["hold_reason": reason]
        let response: TaskResponse = try await post(endpoint: .holdTask(id: id), body: body)
        return response.data
    }

    // MARK: - Photos

    func uploadPhoto(taskId: Int, imageData: Data, photoType: String, latitude: Double?, longitude: Double?) async throws -> Photo {
        let endpoint = Endpoint.uploadPhoto
        var request = try makeRequest(endpoint: endpoint)
        request.httpMethod = "POST"

        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()

        // Add task_id
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"task_id\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(taskId)\r\n".data(using: .utf8)!)

        // Add photo_type
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"photo_type\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(photoType)\r\n".data(using: .utf8)!)

        // Add location if available
        if let lat = latitude, let lon = longitude {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"latitude\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(lat)\r\n".data(using: .utf8)!)

            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"longitude\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(lon)\r\n".data(using: .utf8)!)
        }

        // Add image file
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"photo\"; filename=\"photo.jpg\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n".data(using: .utf8)!)

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)

        let photoResponse = try decoder.decode(PhotoResponse.self, from: data)
        return photoResponse.data
    }

    func getTaskPhotos(taskId: Int) async throws -> [Photo] {
        let response: PhotosResponse = try await get(endpoint: .taskPhotos(taskId: taskId))
        return response.data
    }

    // MARK: - Private Helpers

    private func get<T: Decodable>(endpoint: Endpoint) async throws -> T {
        var request = try makeRequest(endpoint: endpoint)
        request.httpMethod = "GET"

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)

        return try decoder.decode(T.self, from: data)
    }

    private func post<T: Decodable, B: Encodable>(endpoint: Endpoint, body: B) async throws -> T {
        var request = try makeRequest(endpoint: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)

        return try decoder.decode(T.self, from: data)
    }

    private func post<T: Decodable>(endpoint: Endpoint, body: [String: Any]) async throws -> T {
        var request = try makeRequest(endpoint: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)

        return try decoder.decode(T.self, from: data)
    }

    private func makeRequest(endpoint: Endpoint) throws -> URLRequest {
        let url = baseURL.appendingPathComponent(endpoint.path)
        var request = URLRequest(url: url)

        if let token = AuthManager.shared.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        return request
    }

    private func validateResponse(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        case 500...599:
            throw APIError.serverError
        default:
            throw APIError.unknown(statusCode: httpResponse.statusCode)
        }
    }
}

// MARK: - Helper Types

struct EmptyBody: Encodable {}

enum APIError: Error, LocalizedError {
    case invalidResponse
    case unauthorized
    case forbidden
    case notFound
    case serverError
    case unknown(statusCode: Int)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from server"
        case .unauthorized:
            return "Session expired. Please log in again."
        case .forbidden:
            return "You don't have permission to perform this action."
        case .notFound:
            return "The requested resource was not found."
        case .serverError:
            return "Server error. Please try again later."
        case .unknown(let code):
            return "Unexpected error (code: \(code))"
        }
    }
}

// MARK: - Response Types

struct LoginResponse: Decodable {
    let success: Bool
    let token: String
    let user: User
}

struct UserResponse: Decodable {
    let success: Bool
    let user: User
}

struct JobsResponse: Decodable {
    let success: Bool
    let data: [Job]
}

struct JobResponse: Decodable {
    let success: Bool
    let data: Job
}

struct TasksResponse: Decodable {
    let success: Bool
    let data: [SMTask]
}

struct TaskResponse: Decodable {
    let success: Bool
    let data: SMTask
}

struct PhotosResponse: Decodable {
    let success: Bool
    let data: [Photo]
}

struct PhotoResponse: Decodable {
    let success: Bool
    let data: Photo
}
