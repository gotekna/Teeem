import SwiftUI

@MainActor
class JobsViewModel: ObservableObject {
    @Published var jobs: [Job] = []
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage = ""

    private let apiClient = APIClient.shared

    func loadJobs() async {
        isLoading = true
        defer { isLoading = false }

        do {
            jobs = try await apiClient.getJobs()
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    func refreshJob(id: Int) async -> Job? {
        do {
            let updatedJob = try await apiClient.getJob(id: id)

            // Update in local list
            if let index = jobs.firstIndex(where: { $0.id == id }) {
                jobs[index] = updatedJob
            }

            return updatedJob
        } catch {
            errorMessage = error.localizedDescription
            showError = true
            return nil
        }
    }
}
