import SwiftUI

@MainActor
class TasksViewModel: ObservableObject {
    @Published var tasks: [SMTask] = []
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage = ""

    @Published var showHoldSheetFor: SMTask?
    @Published var holdReason = ""

    private let apiClient = APIClient.shared

    func loadTasks() async {
        isLoading = true
        defer { isLoading = false }

        do {
            tasks = try await apiClient.getMyTasks()
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    func startTask(_ task: SMTask) async {
        do {
            let updatedTask = try await apiClient.startTask(id: task.id)
            updateTask(updatedTask)
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    func completeTask(_ task: SMTask, notes: String? = nil) async {
        do {
            let updatedTask = try await apiClient.completeTask(id: task.id, notes: notes)
            updateTask(updatedTask)
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    func holdTask(_ task: SMTask, reason: String) async {
        do {
            let updatedTask = try await apiClient.holdTask(id: task.id, reason: reason)
            updateTask(updatedTask)
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    func showHoldSheet(for task: SMTask) {
        holdReason = ""
        showHoldSheetFor = task
    }

    func confirmHold() async {
        guard let task = showHoldSheetFor, !holdReason.isEmpty else { return }
        await holdTask(task, reason: holdReason)
        showHoldSheetFor = nil
        holdReason = ""
    }

    private func updateTask(_ updatedTask: SMTask) {
        if let index = tasks.firstIndex(where: { $0.id == updatedTask.id }) {
            tasks[index] = updatedTask
        }
    }

    func getTask(id: Int) async -> SMTask? {
        do {
            return try await apiClient.getTask(id: id)
        } catch {
            errorMessage = error.localizedDescription
            showError = true
            return nil
        }
    }
}
