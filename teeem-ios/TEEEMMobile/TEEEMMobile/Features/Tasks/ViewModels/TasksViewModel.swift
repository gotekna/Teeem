import Foundation
import Combine

@MainActor
class TasksViewModel: ObservableObject {
    @Published var tasks: [SMTask] = []
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage = ""

    private let apiClient = APIClient.shared
    private let cache = CacheManager.shared

    init() {
        if let cached = cache.load([SMTask].self, forKey: CacheManager.tasksKey) {
            tasks = cached
        }
    }

    func loadTasks() async {
        isLoading = true
        do {
            let loadedTasks: [SMTask] = try await apiClient.get("sm_tasks?mine=true")
            tasks = loadedTasks
            cache.save(loadedTasks, forKey: CacheManager.tasksKey)
            print("Loaded \(tasks.count) tasks")
        } catch {
            errorMessage = "Failed to load tasks: \(error)"
            showError = true
            print("Task load error: \(error)")
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
