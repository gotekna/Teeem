import SwiftUI

struct PhotoGalleryView: View {
    let taskId: Int
    @StateObject private var viewModel = PhotoGalleryViewModel()
    @State private var showCamera = false
    @State private var selectedPhoto: Photo?

    private let columns = [
        GridItem(.flexible(), spacing: 4),
        GridItem(.flexible(), spacing: 4),
        GridItem(.flexible(), spacing: 4)
    ]

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.photos.isEmpty {
                loadingView
            } else if viewModel.photos.isEmpty && viewModel.pendingPhotos.isEmpty {
                emptyStateView
            } else {
                photosGrid
            }
        }
        .navigationTitle("Photos")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showCamera = true
                } label: {
                    Image(systemName: "camera.fill")
                }
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraView(
                taskId: taskId,
                onPhotoCaptured: { photo in
                    viewModel.queuePhoto(photo)
                },
                onDismiss: {
                    showCamera = false
                }
            )
        }
        .sheet(item: $selectedPhoto) { photo in
            PhotoDetailView(photo: photo)
        }
        .task {
            await viewModel.loadPhotos(taskId: taskId)
        }
        .refreshable {
            await viewModel.loadPhotos(taskId: taskId)
        }
    }

    // MARK: - Photos Grid

    private var photosGrid: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Pending uploads section
                if !viewModel.pendingPhotos.isEmpty {
                    Section {
                        LazyVGrid(columns: columns, spacing: 4) {
                            ForEach(viewModel.pendingPhotos) { pending in
                                PendingPhotoCell(pending: pending)
                            }
                        }
                    } header: {
                        HStack {
                            Image(systemName: "arrow.up.circle")
                            Text("Uploading...")
                            Spacer()
                            Text("\(viewModel.pendingPhotos.count) pending")
                                .foregroundColor(.secondary)
                        }
                        .font(.subheadline)
                        .fontWeight(.medium)
                    }
                }

                // Uploaded photos
                if !viewModel.photos.isEmpty {
                    Section {
                        LazyVGrid(columns: columns, spacing: 4) {
                            ForEach(viewModel.photos) { photo in
                                PhotoCell(photo: photo)
                                    .onTapGesture {
                                        selectedPhoto = photo
                                    }
                            }
                        }
                    } header: {
                        if !viewModel.pendingPhotos.isEmpty {
                            Text("Uploaded")
                                .font(.subheadline)
                                .fontWeight(.medium)
                        }
                    }
                }
            }
            .padding()
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text("Loading photos...")
                .foregroundColor(.secondary)
        }
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        ContentUnavailableView {
            Label("No Photos", systemImage: "photo.on.rectangle")
        } description: {
            Text("Capture photos to document this task.")
        } actions: {
            Button {
                showCamera = true
            } label: {
                Label("Take Photo", systemImage: "camera.fill")
            }
            .buttonStyle(.borderedProminent)
        }
    }
}

// MARK: - Photo Cell

struct PhotoCell: View {
    let photo: Photo

    var body: some View {
        AsyncImage(url: URL(string: photo.thumbnailUrl ?? photo.url ?? "")) { phase in
            switch phase {
            case .empty:
                Rectangle()
                    .fill(Color(.systemGray5))
                    .overlay {
                        ProgressView()
                    }
            case .success(let image):
                image
                    .resizable()
                    .scaledToFill()
            case .failure:
                Rectangle()
                    .fill(Color(.systemGray5))
                    .overlay {
                        Image(systemName: "photo")
                            .foregroundColor(.secondary)
                    }
            @unknown default:
                EmptyView()
            }
        }
        .aspectRatio(1, contentMode: .fill)
        .clipped()
        .cornerRadius(4)
        .overlay(alignment: .bottomLeading) {
            if let type = photo.photoType {
                Image(systemName: type.iconName)
                    .font(.caption2)
                    .foregroundColor(.white)
                    .padding(4)
                    .background(Color.black.opacity(0.6))
                    .cornerRadius(4)
                    .padding(4)
            }
        }
    }
}

// MARK: - Pending Photo Cell

struct PendingPhotoCell: View {
    let pending: PendingPhoto

    var body: some View {
        Image(uiImage: pending.image)
            .resizable()
            .scaledToFill()
            .aspectRatio(1, contentMode: .fill)
            .clipped()
            .cornerRadius(4)
            .overlay {
                Color.black.opacity(0.4)

                VStack {
                    if pending.isUploading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    } else if pending.error != nil {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.orange)
                    } else {
                        Image(systemName: "clock.fill")
                            .foregroundColor(.white)
                    }
                }
            }
    }
}

// MARK: - Photo Detail View

struct PhotoDetailView: View {
    let photo: Photo
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Full size image
                    AsyncImage(url: URL(string: photo.displayUrl ?? "")) { phase in
                        switch phase {
                        case .empty:
                            ProgressView()
                                .frame(height: 300)
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFit()
                        case .failure:
                            Image(systemName: "photo")
                                .font(.largeTitle)
                                .frame(height: 300)
                        @unknown default:
                            EmptyView()
                        }
                    }

                    // Details
                    VStack(spacing: 12) {
                        if let type = photo.photoType {
                            detailRow(label: "Type", value: type.displayName, icon: type.iconName)
                        }

                        if let date = photo.formattedDate {
                            detailRow(label: "Taken", value: date, icon: "calendar")
                        }

                        if photo.hasLocation {
                            detailRow(
                                label: "Location",
                                value: String(format: "%.4f, %.4f", photo.latitude ?? 0, photo.longitude ?? 0),
                                icon: "location.fill"
                            )
                        }

                        if let uploadedBy = photo.uploadedByName {
                            detailRow(label: "Uploaded by", value: uploadedBy, icon: "person")
                        }

                        if let notes = photo.notes, !notes.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Label("Notes", systemImage: "note.text")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                Text(notes)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding()
                            .background(Color(.systemGray6))
                            .cornerRadius(10)
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .navigationTitle("Photo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func detailRow(label: String, value: String, icon: String) -> some View {
        HStack {
            Label(label, systemImage: icon)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(10)
    }
}

#Preview {
    NavigationStack {
        PhotoGalleryView(taskId: 1)
    }
}
