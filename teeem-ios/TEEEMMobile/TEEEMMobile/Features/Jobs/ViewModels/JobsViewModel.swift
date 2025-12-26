import Foundation

@MainActor
class JobsViewModel: ObservableObject {
    @Published var jobs: [Job] = []
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage = ""

    private let apiClient = APIClient.shared

    func loadJobs() async {
        isLoading = true
        do {
            jobs = try await apiClient.get("jobs")
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
        isLoading = false
    }
}
