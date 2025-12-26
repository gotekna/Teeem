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
        print("Loading emails from email_warehouse...")
        do {
            emails = try await apiClient.get("email_warehouse?my_emails=true")
            print("SUCCESS: Loaded \(emails.count) emails")
        } catch {
            self.error = error.localizedDescription
            print("FAILED: Email load error: \(error)")
        }
        isLoading = false
    }

    func loadFolders() async {
        do {
            folders = try await apiClient.get("emails/folders")
        } catch {}
    }
}
