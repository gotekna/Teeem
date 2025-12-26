import SwiftUI
import CoreLocation

struct PhotoReviewView: View {
    let image: UIImage
    @State var photoType: PhotoType
    let taskId: Int
    let location: CLLocation?
    let onConfirm: (CapturedPhoto) -> Void
    let onRetake: () -> Void
    let onDismiss: () -> Void

    @State private var notes = ""
    @State private var isUploading = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Image Preview
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 400)
                    .background(Color.black)

                // Details Form
                Form {
                    // Photo Type
                    Section {
                        Picker("Photo Type", selection: $photoType) {
                            ForEach(PhotoType.allCases, id: \.self) { type in
                                Label(type.displayName, systemImage: type.iconName)
                                    .tag(type)
                            }
                        }
                    }

                    // Location
                    Section {
                        if let location = location {
                            HStack {
                                Label("Location", systemImage: "location.fill")
                                Spacer()
                                Text(formatLocation(location))
                                    .foregroundColor(.secondary)
                            }
                        } else {
                            HStack {
                                Label("Location", systemImage: "location.slash")
                                Spacer()
                                Text("Unavailable")
                                    .foregroundColor(.secondary)
                            }
                        }
                    }

                    // Notes
                    Section {
                        TextField("Add notes (optional)", text: $notes, axis: .vertical)
                            .lineLimit(3...5)
                    } header: {
                        Text("Notes")
                    }
                }
            }
            .navigationTitle("Review Photo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Retake") {
                        onRetake()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        confirmPhoto()
                    } label: {
                        if isUploading {
                            ProgressView()
                        } else {
                            Text("Use Photo")
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(isUploading)
                }
            }
        }
    }

    private func confirmPhoto() {
        let capturedPhoto = CapturedPhoto(
            image: image,
            photoType: photoType,
            latitude: location?.coordinate.latitude,
            longitude: location?.coordinate.longitude,
            takenAt: Date(),
            taskId: taskId
        )

        onConfirm(capturedPhoto)
    }

    private func formatLocation(_ location: CLLocation) -> String {
        String(format: "%.4f, %.4f", location.coordinate.latitude, location.coordinate.longitude)
    }
}

#Preview {
    PhotoReviewView(
        image: UIImage(systemName: "photo")!,
        photoType: .progress,
        taskId: 1,
        location: CLLocation(latitude: -27.4705, longitude: 153.0260),
        onConfirm: { _ in },
        onRetake: {},
        onDismiss: {}
    )
}
