import SwiftUI
import AVFoundation
import CoreLocation

@MainActor
class CameraService: NSObject, ObservableObject {
    @Published var capturedImage: UIImage?
    @Published var isAuthorized = false
    @Published var error: CameraError?

    private var captureSession: AVCaptureSession?
    private var photoOutput: AVCapturePhotoOutput?
    private var currentDevice: AVCaptureDevice?

    private var photoContinuation: CheckedContinuation<UIImage?, Never>?

    enum CameraError: Error, LocalizedError {
        case notAuthorized
        case setupFailed
        case captureFailed

        var errorDescription: String? {
            switch self {
            case .notAuthorized:
                return "Camera access not authorized. Please enable in Settings."
            case .setupFailed:
                return "Failed to set up camera."
            case .captureFailed:
                return "Failed to capture photo."
            }
        }
    }

    override init() {
        super.init()
        checkAuthorization()
    }

    func checkAuthorization() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            isAuthorized = true
        case .notDetermined:
            Task {
                let granted = await AVCaptureDevice.requestAccess(for: .video)
                await MainActor.run {
                    self.isAuthorized = granted
                }
            }
        default:
            isAuthorized = false
        }
    }

    func setupSession() -> AVCaptureSession? {
        guard isAuthorized else {
            error = .notAuthorized
            return nil
        }

        let session = AVCaptureSession()
        session.sessionPreset = .photo

        // Get camera device
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            error = .setupFailed
            return nil
        }

        currentDevice = device

        do {
            let input = try AVCaptureDeviceInput(device: device)
            if session.canAddInput(input) {
                session.addInput(input)
            }

            let output = AVCapturePhotoOutput()
            if session.canAddOutput(output) {
                session.addOutput(output)
                photoOutput = output
            }

            captureSession = session
            return session
        } catch {
            self.error = .setupFailed
            return nil
        }
    }

    func capturePhoto() async -> UIImage? {
        guard let photoOutput = photoOutput else {
            error = .captureFailed
            return nil
        }

        let settings = AVCapturePhotoSettings()
        settings.flashMode = .auto

        return await withCheckedContinuation { continuation in
            self.photoContinuation = continuation
            photoOutput.capturePhoto(with: settings, delegate: self)
        }
    }

    func switchCamera() {
        guard let session = captureSession else { return }

        session.beginConfiguration()

        // Remove current input
        if let currentInput = session.inputs.first as? AVCaptureDeviceInput {
            session.removeInput(currentInput)
        }

        // Get new camera position
        let newPosition: AVCaptureDevice.Position = currentDevice?.position == .back ? .front : .back

        guard let newDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: newPosition),
              let newInput = try? AVCaptureDeviceInput(device: newDevice) else {
            session.commitConfiguration()
            return
        }

        if session.canAddInput(newInput) {
            session.addInput(newInput)
            currentDevice = newDevice
        }

        session.commitConfiguration()
    }

    func toggleFlash() {
        guard let device = currentDevice, device.hasTorch else { return }

        do {
            try device.lockForConfiguration()
            device.torchMode = device.torchMode == .on ? .off : .on
            device.unlockForConfiguration()
        } catch {
            print("Flash toggle failed: \(error)")
        }
    }
}

// MARK: - AVCapturePhotoCaptureDelegate

extension CameraService: AVCapturePhotoCaptureDelegate {
    nonisolated func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        Task { @MainActor in
            if let error = error {
                print("Photo capture error: \(error)")
                self.photoContinuation?.resume(returning: nil)
                self.photoContinuation = nil
                return
            }

            guard let data = photo.fileDataRepresentation(),
                  let image = UIImage(data: data) else {
                self.photoContinuation?.resume(returning: nil)
                self.photoContinuation = nil
                return
            }

            self.capturedImage = image
            self.photoContinuation?.resume(returning: image)
            self.photoContinuation = nil
        }
    }
}
