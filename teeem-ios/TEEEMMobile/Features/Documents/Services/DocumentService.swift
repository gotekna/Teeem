import Foundation
import UIKit

actor DocumentService {
    static let shared = DocumentService()

    private let apiClient = APIClient.shared

    func uploadDocument(_ document: ScannedDocument) async throws -> UploadedDocument {
        guard let pdfData = document.pdfData else {
            throw DocumentError.pdfGenerationFailed
        }

        // Create multipart form data request
        let boundary = UUID().uuidString
        var body = Data()

        // Add job_id
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"job_id\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(document.jobId)\r\n".data(using: .utf8)!)

        // Add title
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"title\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(document.title)\r\n".data(using: .utf8)!)

        // Add PDF file
        let filename = "\(document.title.replacingOccurrences(of: " ", with: "_")).pdf"
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: application/pdf\r\n\r\n".data(using: .utf8)!)
        body.append(pdfData)
        body.append("\r\n".data(using: .utf8)!)

        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        // TODO: Implement actual API upload
        // For now, return a mock response
        return UploadedDocument(
            id: Int.random(in: 1...10000),
            title: document.title,
            jobId: document.jobId,
            fileUrl: "https://example.com/\(filename)",
            pageCount: document.images.count,
            uploadedAt: Date()
        )
    }

    func getJobDocuments(jobId: Int) async throws -> [UploadedDocument] {
        // TODO: Implement API call to get job documents
        return []
    }

    func deleteDocument(id: Int) async throws {
        // TODO: Implement API call to delete document
    }
}

// MARK: - Document Models

struct UploadedDocument: Identifiable, Codable {
    let id: Int
    let title: String
    let jobId: Int
    let fileUrl: String
    let pageCount: Int
    let uploadedAt: Date
}

enum DocumentError: Error, LocalizedError {
    case pdfGenerationFailed
    case uploadFailed(String)
    case notFound

    var errorDescription: String? {
        switch self {
        case .pdfGenerationFailed:
            return "Failed to generate PDF from scanned images."
        case .uploadFailed(let message):
            return "Upload failed: \(message)"
        case .notFound:
            return "Document not found."
        }
    }
}
