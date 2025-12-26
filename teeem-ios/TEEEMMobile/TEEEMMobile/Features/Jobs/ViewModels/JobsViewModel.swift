import Foundation
import Combine

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
            print("Loaded \(jobs.count) jobs")
        } catch {
            errorMessage = "Failed to load jobs: \(error)"
            showError = true
            print("Job load error: \(error)")
        }
        isLoading = false
    }
}
