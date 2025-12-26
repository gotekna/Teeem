import SwiftUI
import Foundation

// MARK: - Photo Gallery ViewModel

@MainActor
class PhotoGalleryViewModel: ObservableObject {
    @Published var photos: [Photo] = []
    @Published var pendingPhotos: [PendingPhoto] = []
    @Published var isLoading = false
    @Published var error: String?

    private let apiClient = APIClient.shared
    private let uploadQueue = PhotoUploadQueue.shared

    init() {
        // Observe upload queue changes
        Task {
            for await pending in uploadQueue.pendingPhotosStream() {
                self.pendingPhotos = pending
            }
        }
    }

    func loadPhotos(taskId: Int) async {
        isLoading = true
        defer { isLoading = false }

        do {
            photos = try await apiClient.getTaskPhotos(taskId: taskId)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func queuePhoto(_ photo: CapturedPhoto) {
        uploadQueue.enqueue(photo)
    }

    func retryUpload(_ pending: PendingPhoto) {
        uploadQueue.retry(pending)
    }

    func cancelUpload(_ pending: PendingPhoto) {
        uploadQueue.cancel(pending)
    }
}

// MARK: - Pending Photo Model

struct PendingPhoto: Identifiable {
    let id: UUID
    let image: UIImage
    let capturedPhoto: CapturedPhoto
    var isUploading: Bool = false
    var error: String?
    var retryCount: Int = 0

    init(capturedPhoto: CapturedPhoto) {
        self.id = UUID()
        self.image = capturedPhoto.image
        self.capturedPhoto = capturedPhoto
    }
}

// MARK: - Photo Upload Queue

actor PhotoUploadQueue {
    static let shared = PhotoUploadQueue()

    private var queue: [PendingPhoto] = []
    private var isProcessing = false
    private var continuation: AsyncStream<[PendingPhoto]>.Continuation?

    private let apiClient = APIClient.shared
    private let maxRetries = 3

    func enqueue(_ photo: CapturedPhoto) {
        let pending = PendingPhoto(capturedPhoto: photo)
        queue.append(pending)
        notifyUpdate()

        Task {
            await processQueue()
        }
    }

    func retry(_ pending: PendingPhoto) {
        if let index = queue.firstIndex(where: { $0.id == pending.id }) {
            queue[index].error = nil
            queue[index].retryCount += 1
            notifyUpdate()

            Task {
                await processQueue()
            }
        }
    }

    func cancel(_ pending: PendingPhoto) {
        queue.removeAll { $0.id == pending.id }
        notifyUpdate()
    }

    func pendingPhotosStream() -> AsyncStream<[PendingPhoto]> {
        AsyncStream { continuation in
            self.continuation = continuation
            continuation.yield(queue)
        }
    }

    private func processQueue() async {
        guard !isProcessing else { return }
        isProcessing = true

        while let index = queue.firstIndex(where: { !$0.isUploading && $0.error == nil && $0.retryCount < maxRetries }) {
            queue[index].isUploading = true
            notifyUpdate()

            let pending = queue[index]

            do {
                guard let imageData = pending.capturedPhoto.imageData else {
                    throw UploadError.invalidData
                }

                _ = try await apiClient.uploadPhoto(
                    taskId: pending.capturedPhoto.taskId,
                    imageData: imageData,
                    photoType: pending.capturedPhoto.photoType.rawValue,
                    latitude: pending.capturedPhoto.latitude,
                    longitude: pending.capturedPhoto.longitude
                )

                // Success - remove from queue
                queue.removeAll { $0.id == pending.id }
                notifyUpdate()

            } catch {
                // Failed - mark with error
                if let idx = queue.firstIndex(where: { $0.id == pending.id }) {
                    queue[idx].isUploading = false
                    queue[idx].error = error.localizedDescription
                    notifyUpdate()
                }
            }
        }

        isProcessing = false
    }

    private func notifyUpdate() {
        continuation?.yield(queue)
    }

    enum UploadError: Error {
        case invalidData
    }
}
