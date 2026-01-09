import SwiftUI
import AVFoundation

/// Photo Capture View with face overlay guide
/// Part of Site Presence & Cost Intelligence System
struct PhotoCaptureView: View {
    @Binding var photoData: Data?
    @Binding var isPresented: Bool

    @State private var capturedImage: UIImage?
    @State private var showingPreview = false

    var body: some View {
        NavigationStack {
            ZStack {
                if showingPreview, let image = capturedImage {
                    previewView(image: image)
                } else {
                    cameraView
                }
            }
            .navigationTitle("Take Photo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        isPresented = false
                    }
                }
            }
        }
    }

    // MARK: - Camera View

    private var cameraView: some View {
        ZStack {
            CameraPreviewView { image in
                capturedImage = image
                showingPreview = true
            }
            .ignoresSafeArea()

            // Face guide overlay
            VStack {
                Spacer()
                    .frame(height: 80)

                // Face oval guide
                ZStack {
                    // Darkened background with cutout
                    Color.black.opacity(0.4)
                        .mask(
                            ZStack {
                                Rectangle()
                                Ellipse()
                                    .frame(width: 200, height: 260)
                                    .blendMode(.destinationOut)
                            }
                            .compositingGroup()
                        )

                    // Guide oval border
                    Ellipse()
                        .strokeBorder(Color.white, lineWidth: 2)
                        .frame(width: 200, height: 260)
                }

                Spacer()
                    .frame(height: 40)

                Text("Position your face in the oval")
                    .foregroundColor(.white)
                    .font(.headline)
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                    .background(Color.black.opacity(0.6))
                    .cornerRadius(8)

                Text("Include the job site in the background")
                    .foregroundColor(.white.opacity(0.8))
                    .font(.caption)
                    .padding(.top, 4)

                Spacer()
            }
        }
    }

    // MARK: - Preview View

    private func previewView(image: UIImage) -> some View {
        VStack(spacing: 0) {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            HStack(spacing: 40) {
                Button(action: {
                    capturedImage = nil
                    showingPreview = false
                }) {
                    VStack {
                        Image(systemName: "arrow.counterclockwise")
                            .font(.title)
                        Text("Retake")
                            .font(.caption)
                    }
                    .foregroundColor(.white)
                    .padding()
                }

                Button(action: {
                    if let data = image.jpegData(compressionQuality: 0.8) {
                        photoData = data
                    }
                    isPresented = false
                }) {
                    VStack {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.title)
                        Text("Use Photo")
                            .font(.caption)
                    }
                    .foregroundColor(.green)
                    .padding()
                }
            }
            .padding(.vertical, 20)
            .frame(maxWidth: .infinity)
            .background(Color.black)
        }
        .background(Color.black)
    }
}

// MARK: - Camera Preview UIViewRepresentable

struct CameraPreviewView: UIViewControllerRepresentable {
    let onCapture: (UIImage) -> Void

    func makeUIViewController(context: Context) -> CameraViewController {
        let controller = CameraViewController()
        controller.onCapture = onCapture
        return controller
    }

    func updateUIViewController(_ uiViewController: CameraViewController, context: Context) {}
}

// MARK: - Camera View Controller

class CameraViewController: UIViewController {
    var onCapture: ((UIImage) -> Void)?

    private var captureSession: AVCaptureSession?
    private var photoOutput: AVCapturePhotoOutput?
    private var previewLayer: AVCaptureVideoPreviewLayer?

    override func viewDidLoad() {
        super.viewDidLoad()
        setupCamera()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        startSession()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        stopSession()
    }

    private func setupCamera() {
        captureSession = AVCaptureSession()
        captureSession?.sessionPreset = .photo

        // Use front camera
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front),
              let input = try? AVCaptureDeviceInput(device: camera) else {
            return
        }

        guard captureSession?.canAddInput(input) == true else { return }
        captureSession?.addInput(input)

        photoOutput = AVCapturePhotoOutput()
        guard let output = photoOutput, captureSession?.canAddOutput(output) == true else { return }
        captureSession?.addOutput(output)

        previewLayer = AVCaptureVideoPreviewLayer(session: captureSession!)
        previewLayer?.videoGravity = .resizeAspectFill
        previewLayer?.frame = view.bounds
        view.layer.addSublayer(previewLayer!)

        // Add capture button
        let captureButton = UIButton(type: .system)
        captureButton.setImage(UIImage(systemName: "circle.inset.filled", withConfiguration: UIImage.SymbolConfiguration(pointSize: 72)), for: .normal)
        captureButton.tintColor = .white
        captureButton.addTarget(self, action: #selector(capturePhoto), for: .touchUpInside)
        captureButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(captureButton)

        NSLayoutConstraint.activate([
            captureButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            captureButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -30)
        ])
    }

    private func startSession() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession?.startRunning()
        }
    }

    private func stopSession() {
        captureSession?.stopRunning()
    }

    @objc private func capturePhoto() {
        let settings = AVCapturePhotoSettings()
        photoOutput?.capturePhoto(with: settings, delegate: self)
    }
}

// MARK: - AVCapturePhotoCaptureDelegate

extension CameraViewController: AVCapturePhotoCaptureDelegate {
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        guard error == nil,
              let imageData = photo.fileDataRepresentation(),
              let image = UIImage(data: imageData) else {
            return
        }

        // Mirror the image since we're using front camera
        let mirroredImage = UIImage(cgImage: image.cgImage!, scale: image.scale, orientation: .leftMirrored)

        DispatchQueue.main.async { [weak self] in
            self?.onCapture?(mirroredImage)
        }
    }
}

#Preview {
    PhotoCaptureView(
        photoData: .constant(nil),
        isPresented: .constant(true)
    )
}
