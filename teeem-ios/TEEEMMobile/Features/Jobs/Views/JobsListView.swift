import SwiftUI

struct JobsListView: View {
    @StateObject private var viewModel = JobsViewModel()
    @EnvironmentObject var networkMonitor: NetworkMonitor
    @State private var searchText = ""

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.jobs.isEmpty {
                loadingView
            } else if viewModel.jobs.isEmpty {
                emptyStateView
            } else {
                jobsList
            }
        }
        .navigationTitle("Jobs")
        .searchable(text: $searchText, prompt: "Search jobs...")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                if !networkMonitor.isConnected {
                    OfflineIndicator()
                }
            }
        }
        .refreshable {
            await viewModel.loadJobs()
        }
        .task {
            await viewModel.loadJobs()
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
            Button("Retry") {
                Task { await viewModel.loadJobs() }
            }
        } message: {
            Text(viewModel.errorMessage)
        }
    }

    // MARK: - Jobs List

    private var jobsList: some View {
        List {
            ForEach(filteredJobs) { job in
                NavigationLink(value: job) {
                    JobRowView(job: job)
                }
            }
        }
        .listStyle(.plain)
        .navigationDestination(for: Job.self) { job in
            JobDetailView(job: job)
        }
    }

    private var filteredJobs: [Job] {
        if searchText.isEmpty {
            return viewModel.jobs
        }
        return viewModel.jobs.filter { job in
            job.displayName.localizedCaseInsensitiveContains(searchText) ||
            job.clientName?.localizedCaseInsensitiveContains(searchText) == true ||
            job.address?.localizedCaseInsensitiveContains(searchText) == true
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Loading jobs...")
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        ContentUnavailableView {
            Label("No Jobs", systemImage: "briefcase")
        } description: {
            Text("You don't have any jobs assigned yet.")
        } actions: {
            Button("Refresh") {
                Task { await viewModel.loadJobs() }
            }
        }
    }
}

// MARK: - Job Row

struct JobRowView: View {
    let job: Job

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Job Number and Name
            HStack {
                Text(job.displayName)
                    .font(.headline)
                    .lineLimit(1)

                Spacer()

                if let status = job.status {
                    Text(status.capitalized)
                        .font(.caption)
                        .fontWeight(.medium)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(job.statusColor.opacity(0.15))
                        .foregroundColor(job.statusColor)
                        .cornerRadius(6)
                }
            }

            // Client Name
            if let clientName = job.clientName {
                HStack(spacing: 6) {
                    Image(systemName: "person")
                        .font(.caption)
                    Text(clientName)
                        .font(.subheadline)
                }
                .foregroundColor(.secondary)
            }

            // Address
            if let address = job.fullAddress {
                HStack(spacing: 6) {
                    Image(systemName: "mappin")
                        .font(.caption)
                    Text(address)
                        .font(.subheadline)
                        .lineLimit(1)
                }
                .foregroundColor(.secondary)
            }

            // Contract Value
            if let value = job.formattedContractValue {
                HStack(spacing: 6) {
                    Image(systemName: "dollarsign.circle")
                        .font(.caption)
                    Text(value)
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                .foregroundColor(.green)
            }
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    JobsListView()
}
