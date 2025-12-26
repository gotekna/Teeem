import SwiftUI

struct JobDetailView: View {
    let job: Job
    @State private var selectedTab = 0

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Header Card
                headerCard

                // Quick Actions
                quickActionsRow

                // Tab Picker
                Picker("Section", selection: $selectedTab) {
                    Text("Details").tag(0)
                    Text("Tasks").tag(1)
                    Text("Photos").tag(2)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                // Tab Content
                switch selectedTab {
                case 0:
                    detailsSection
                case 1:
                    tasksSection
                case 2:
                    photosSection
                default:
                    EmptyView()
                }
            }
            .padding(.vertical)
        }
        .navigationTitle(job.jobNumber ?? "Job")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Header Card

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Job Name
            Text(job.displayName)
                .font(.title2)
                .fontWeight(.bold)

            // Status Badge
            if let status = job.status {
                HStack {
                    Circle()
                        .fill(job.statusColor)
                        .frame(width: 8, height: 8)

                    Text(status.capitalized)
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
            }

            // Client
            if let client = job.clientName {
                Label(client, systemImage: "building.2")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            // Address
            if let address = job.fullAddress {
                Label(address, systemImage: "mappin.and.ellipse")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            // Contract Value
            if let value = job.formattedContractValue {
                Label(value, systemImage: "dollarsign.circle")
                    .font(.headline)
                    .foregroundColor(.green)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 5, x: 0, y: 2)
        .padding(.horizontal)
    }

    // MARK: - Quick Actions

    private var quickActionsRow: some View {
        HStack(spacing: 12) {
            quickActionButton(icon: "phone.fill", label: "Call", color: .green) {
                // Call action
            }

            quickActionButton(icon: "map.fill", label: "Navigate", color: .blue) {
                // Navigate action
                if let address = job.fullAddress {
                    openMaps(address: address)
                }
            }

            quickActionButton(icon: "camera.fill", label: "Photo", color: .orange) {
                // Photo action
            }

            quickActionButton(icon: "doc.text.fill", label: "Docs", color: .purple) {
                // Docs action
            }
        }
        .padding(.horizontal)
    }

    private func quickActionButton(icon: String, label: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)

                Text(label)
                    .font(.caption)
                    .foregroundColor(.primary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(Color(.systemGray6))
            .cornerRadius(10)
        }
    }

    // MARK: - Details Section

    private var detailsSection: some View {
        VStack(spacing: 16) {
            // Stage
            if let stage = job.stage {
                detailRow(label: "Stage", value: stage)
            }

            // Dates
            if let startDate = job.startDate {
                detailRow(label: "Start Date", value: formatDate(startDate))
            }

            if let endDate = job.endDate {
                detailRow(label: "End Date", value: formatDate(endDate))
            }

            // Description
            if let description = job.description, !description.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Description")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.secondary)

                    Text(description)
                        .font(.body)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(10)
            }
        }
        .padding(.horizontal)
    }

    private func detailRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(10)
    }

    // MARK: - Tasks Section

    private var tasksSection: some View {
        VStack(spacing: 12) {
            // Placeholder - will load actual tasks
            ContentUnavailableView {
                Label("No Tasks", systemImage: "checklist")
            } description: {
                Text("Tasks for this job will appear here.")
            }
        }
        .padding(.horizontal)
    }

    // MARK: - Photos Section

    private var photosSection: some View {
        VStack(spacing: 12) {
            // Placeholder - will load actual photos
            ContentUnavailableView {
                Label("No Photos", systemImage: "photo.on.rectangle")
            } description: {
                Text("Photos for this job will appear here.")
            }
        }
        .padding(.horizontal)
    }

    // MARK: - Helpers

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }

    private func openMaps(address: String) {
        let encodedAddress = address.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        if let url = URL(string: "maps://?q=\(encodedAddress)") {
            UIApplication.shared.open(url)
        }
    }
}

#Preview {
    NavigationStack {
        JobDetailView(job: Job(
            id: 1,
            jobNumber: "J2024-001",
            name: "Smith Residence Renovation",
            description: "Complete renovation of kitchen and bathroom",
            status: "active",
            stage: "Construction",
            address: "123 Main Street",
            suburb: "Brisbane",
            state: "QLD",
            postcode: "4000",
            contractValue: 150000,
            startDate: Date(),
            endDate: Date().addingTimeInterval(86400 * 90),
            clientName: "John Smith",
            projectManagerId: 1,
            supervisorId: 2,
            createdAt: Date(),
            updatedAt: Date()
        ))
    }
}
