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
    var body: some View {
        List {
            Section("Details") {
                LabeledContent("Job ID", value: "\(job.id)")
                LabeledContent("Status", value: job.statusName)
                if let value = job.formattedContractValue {
                    LabeledContent("Contract Value", value: value)
                }
            }
            if let loc = job.location, !loc.isEmpty {
                Section("Location") {
                    Text(loc)
                }
            }
        }
        .navigationTitle(job.displayName)
    }
}
