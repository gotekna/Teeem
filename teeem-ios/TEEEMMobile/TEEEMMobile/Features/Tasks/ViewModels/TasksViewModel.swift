import Foundation

@MainActor
class TasksViewModel: ObservableObject {
    @Published var tasks: [SMTask] = []
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage = ""

    private let apiClient = APIClient.shared

    func loadTasks() async {
        isLoading = true
        do {
            tasks = try await apiClient.get("sm_tasks?mine=true")
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
        isLoading = false
    }

    func startTask(_ task: SMTask) async {
        do {
            _ = try await apiClient.startTask(id: task.id)
            await loadTasks()
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    func completeTask(_ task: SMTask, notes: String? = nil) async {
        do {
            _ = try await apiClient.completeTask(id: task.id, notes: notes)
            await loadTasks()
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }
}
