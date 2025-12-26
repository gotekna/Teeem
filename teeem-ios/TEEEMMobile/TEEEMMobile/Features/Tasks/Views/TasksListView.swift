import SwiftUI

struct TasksListView: View {
    @StateObject private var viewModel = TasksViewModel()
    @State private var searchText = ""

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.tasks.isEmpty {
                ProgressView("Loading tasks...")
            } else if viewModel.tasks.isEmpty {
                ContentUnavailableView("No Tasks", systemImage: "checklist", description: Text("No tasks assigned"))
            } else {
                List(filteredTasks) { task in
                    NavigationLink(value: task) {
                        TaskRowView(task: task)
                    }
                    .swipeActions {
                        if task.status == .notStarted {
                            Button("Start") { Task { await viewModel.startTask(task) } }
                                .tint(.blue)
                        }
                        if task.status == .inProgress {
                            Button("Complete") { Task { await viewModel.completeTask(task) } }
                                .tint(.green)
                        }
                    }
                }
                .listStyle(.plain)
                .navigationDestination(for: SMTask.self) { task in
                    TaskDetailView(task: task, viewModel: viewModel)
                }
            }
        }
        .navigationTitle("My Tasks")
        .searchable(text: $searchText)
        .refreshable { await viewModel.loadTasks() }
        .task { await viewModel.loadTasks() }
    }

    private var filteredTasks: [SMTask] {
        searchText.isEmpty ? viewModel.tasks : viewModel.tasks.filter { $0.displayName.localizedCaseInsensitiveContains(searchText) }
    }
}

struct TaskRowView: View {
    let task: SMTask
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(task.displayName).font(.headline)
                Spacer()
                TaskStatusBadge(status: task.status ?? .notStarted)
            }
            if let job = task.jobDisplayName {
                Text(job).font(.subheadline).foregroundColor(.secondary)
            }
            if let date = task.formattedDueDate {
                Text("Due: \(date)").font(.caption).foregroundColor(task.dueStatusColor)
            }
        }
        .padding(.vertical, 4)
    }
}

struct TaskDetailView: View {
    let task: SMTask
    @ObservedObject var viewModel: TasksViewModel

    var body: some View {
        List {
            Section("Details") {
                LabeledContent("Status", value: task.status?.displayName ?? "-")
                LabeledContent("Trade", value: task.trade ?? "-")
                if let date = task.formattedDueDate {
                    LabeledContent("Due Date", value: date)
                }
            }
            if let notes = task.notes {
                Section("Notes") { Text(notes) }
            }
            Section {
                if task.status == .notStarted {
                    Button("Start Task") { Task { await viewModel.startTask(task) } }
                }
                if task.status == .inProgress {
                    Button("Complete Task") { Task { await viewModel.completeTask(task) } }
                        .tint(.green)
                }
            }
        }
        .navigationTitle(task.displayName)
    }
}
