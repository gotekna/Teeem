import SwiftUI

/// Main Site Presence View - Check-in/Check-out flow
/// Part of Site Presence & Cost Intelligence System
struct SiteCheckinView: View {
    @StateObject private var viewModel = SitePresenceViewModel()
    @State private var showJobPicker = false
    @State private var showCamera = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if viewModel.isLoading {
                    ProgressView("Loading...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let session = viewModel.activeSession {
                    activeSessionView(session)
                } else {
                    checkinView
                }
            }
            .navigationTitle("Site Presence")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { Task { await viewModel.loadActiveSession() } }) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .sheet(isPresented: $showJobPicker) {
                jobPickerSheet
            }
            .sheet(isPresented: $showCamera) {
                photoCaptureSheet
            }
            .alert("Error", isPresented: $viewModel.showError) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(viewModel.errorMessage)
            }
            .alert("Success", isPresented: $viewModel.showSuccess) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(viewModel.successMessage)
            }
            .task {
                viewModel.requestLocationPermission()
                await viewModel.loadActiveSession()
                await viewModel.loadAvailableJobs()
            }
        }
    }

    // MARK: - Check-in View

    private var checkinView: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Location Status
                locationStatusCard

                // Job Selection
                jobSelectionCard

                // Photo Capture
                photoCaptureCard

                // Notes
                notesCard

                // Check-in Button
                checkInButton

                Divider()
                    .padding(.vertical)

                // Recent Sessions
                recentSessionsSection
            }
            .padding()
        }
    }

    private var locationStatusCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label {
                Text("Location")
                    .font(.headline)
            } icon: {
                Image(systemName: "location.fill")
                    .foregroundColor(.blue)
            }

            switch viewModel.locationStatus {
            case .authorized:
                if let location = viewModel.currentLocation {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        Text("GPS Ready")
                            .foregroundColor(.green)
                        Spacer()
                        Text(String(format: "%.4f, %.4f",
                                   location.coordinate.latitude,
                                   location.coordinate.longitude))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                } else {
                    HStack {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text("Getting location...")
                            .foregroundColor(.secondary)
                    }
                }
            case .denied:
                HStack {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.red)
                    Text("Location access denied")
                        .foregroundColor(.red)
                }
                Button("Open Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                }
                .font(.caption)
            case .requesting, .unknown:
                HStack {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Requesting permission...")
                        .foregroundColor(.secondary)
                }
            case .error(let message):
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                    Text(message)
                        .foregroundColor(.orange)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 5, y: 2)
    }

    private var jobSelectionCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label {
                Text("Select Job")
                    .font(.headline)
            } icon: {
                Image(systemName: "building.2.fill")
                    .foregroundColor(.blue)
            }

            Button(action: { showJobPicker = true }) {
                HStack {
                    if let job = viewModel.selectedJob {
                        VStack(alignment: .leading) {
                            Text(job.name)
                                .foregroundColor(.primary)
                            if let address = job.address {
                                Text(address)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    } else {
                        Text("Tap to select a job")
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(Color(.secondarySystemBackground))
                .cornerRadius(8)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 5, y: 2)
    }

    private var photoCaptureCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label {
                Text("Check-in Photo")
                    .font(.headline)
            } icon: {
                Image(systemName: "camera.fill")
                    .foregroundColor(.blue)
            }

            if let photoData = viewModel.capturedPhotoData,
               let uiImage = UIImage(data: photoData) {
                ZStack(alignment: .topTrailing) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(height: 200)
                        .clipped()
                        .cornerRadius(8)

                    Button(action: {
                        viewModel.capturedPhotoData = nil
                        viewModel.capturedPhotoUrl = nil
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundColor(.white)
                            .shadow(radius: 2)
                    }
                    .padding(8)
                }
            } else {
                Button(action: { showCamera = true }) {
                    VStack(spacing: 8) {
                        Image(systemName: "camera")
                            .font(.largeTitle)
                        Text("Take Photo")
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 120)
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(8)
                }
            }

            Text("Take a photo showing your face and the job site")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 5, y: 2)
    }

    private var notesCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label {
                Text("Notes (Optional)")
                    .font(.headline)
            } icon: {
                Image(systemName: "note.text")
                    .foregroundColor(.blue)
            }

            TextField("Add notes about your work today...", text: $viewModel.notes, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(3...6)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 5, y: 2)
    }

    private var checkInButton: some View {
        Button(action: {
            Task { await viewModel.checkIn() }
        }) {
            HStack {
                if viewModel.isCheckingIn {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: "play.circle.fill")
                }
                Text("Start Day")
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(canCheckIn ? Color.green : Color.gray)
            .foregroundColor(.white)
            .cornerRadius(12)
        }
        .disabled(!canCheckIn || viewModel.isCheckingIn)
    }

    private var canCheckIn: Bool {
        viewModel.selectedJob != nil &&
        viewModel.currentLocation != nil &&
        viewModel.locationStatus == .authorized
    }

    // MARK: - Active Session View

    private func activeSessionView(_ session: SitePresenceSession) -> some View {
        VStack(spacing: 24) {
            // Timer Display
            VStack(spacing: 8) {
                Text(viewModel.formattedElapsedTime)
                    .font(.system(size: 64, weight: .thin, design: .monospaced))
                    .foregroundColor(.green)

                if let job = session.job {
                    Text(job.displayName)
                        .font(.title3)
                        .foregroundColor(.secondary)
                }

                if let checkin = session.checkinAt {
                    Text("Started at \(checkin.formatted(date: .omitted, time: .shortened))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding(.vertical, 32)

            // Status badges
            HStack(spacing: 16) {
                StatusBadge(
                    icon: "location.fill",
                    label: "GPS",
                    verified: session.gpsVerifiedCheckin,
                    detail: session.distanceFromSiteCheckin.map { "\(Int($0))m" }
                )

                StatusBadge(
                    icon: "face.smiling",
                    label: "Face",
                    verified: session.faceVerifiedCheckin,
                    detail: session.faceConfidenceCheckin.map { "\(Int($0 * 100))%" }
                )
            }

            Spacer()

            // Notes for checkout
            VStack(alignment: .leading, spacing: 8) {
                Text("Checkout Notes")
                    .font(.headline)
                TextField("Add notes...", text: $viewModel.notes, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(2...4)
            }
            .padding(.horizontal)

            // End Day Button
            Button(action: {
                Task { await viewModel.checkOut() }
            }) {
                HStack {
                    if viewModel.isCheckingOut {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Image(systemName: "stop.circle.fill")
                    }
                    Text("End Day")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.red)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(viewModel.isCheckingOut)
            .padding(.horizontal)
            .padding(.bottom, 32)
        }
    }

    // MARK: - Recent Sessions

    private var recentSessionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Sessions")
                .font(.headline)

            if viewModel.recentSessions.isEmpty {
                Text("No recent sessions")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            } else {
                ForEach(viewModel.recentSessions) { session in
                    SessionRow(session: session)
                }
            }
        }
        .task {
            await viewModel.loadRecentSessions()
        }
    }

    // MARK: - Job Picker Sheet

    private var jobPickerSheet: some View {
        NavigationStack {
            List(viewModel.availableJobs) { job in
                Button(action: {
                    viewModel.selectedJob = job
                    showJobPicker = false
                }) {
                    HStack {
                        VStack(alignment: .leading) {
                            Text(job.name)
                                .foregroundColor(.primary)
                            if let address = job.address {
                                Text(address)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                        Spacer()
                        if viewModel.selectedJob?.id == job.id {
                            Image(systemName: "checkmark")
                                .foregroundColor(.blue)
                        }
                    }
                }
            }
            .navigationTitle("Select Job")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        showJobPicker = false
                    }
                }
            }
        }
    }

    // MARK: - Photo Capture Sheet

    private var photoCaptureSheet: some View {
        PhotoCaptureView(
            photoData: $viewModel.capturedPhotoData,
            isPresented: $showCamera
        )
    }
}

// MARK: - Supporting Views

struct StatusBadge: View {
    let icon: String
    let label: String
    let verified: Bool
    let detail: String?

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(verified ? .green : .gray)

            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)

            if let detail = detail {
                Text(detail)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Image(systemName: verified ? "checkmark.circle.fill" : "circle")
                .font(.caption)
                .foregroundColor(verified ? .green : .gray)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}

struct SessionRow: View {
    let session: SitePresenceSession

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                if let job = session.job {
                    Text(job.displayName)
                        .font(.subheadline)
                        .fontWeight(.medium)
                }

                if let checkin = session.checkinAt {
                    Text(checkin.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(session.formattedTotalHours)
                    .font(.subheadline)
                    .fontWeight(.medium)

                HStack(spacing: 4) {
                    if session.gpsVerifiedCheckin {
                        Image(systemName: "location.fill")
                            .foregroundColor(.green)
                    }
                    if session.faceVerifiedCheckin {
                        Image(systemName: "face.smiling")
                            .foregroundColor(.green)
                    }
                }
                .font(.caption)
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(8)
    }
}

#Preview {
    SiteCheckinView()
}
