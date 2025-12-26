import SwiftUI

struct TaskDetailView: View {
    let task: SMTask
    @ObservedObject var viewModel: TasksViewModel

    @State private var showCompleteSheet = false
    @State private var completionNotes = ""
    @State private var showHoldSheet = false
    @State private var holdReason = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Header Card
                headerCard

                // Action Buttons
                actionButtons

                // Details Section
                detailsSection

                // Notes Section
                if let notes = task.completionNotes, !notes.isEmpty {
                    notesSection(title: "Completion Notes", notes: notes)
                }

                if let holdReason = task.holdReason, !holdReason.isEmpty {
                    notesSection(title: "Hold Reason", notes: holdReason)
                }

                // Photos Section
                photosSection
            }
            .padding(.vertical)
        }
        .navigationTitle("Task")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showCompleteSheet) {
            completeTaskSheet
        }
        .sheet(isPresented: $showHoldSheet) {
            holdTaskSheet
        }
    }

    // MARK: - Header Card

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Task Name
            Text(task.displayName)
                .font(.title2)
                .fontWeight(.bold)

            // Status Badge
            TaskStatusBadge(status: task.status ?? .notStarted)

            // Job Name
            if let jobName = task.jobDisplayName {
                Label(jobName, systemImage: "briefcase")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            // Trade
            if let trade = task.trade {
                Label(trade, systemImage: "wrench.and.screwdriver")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            // Assigned To
            if let assignee = task.assignedUserName {
                Label(assignee, systemImage: "person")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            // Due Date
            if let dueDate = task.formattedDueDate {
                Label("Due: \(dueDate)", systemImage: "calendar")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(task.dueStatusColor)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 5, x: 0, y: 2)
        .padding(.horizontal)
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        HStack(spacing: 12) {
            switch task.status {
            case .notStarted:
                primaryButton(title: "Start Task", icon: "play.fill", color: .blue) {
                    Task { await viewModel.startTask(task) }
                }

            case .inProgress:
                primaryButton(title: "Complete", icon: "checkmark", color: .green) {
                    showCompleteSheet = true
                }

                secondaryButton(title: "Hold", icon: "pause.fill", color: .orange) {
                    showHoldSheet = true
                }

            case .onHold:
                primaryButton(title: "Resume", icon: "play.fill", color: .blue) {
                    Task { await viewModel.startTask(task) }
                }

            case .completed:
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                    Text("Task Completed")
                        .fontWeight(.medium)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.green.opacity(0.1))
                .cornerRadius(10)

            default:
                EmptyView()
            }
        }
        .padding(.horizontal)
    }

    private func primaryButton(title: String, icon: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                Text(title)
                    .fontWeight(.semibold)
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding()
            .background(color)
            .cornerRadius(10)
        }
    }

    private func secondaryButton(title: String, icon: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Image(systemName: icon)
                Text(title)
                    .fontWeight(.semibold)
            }
            .foregroundColor(color)
            .frame(maxWidth: .infinity)
            .padding()
            .background(color.opacity(0.15))
            .cornerRadius(10)
        }
    }

    // MARK: - Details Section

    private var detailsSection: some View {
        VStack(spacing: 12) {
            if let description = task.description, !description.isEmpty {
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

            // Dates
            if let startDate = task.plannedStartDate {
                detailRow(label: "Planned Start", value: formatDate(startDate))
            }

            if let endDate = task.plannedEndDate {
                detailRow(label: "Planned End", value: formatDate(endDate))
            }

            if let duration = task.durationDays {
                detailRow(label: "Duration", value: "\(duration) days")
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

    private func notesSection(title: String, notes: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.secondary)

            Text(notes)
                .font(.body)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(10)
        .padding(.horizontal)
    }

    // MARK: - Photos Section

    private var photosSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Photos")
                    .font(.headline)

                Spacer()

                Button {
                    // Open camera
                } label: {
                    Label("Add Photo", systemImage: "camera.fill")
                        .font(.subheadline)
                }
            }

            // Placeholder for photos grid
            ContentUnavailableView {
                Label("No Photos", systemImage: "photo.on.rectangle")
            } description: {
                Text("Tap 'Add Photo' to capture photos for this task.")
            }
            .frame(height: 150)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 5, x: 0, y: 2)
        .padding(.horizontal)
    }

    // MARK: - Complete Task Sheet

    private var completeTaskSheet: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Add completion notes (optional)", text: $completionNotes, axis: .vertical)
                        .lineLimit(3...6)
                } header: {
                    Text("Completion Notes")
                } footer: {
                    Text("Add any notes about completing this task.")
                }
            }
            .navigationTitle("Complete Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showCompleteSheet = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Complete") {
                        Task {
                            await viewModel.completeTask(
                                task,
                                notes: completionNotes.isEmpty ? nil : completionNotes
                            )
                            showCompleteSheet = false
                        }
                    }
                    .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium])
    }

    // MARK: - Hold Task Sheet

    private var holdTaskSheet: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Why is this task on hold?", text: $holdReason, axis: .vertical)
                        .lineLimit(3...6)
                } header: {
                    Text("Hold Reason")
                } footer: {
                    Text("Explain why you're putting this task on hold.")
                }
            }
            .navigationTitle("Hold Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showHoldSheet = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Hold Task") {
                        Task {
                            await viewModel.holdTask(task, reason: holdReason)
                            showHoldSheet = false
                        }
                    }
                    .fontWeight(.semibold)
                    .disabled(holdReason.isEmpty)
                }
            }
        }
        .presentationDetents([.medium])
    }

    // MARK: - Helpers

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: date)
    }
}

#Preview {
    NavigationStack {
        TaskDetailView(
            task: SMTask(
                id: 1,
                jobId: 1,
                name: "Install Kitchen Cabinets",
                description: "Install new kitchen cabinets according to plan specifications",
                status: .inProgress,
                priority: "high",
                trade: "Carpentry",
                assignedUserId: 1,
                assignedUserName: "John Smith",
                plannedStartDate: Date(),
                plannedEndDate: Date().addingTimeInterval(86400 * 3),
                actualStartDate: Date(),
                actualEndDate: nil,
                durationDays: 3,
                holdReason: nil,
                completionNotes: nil,
                sequence: 1,
                jobName: "Smith Residence",
                jobNumber: "J2024-001",
                createdAt: Date(),
                updatedAt: Date()
            ),
            viewModel: TasksViewModel()
        )
    }
}
