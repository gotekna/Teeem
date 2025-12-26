import Foundation

actor EmailService {
    static let shared = EmailService()

    private let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder

    private init() {
        #if DEBUG
        self.baseURL = URL(string: "http://localhost:3001/api/v1")!
        #else
        self.baseURL = URL(string: "https://teeemlive-ce8e2660a615.herokuapp.com/api/v1")!
        #endif

        self.session = URLSession.shared

        self.decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
    }

    // MARK: - Fetch Emails

    func getEmails(folderId: Int? = nil, page: Int = 1, perPage: Int = 50) async throws -> EmailListResponse {
        var urlString = "\(baseURL)/emails?page=\(page)&per_page=\(perPage)"
        if let folderId = folderId {
            urlString += "&folder_id=\(folderId)"
        }

        guard let url = URL(string: urlString) else {
            throw EmailError.invalidURL
        }

        var request = URLRequest(url: url)
        request.addAuthHeader()

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)

        return try decoder.decode(EmailListResponse.self, from: data)
    }

    func getEmail(id: Int) async throws -> Email {
        let url = baseURL.appendingPathComponent("emails/\(id)")
        var request = URLRequest(url: url)
        request.addAuthHeader()

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)

        let emailResponse = try decoder.decode(EmailResponse.self, from: data)
        return emailResponse.data
    }

    func getFolders() async throws -> [EmailFolder] {
        let url = baseURL.appendingPathComponent("emails/folders")
        var request = URLRequest(url: url)
        request.addAuthHeader()

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)

        let foldersResponse = try decoder.decode(FoldersResponse.self, from: data)
        return foldersResponse.data
    }

    // MARK: - Email Actions

    func markAsRead(id: Int) async throws {
        try await performAction(emailId: id, action: "mark_read")
    }

    func markAsUnread(id: Int) async throws {
        try await performAction(emailId: id, action: "mark_unread")
    }

    func star(id: Int) async throws {
        try await performAction(emailId: id, action: "star")
    }

    func unstar(id: Int) async throws {
        try await performAction(emailId: id, action: "unstar")
    }

    func archive(id: Int) async throws {
        try await performAction(emailId: id, action: "archive")
    }

    func delete(id: Int) async throws {
        let url = baseURL.appendingPathComponent("emails/\(id)")
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.addAuthHeader()

        let (_, response) = try await session.data(for: request)
        try validateResponse(response)
    }

    // MARK: - Send Email

    func sendEmail(_ compose: ComposeEmail) async throws -> Email {
        let url = baseURL.appendingPathComponent("emails")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addAuthHeader()

        let body: [String: Any] = [
            "to": compose.to,
            "cc": compose.cc,
            "bcc": compose.bcc,
            "subject": compose.subject,
            "body": compose.body,
            "job_id": compose.jobId as Any
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)

        let emailResponse = try decoder.decode(EmailResponse.self, from: data)
        return emailResponse.data
    }

    func reply(to emailId: Int, body: String) async throws -> Email {
        let url = baseURL.appendingPathComponent("emails/\(emailId)/reply")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addAuthHeader()

        let requestBody: [String: Any] = ["body": body]
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)

        let emailResponse = try decoder.decode(EmailResponse.self, from: data)
        return emailResponse.data
    }

    func forward(emailId: Int, to: [String], body: String) async throws -> Email {
        let url = baseURL.appendingPathComponent("emails/\(emailId)/forward")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addAuthHeader()

        let requestBody: [String: Any] = ["to": to, "body": body]
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)

        let emailResponse = try decoder.decode(EmailResponse.self, from: data)
        return emailResponse.data
    }

    // MARK: - Sync

    func syncEmails() async throws -> SyncResult {
        let url = baseURL.appendingPathComponent("emails/sync")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addAuthHeader()

        let (data, response) = try await session.data(for: request)
        try validateResponse(response)

        return try decoder.decode(SyncResult.self, from: data)
    }

    // MARK: - Helpers

    private func performAction(emailId: Int, action: String) async throws {
        let url = baseURL.appendingPathComponent("emails/\(emailId)/\(action)")
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.addAuthHeader()

        let (_, response) = try await session.data(for: request)
        try validateResponse(response)
    }

    private func validateResponse(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw EmailError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw EmailError.unauthorized
        case 404:
            throw EmailError.notFound
        case 500...599:
            throw EmailError.serverError
        default:
            throw EmailError.unknown(statusCode: httpResponse.statusCode)
        }
    }
}

// MARK: - URLRequest Extension

private extension URLRequest {
    mutating func addAuthHeader() {
        if let token = AuthManager.shared.token {
            self.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }
}

// MARK: - Response Types

struct EmailListResponse: Decodable {
    let success: Bool
    let data: [Email]
    let meta: EmailListMeta?
}

struct EmailListMeta: Decodable {
    let currentPage: Int?
    let totalPages: Int?
    let totalCount: Int?
    let perPage: Int?
}

struct EmailResponse: Decodable {
    let success: Bool
    let data: Email
}

struct FoldersResponse: Decodable {
    let success: Bool
    let data: [EmailFolder]
}

struct SyncResult: Decodable {
    let success: Bool
    let newEmails: Int?
    let updatedEmails: Int?
}

// MARK: - Errors

enum EmailError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case notFound
    case serverError
    case unknown(statusCode: Int)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .unauthorized:
            return "Session expired. Please log in again."
        case .notFound:
            return "Email not found."
        case .serverError:
            return "Server error. Please try again later."
        case .unknown(let code):
            return "Unexpected error (code: \(code))"
        }
    }
}
