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
            Text(job.displayName).font(.headline)
            if let client = job.clientName {
                Text(client).font(.subheadline).foregroundColor(.secondary)
            }
            if let address = job.fullAddress {
                Text(address).font(.caption).foregroundColor(.secondary)
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
                LabeledContent("Job Number", value: job.jobNumber ?? "-")
                LabeledContent("Client", value: job.clientName ?? "-")
                LabeledContent("Status", value: job.status?.capitalized ?? "-")
            }
            if let address = job.fullAddress {
                Section("Location") {
                    Text(address)
                }
            }
        }
        .navigationTitle(job.displayName)
    }
}
