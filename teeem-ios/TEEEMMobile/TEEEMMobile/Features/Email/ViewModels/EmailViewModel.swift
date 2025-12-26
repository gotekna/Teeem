import Foundation
import Combine

@MainActor
class EmailViewModel: ObservableObject {
    @Published var emails: [Email] = []
    @Published var folders: [EmailFolder] = []
    @Published var isLoading = false
    @Published var error: String?

    private let apiClient = APIClient.shared

    func loadEmails() async {
        isLoading = true
        do {
            emails = try await apiClient.get("emails")
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func loadFolders() async {
        do {
            folders = try await apiClient.get("emails/folders")
        } catch {}
    }
}
