import SwiftUI
import VisionKit

struct DocumentScannerView: View {
    let jobId: Int
    let onDocumentScanned: (ScannedDocument) -> Void
    let onDismiss: () -> Void

    @State private var showScanner = true
    @State private var scannedImages: [UIImage] = []
    @State private var showReview = false

    var body: some View {
        Group {
            if showScanner && VNDocumentCameraViewController.isSupported {
                DocumentCameraView(
                    onScanComplete: { images in
                        scannedImages = images
                        showScanner = false
                        showReview = true
                    },
                    onCancel: onDismiss
                )
                .ignoresSafeArea()
            } else if showReview {
                DocumentReviewView(
                    images: scannedImages,
                    jobId: jobId,
                    onConfirm: { document in
                        onDocumentScanned(document)
                        onDismiss()
                    },
                    onRescan: {
                        scannedImages = []
                        showReview = false
                        showScanner = true
                    },
                    onDismiss: onDismiss
                )
            } else {
                scannerUnavailableView
            }
        }
    }

    private var scannerUnavailableView: some View {
        VStack(spacing: 20) {
            Image(systemName: "doc.viewfinder")
                .font(.system(size: 60))
                .foregroundColor(.secondary)

            Text("Scanner Unavailable")
                .font(.title2)
                .fontWeight(.bold)

            Text("Document scanning is not available on this device.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button("Close") {
                onDismiss()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}

// MARK: - VisionKit Document Camera Wrapper

struct DocumentCameraView: UIViewControllerRepresentable {
    let onScanComplete: ([UIImage]) -> Void
    let onCancel: () -> Void

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let scanner = VNDocumentCameraViewController()
        scanner.delegate = context.coordinator
        return scanner
    }

    func updateUIViewController(_ uiViewController: VNDocumentCameraViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onScanComplete: onScanComplete, onCancel: onCancel)
    }

    class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let onScanComplete: ([UIImage]) -> Void
        let onCancel: () -> Void

        init(onScanComplete: @escaping ([UIImage]) -> Void, onCancel: @escaping () -> Void) {
            self.onScanComplete = onScanComplete
            self.onCancel = onCancel
        }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
            var images: [UIImage] = []
            for i in 0..<scan.pageCount {
                images.append(scan.imageOfPage(at: i))
            }
            onScanComplete(images)
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            onCancel()
        }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
            print("Scanner error: \(error)")
            onCancel()
        }
    }
}

// MARK: - Scanned Document Model

struct ScannedDocument {
    let id: UUID
    let images: [UIImage]
    let pdfData: Data?
    let title: String
    let jobId: Int
    let createdAt: Date

    init(images: [UIImage], title: String, jobId: Int) {
        self.id = UUID()
        self.images = images
        self.title = title
        self.jobId = jobId
        self.createdAt = Date()
        self.pdfData = Self.generatePDF(from: images)
    }

    static func generatePDF(from images: [UIImage]) -> Data? {
        let pdfRenderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 612, height: 792)) // US Letter

        return pdfRenderer.pdfData { context in
            for image in images {
                context.beginPage()

                // Calculate aspect-fit rect
                let pageRect = context.pdfContextBounds
                let imageSize = image.size
                let scale = min(pageRect.width / imageSize.width, pageRect.height / imageSize.height)
                let scaledSize = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
                let origin = CGPoint(
                    x: (pageRect.width - scaledSize.width) / 2,
                    y: (pageRect.height - scaledSize.height) / 2
                )

                image.draw(in: CGRect(origin: origin, size: scaledSize))
            }
        }
    }
}

#Preview {
    DocumentScannerView(
        jobId: 1,
        onDocumentScanned: { _ in },
        onDismiss: {}
    )
}
