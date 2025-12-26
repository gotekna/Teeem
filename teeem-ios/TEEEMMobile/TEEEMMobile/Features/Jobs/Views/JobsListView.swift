import SwiftUI

struct JobsListView: View {
    @StateObject private var viewModel = JobsViewModel()
    @State private var searchText = ""

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.jobs.isEmpty {
                ProgressView("Loading jobs...")
            } else if viewModel.jobs.isEmpty {
                ContentUnavailableView("No Jobs", systemImage: "briefcase", description: Text("No jobs found"))
            } else {
                List(filteredJobs) { job in
                    NavigationLink(value: job) {
                        JobRowView(job: job)
                    }
                }
                .listStyle(.plain)
                .navigationDestination(for: Job.self) { job in
                    JobDetailView(job: job)
                }
            }
        }
        .navigationTitle("Jobs")
        .searchable(text: $searchText)
        .refreshable { await viewModel.loadJobs() }
        .task { await viewModel.loadJobs() }
    }

    private var filteredJobs: [Job] {
        searchText.isEmpty ? viewModel.jobs : viewModel.jobs.filter { $0.displayName.localizedCaseInsensitiveContains(searchText) }
    }
}

struct JobRowView: View {
    let job: Job
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(job.displayName).font(.headline)
                Spacer()
                Text(job.statusName)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(job.statusColor.opacity(0.15))
                    .foregroundColor(job.statusColor)
                    .cornerRadius(4)
            }
            if let loc = job.location, !loc.isEmpty {
                Text(loc).font(.subheadline).foregroundColor(.secondary)
            }
            if let value = job.formattedContractValue {
                Text(value).font(.caption).foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

struct JobDetailView: View {
    let job: Job
    @State private var showSchedule = false
    @State private var showPOs = false
    @State private var showPlans = false
    @State private var showPhotos = false
    @State private var showDocs = false
    @State private var showPeople = false

    var body: some View {
        List {
            // Job Info Section
            Section("Job Details") {
                LabeledContent("Job ID", value: "\(job.id)")
                LabeledContent("Status", value: job.statusName)
                if let value = job.formattedContractValue {
                    LabeledContent("Contract Value", value: value)
                }
                if let loc = job.location, !loc.isEmpty {
                    LabeledContent("Location", value: loc)
                }
            }

            // Quick Actions - Grid of buttons
            Section("Quick Actions") {
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 16) {
                    JobActionButton(icon: "calendar", title: "Schedule", color: .blue) {
                        showSchedule = true
                    }
                    JobActionButton(icon: "doc.text", title: "PO", color: .orange) {
                        showPOs = true
                    }
                    JobActionButton(icon: "doc.richtext", title: "Plans", color: .purple) {
                        showPlans = true
                    }
                    JobActionButton(icon: "photo.on.rectangle", title: "Photos", color: .green) {
                        showPhotos = true
                    }
                    JobActionButton(icon: "folder", title: "Docs", color: .indigo) {
                        showDocs = true
                    }
                    JobActionButton(icon: "person.2", title: "People", color: .pink) {
                        showPeople = true
                    }
                }
                .padding(.vertical, 8)
            }
        }
        .navigationTitle(job.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showSchedule) {
            NavigationStack {
                JobScheduleTab(job: job)
                    .navigationTitle("Schedule")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { showSchedule = false }
                        }
                    }
            }
        }
        .sheet(isPresented: $showPOs) {
            NavigationStack {
                JobPOTab(job: job)
                    .navigationTitle("Purchase Orders")
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { showPOs = false }
                        }
                    }
            }
        }
        .sheet(isPresented: $showPlans) {
            NavigationStack {
                JobPlansTab(job: job)
                    .navigationTitle("Plans")
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { showPlans = false }
                        }
                    }
            }
        }
        .sheet(isPresented: $showPhotos) {
            NavigationStack {
                JobPhotosTab(job: job)
                    .navigationTitle("Photos")
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { showPhotos = false }
                        }
                    }
            }
        }
        .sheet(isPresented: $showDocs) {
            NavigationStack {
                JobDocumentsTab(job: job)
                    .navigationTitle("Documents")
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { showDocs = false }
                        }
                    }
            }
        }
        .sheet(isPresented: $showPeople) {
            NavigationStack {
                JobPeopleTab(job: job)
                    .navigationTitle("People")
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { showPeople = false }
                        }
                    }
            }
        }
    }
}

// MARK: - Job Action Button
struct JobActionButton: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .frame(width: 50, height: 50)
                    .background(color.opacity(0.15))
                    .foregroundColor(color)
                    .cornerRadius(12)
                Text(title)
                    .font(.caption)
                    .foregroundColor(.primary)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Job Schedule Tab (Tasks)
struct JobScheduleTab: View {
    let job: Job
    @State private var tasks: [SMTask] = []
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading schedule...")
            } else if tasks.isEmpty {
                ContentUnavailableView("No Tasks", systemImage: "calendar", description: Text("No tasks for this job"))
            } else {
                List(tasks) { task in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(task.displayName).font(.headline)
                        HStack {
                            Text(task.taskStatus.displayName)
                                .font(.caption)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(task.taskStatus.color.opacity(0.15))
                                .foregroundColor(task.taskStatus.color)
                                .cornerRadius(4)
                            if let date = task.formattedDueDate {
                                Text(date)
                                    .font(.caption)
                                    .foregroundColor(task.dueStatusColor)
                            }
                        }
                    }
                }
            }
        }
        .task {
            await loadTasks()
        }
    }

    func loadTasks() async {
        do {
            tasks = try await APIClient.shared.get("sm_tasks?job_id=\(job.id)")
        } catch {
            print("Failed to load job tasks: \(error)")
        }
        isLoading = false
    }
}

// MARK: - Job PO Tab (Purchase Orders)
struct JobPOTab: View {
    let job: Job

    var body: some View {
        ContentUnavailableView("Purchase Orders", systemImage: "doc.text", description: Text("Coming soon"))
    }
}

// MARK: - Job Plans Tab
struct JobPlansTab: View {
    let job: Job

    var body: some View {
        ContentUnavailableView("Plans", systemImage: "doc.richtext", description: Text("Coming soon"))
    }
}

// MARK: - Job Photos Tab
struct JobPhotosTab: View {
    let job: Job

    var body: some View {
        ContentUnavailableView("Photos", systemImage: "photo.on.rectangle", description: Text("Coming soon"))
    }
}

// MARK: - Job Documents Tab
struct JobDocumentsTab: View {
    let job: Job

    var body: some View {
        ContentUnavailableView("Documents", systemImage: "folder", description: Text("Coming soon"))
    }
}

// MARK: - Job People Tab
struct JobPeopleTab: View {
    let job: Job

    var body: some View {
        ContentUnavailableView("People", systemImage: "person.2", description: Text("Coming soon"))
    }
}
