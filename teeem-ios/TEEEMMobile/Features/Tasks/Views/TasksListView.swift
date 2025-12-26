import SwiftUI

struct TasksListView: View {
    @StateObject private var viewModel = TasksViewModel()
    @EnvironmentObject var networkMonitor: NetworkMonitor
    @State private var searchText = ""
    @State private var selectedFilter: TaskFilter = .all
    @Binding var navigateToTaskId: Int?
    @State private var selectedTask: SMTask?

    init(navigateToTaskId: Binding<Int?> = .constant(nil)) {
        _navigateToTaskId = navigateToTaskId
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.tasks.isEmpty {
                loadingView
            } else if viewModel.tasks.isEmpty {
                emptyStateView
            } else {
                tasksList
            }
        }
        .navigationTitle("My Tasks")
        .searchable(text: $searchText, prompt: "Search tasks...")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                if !networkMonitor.isConnected {
                    OfflineIndicator()
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    ForEach(TaskFilter.allCases, id: \.self) { filter in
                        Button {
                            selectedFilter = filter
                        } label: {
                            HStack {
                                Text(filter.displayName)
                                if selectedFilter == filter {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                } label: {
                    Image(systemName: "line.3.horizontal.decrease.circle")
                }
            }
        }
        .refreshable {
            await viewModel.loadTasks()
        }
        .task {
            await viewModel.loadTasks()
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
            Button("Retry") {
                Task { await viewModel.loadTasks() }
            }
        } message: {
            Text(viewModel.errorMessage)
        }
        .onChange(of: navigateToTaskId) { _, taskId in
            if let taskId = taskId,
               let task = viewModel.tasks.first(where: { $0.id == taskId }) {
                selectedTask = task
                navigateToTaskId = nil
            }
        }
        .navigationDestination(item: $selectedTask) { task in
            TaskDetailView(task: task, viewModel: viewModel)
        }
    }

    // MARK: - Tasks List

    private var tasksList: some View {
        List {
            // Overdue Section
            if !overdueTasks.isEmpty {
                Section {
                    ForEach(overdueTasks) { task in
                        NavigationLink(value: task) {
                            TaskRowView(task: task)
                        }
                        .swipeActions(edge: .trailing) {
                            taskSwipeActions(for: task)
                        }
                    }
                } header: {
                    Label("Overdue", systemImage: "exclamationmark.triangle.fill")
                        .foregroundColor(.red)
                }
            }

            // Due Soon Section
            if !dueSoonTasks.isEmpty {
                Section {
                    ForEach(dueSoonTasks) { task in
                        NavigationLink(value: task) {
                            TaskRowView(task: task)
                        }
                        .swipeActions(edge: .trailing) {
                            taskSwipeActions(for: task)
                        }
                    }
                } header: {
                    Label("Due Soon", systemImage: "clock.fill")
                        .foregroundColor(.orange)
                }
            }

            // All Other Tasks
            Section {
                ForEach(otherTasks) { task in
                    NavigationLink(value: task) {
                        TaskRowView(task: task)
                    }
                    .swipeActions(edge: .trailing) {
                        taskSwipeActions(for: task)
                    }
                }
            } header: {
                if !overdueTasks.isEmpty || !dueSoonTasks.isEmpty {
                    Text("All Tasks")
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationDestination(for: SMTask.self) { task in
            TaskDetailView(task: task, viewModel: viewModel)
        }
    }

    @ViewBuilder
    private func taskSwipeActions(for task: SMTask) -> some View {
        if task.status == .notStarted {
            Button {
                Task { await viewModel.startTask(task) }
            } label: {
                Label("Start", systemImage: "play.fill")
            }
            .tint(.blue)
        }

        if task.status == .inProgress {
            Button {
                Task { await viewModel.completeTask(task) }
            } label: {
                Label("Complete", systemImage: "checkmark")
            }
            .tint(.green)

            Button {
                viewModel.showHoldSheet(for: task)
            } label: {
                Label("Hold", systemImage: "pause.fill")
            }
            .tint(.orange)
        }
    }

    // MARK: - Filtered Tasks

    private var filteredTasks: [SMTask] {
        var result = viewModel.tasks

        // Apply search filter
        if !searchText.isEmpty {
            result = result.filter { task in
                task.displayName.localizedCaseInsensitiveContains(searchText) ||
                task.jobDisplayName?.localizedCaseInsensitiveContains(searchText) == true ||
                task.trade?.localizedCaseInsensitiveContains(searchText) == true
            }
        }

        // Apply status filter
        switch selectedFilter {
        case .all:
            break
        case .notStarted:
            result = result.filter { $0.status == .notStarted }
        case .inProgress:
            result = result.filter { $0.status == .inProgress }
        case .onHold:
            result = result.filter { $0.status == .onHold }
        case .completed:
            result = result.filter { $0.status == .completed }
        }

        return result
    }

    private var overdueTasks: [SMTask] {
        filteredTasks.filter { $0.isOverdue && $0.status != .completed }
    }

    private var dueSoonTasks: [SMTask] {
        filteredTasks.filter { $0.isDueSoon && !$0.isOverdue && $0.status != .completed }
    }

    private var otherTasks: [SMTask] {
        filteredTasks.filter { !$0.isOverdue && !$0.isDueSoon }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Loading tasks...")
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        ContentUnavailableView {
            Label("No Tasks", systemImage: "checklist")
        } description: {
            Text("You don't have any tasks assigned yet.")
        } actions: {
            Button("Refresh") {
                Task { await viewModel.loadTasks() }
            }
        }
    }
}

// MARK: - Task Filter

enum TaskFilter: CaseIterable {
    case all
    case notStarted
    case inProgress
    case onHold
    case completed

    var displayName: String {
        switch self {
        case .all:
            return "All"
        case .notStarted:
            return "Not Started"
        case .inProgress:
            return "In Progress"
        case .onHold:
            return "On Hold"
        case .completed:
            return "Completed"
        }
    }
}

// MARK: - Task Row

struct TaskRowView: View {
    let task: SMTask

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Task Name and Status
            HStack {
                Text(task.displayName)
                    .font(.headline)
                    .lineLimit(1)

                Spacer()

                TaskStatusBadge(status: task.status ?? .notStarted)
            }

            // Job Name
            if let jobName = task.jobDisplayName {
                HStack(spacing: 6) {
                    Image(systemName: "briefcase")
                        .font(.caption)
                    Text(jobName)
                        .font(.subheadline)
                        .lineLimit(1)
                }
                .foregroundColor(.secondary)
            }

            // Trade
            if let trade = task.trade {
                HStack(spacing: 6) {
                    Image(systemName: "wrench.and.screwdriver")
                        .font(.caption)
                    Text(trade)
                        .font(.subheadline)
                }
                .foregroundColor(.secondary)
            }

            // Due Date
            if let dueDate = task.formattedDueDate {
                HStack(spacing: 6) {
                    Image(systemName: "calendar")
                        .font(.caption)
                    Text("Due: \(dueDate)")
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                .foregroundColor(task.dueStatusColor)
            }
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    TasksListView()
}
