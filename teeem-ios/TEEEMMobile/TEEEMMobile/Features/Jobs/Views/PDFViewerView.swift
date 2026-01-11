import SwiftUI
import PDFKit

struct PDFViewerView: View {
    let fileId: String
    let fileName: String

    @State private var pdfDocument: PDFDocument?
    @State private var isLoading = true
    @State private var error: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Group {
            if isLoading {
                VStack(spacing: 16) {
                    ProgressView()
                        .scaleEffect(1.5)
                    Text("Loading PDF...")
                        .foregroundColor(.secondary)
                }
            } else if let error = error {
                ContentUnavailableView("Error", systemImage: "exclamationmark.triangle", description: Text(error))
            } else if let document = pdfDocument {
                PDFKitView(document: document)
                    .edgesIgnoringSafeArea(.bottom)
            } else {
                ContentUnavailableView("No PDF", systemImage: "doc.text", description: Text("Could not load PDF"))
            }
        }
        .navigationTitle(fileName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if let document = pdfDocument {
                    ShareLink(item: document, preview: SharePreview(fileName))
                }
            }
        }
        .task {
            await loadPDF()
        }
    }

    private func loadPDF() async {
        do {
            let data = try await downloadPDF()
            if let document = PDFDocument(data: data) {
                pdfDocument = document
            } else {
                error = "Invalid PDF file"
            }
        } catch {
            self.error = error.localizedDescription
            print("PDF load error: \(error)")
        }
        isLoading = false
    }

    private func downloadPDF() async throws -> Data {
        let baseURL = "https://teeemlive-ce8e2660a615.herokuapp.com/api/v1"
        let urlString = "\(baseURL)/documents/download?file_id=\(fileId)"

        guard let url = URL(string: urlString) else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        if let token = AuthManager.shared.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }

        if httpResponse.statusCode != 200 {
            // Try to get error message from JSON response
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let errorMsg = json["error"] as? String {
                throw NSError(domain: "", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorMsg])
            }
            throw URLError(.badServerResponse)
        }

        return data
    }
}

// MARK: - PDFKit UIViewRepresentable
struct PDFKitView: UIViewRepresentable {
    let document: PDFDocument

    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.document = document
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        return pdfView
    }

    func updateUIView(_ uiView: PDFView, context: Context) {
        uiView.document = document
    }
}

// Make PDFDocument transferable for sharing
extension PDFDocument: Transferable {
    public static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .pdf) { pdf in
            pdf.dataRepresentation() ?? Data()
        }
    }
}
