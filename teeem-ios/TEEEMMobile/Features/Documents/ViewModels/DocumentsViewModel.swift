import SwiftUI

@MainActor
class DocumentsViewModel: ObservableObject {
    @Published var documents: [UploadedDocument] = []
    @Published var pendingDocuments: [ScannedDocument] = []
    @Published var isLoading = false
    @Published var error: String?

    private let documentService = DocumentService.shared

    func loadDocuments(jobId: Int) async {
        isLoading = true
        defer { isLoading = false }

        do {
            documents = try await documentService.getJobDocuments(jobId: jobId)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func uploadDocument(_ document: ScannedDocument) {
        pendingDocuments.append(document)

        Task {
            do {
                let uploaded = try await documentService.uploadDocument(document)
                documents.insert(uploaded, at: 0)
                pendingDocuments.removeAll { $0.id == document.id }
            } catch {
                self.error = error.localizedDescription
                // Keep in pending for retry
            }
        }
    }

    func deleteDocument(id: Int) async {
        do {
            try await documentService.deleteDocument(id: id)
            documents.removeAll { $0.id == id }
        } catch {
            self.error = error.localizedDescription
        }
    }
}
