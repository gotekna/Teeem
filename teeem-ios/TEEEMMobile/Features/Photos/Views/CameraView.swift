import SwiftUI
import AVFoundation

struct CameraView: View {
    let taskId: Int
    let onPhotoCaptured: (CapturedPhoto) -> Void
    let onDismiss: () -> Void

    @StateObject private var cameraService = CameraService()
    @StateObject private var locationService = LocationService.shared
    @State private var capturedImage: UIImage?
    @State private var showReview = false
    @State private var selectedPhotoType: PhotoType = .progress

    var body: some View {
        ZStack {
            // Camera Preview
            if let session = cameraService.setupSession() {
                CameraPreviewView(session: session)
                    .ignoresSafeArea()
            } else {
                cameraUnavailableView
            }

            // Overlay UI
            VStack {
                // Top Bar
                topBar

                Spacer()

                // Location indicator
                if let location = locationService.formattedLocation {
                    HStack {
                        Image(systemName: "location.fill")
                        Text(location)
                    }
                    .font(.caption)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(.ultraThinMaterial)
                    .cornerRadius(20)
                }

                // Bottom Controls
                bottomControls
            }
        }
        .sheet(isPresented: $showReview) {
            if let image = capturedImage {
                PhotoReviewView(
                    image: image,
                    photoType: selectedPhotoType,
                    taskId: taskId,
                    location: locationService.currentLocation,
                    onConfirm: { photo in
                        onPhotoCaptured(photo)
                        onDismiss()
                    },
                    onRetake: {
                        capturedImage = nil
                        showReview = false
                    },
                    onDismiss: onDismiss
                )
            }
        }
        .onAppear {
            locationService.startUpdating()
        }
        .onDisappear {
            locationService.stopUpdating()
        }
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack {
            Button {
                onDismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.title2)
                    .foregroundColor(.white)
                    .padding()
            }

            Spacer()

            // Photo type picker
            Menu {
                ForEach(PhotoType.allCases, id: \.self) { type in
                    Button {
                        selectedPhotoType = type
                    } label: {
                        HStack {
                            Image(systemName: type.iconName)
                            Text(type.displayName)
                            if selectedPhotoType == type {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
            } label: {
                HStack {
                    Image(systemName: selectedPhotoType.iconName)
                    Text(selectedPhotoType.displayName)
                    Image(systemName: "chevron.down")
                }
                .font(.subheadline)
                .fontWeight(.medium)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(.ultraThinMaterial)
                .cornerRadius(20)
            }

            Spacer()

            Button {
                cameraService.toggleFlash()
            } label: {
                Image(systemName: "bolt.fill")
                    .font(.title2)
                    .foregroundColor(.white)
                    .padding()
            }
        }
        .padding(.top, 8)
    }

    // MARK: - Bottom Controls

    private var bottomControls: some View {
        HStack(spacing: 60) {
            // Gallery button (placeholder)
            Button {
                // Open photo library
            } label: {
                Image(systemName: "photo.on.rectangle")
                    .font(.title)
                    .foregroundColor(.white)
            }

            // Capture button
            Button {
                Task {
                    if let image = await cameraService.capturePhoto() {
                        capturedImage = image
                        showReview = true
                    }
                }
            } label: {
                ZStack {
                    Circle()
                        .stroke(Color.white, lineWidth: 4)
                        .frame(width: 72, height: 72)

                    Circle()
                        .fill(Color.white)
                        .frame(width: 60, height: 60)
                }
            }

            // Switch camera
            Button {
                cameraService.switchCamera()
            } label: {
                Image(systemName: "camera.rotate")
                    .font(.title)
                    .foregroundColor(.white)
            }
        }
        .padding(.bottom, 40)
    }

    // MARK: - Camera Unavailable

    private var cameraUnavailableView: some View {
        VStack(spacing: 20) {
            Image(systemName: "camera.fill")
                .font(.system(size: 60))
                .foregroundColor(.secondary)

            Text("Camera Unavailable")
                .font(.title2)
                .fontWeight(.bold)

            if let error = cameraService.error {
                Text(error.localizedDescription)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }

            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}

// MARK: - Camera Preview (UIViewRepresentable)

struct CameraPreviewView: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: .zero)

        let previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)

        DispatchQueue.global(qos: .userInitiated).async {
            session.startRunning()
        }

        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        if let layer = uiView.layer.sublayers?.first as? AVCaptureVideoPreviewLayer {
            layer.frame = uiView.bounds
        }
    }

    static func dismantleUIView(_ uiView: UIView, coordinator: ()) {
        // Session cleanup handled elsewhere
    }
}

// MARK: - Captured Photo Model

struct CapturedPhoto {
    let image: UIImage
    let photoType: PhotoType
    let latitude: Double?
    let longitude: Double?
    let takenAt: Date
    let taskId: Int

    var imageData: Data? {
        image.jpegData(compressionQuality: 0.8)
    }
}

#Preview {
    CameraView(
        taskId: 1,
        onPhotoCaptured: { _ in },
        onDismiss: {}
    )
}
