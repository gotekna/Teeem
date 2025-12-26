import SwiftUI
import PDFKit

struct PDFPreviewView: View {
    let images: [UIImage]
    let title: String
    @Environment(\.dismiss) private var dismiss

    @State private var pdfData: Data?

    var body: some View {
        NavigationStack {
            Group {
                if let data = pdfData {
                    PDFKitView(data: data)
                } else {
                    ProgressView("Generating PDF...")
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .primaryAction) {
                    if let data = pdfData {
                        ShareLink(
                            item: PDFDocument(data: data)!,
                            preview: SharePreview(title, image: Image(systemName: "doc.fill"))
                        )
                    }
                }
            }
            .task {
                pdfData = ScannedDocument.generatePDF(from: images)
            }
        }
    }
}

// MARK: - PDFKit View Wrapper

struct PDFKitView: UIViewRepresentable {
    let data: Data

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical

        if let document = PDFDocument(data: data) {
            pdfView.document = document
        }

        return pdfView
    }

    func updateUIView(_ uiView: PDFView, context: Context) {
        if let document = PDFDocument(data: data) {
            uiView.document = document
        }
    }
}

// MARK: - PDFDocument Transferable Conformance

extension PDFDocument: Transferable {
    public static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .pdf) { pdf in
            pdf.dataRepresentation() ?? Data()
        }
    }
}

#Preview {
    PDFPreviewView(
        images: [UIImage(systemName: "doc.text")!],
        title: "Sample Document"
    )
}
