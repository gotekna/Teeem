import SwiftUI

struct DocumentReviewView: View {
    let images: [UIImage]
    let jobId: Int
    let onConfirm: (ScannedDocument) -> Void
    let onRescan: () -> Void
    let onDismiss: () -> Void

    @State private var documentTitle = ""
    @State private var selectedPageIndex = 0
    @State private var showPDFPreview = false
    @State private var isUploading = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Page Preview
                TabView(selection: $selectedPageIndex) {
                    ForEach(images.indices, id: \.self) { index in
                        Image(uiImage: images[index])
                            .resizable()
                            .scaledToFit()
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .automatic))
                .frame(height: 400)
                .background(Color.black)

                // Page indicator
                Text("Page \(selectedPageIndex + 1) of \(images.count)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.vertical, 8)

                // Form
                Form {
                    Section {
                        TextField("Document Title", text: $documentTitle)
                    } header: {
                        Text("Document Name")
                    } footer: {
                        Text("Give this document a descriptive name.")
                    }

                    Section {
                        HStack {
                            Text("Pages")
                            Spacer()
                            Text("\(images.count)")
                                .foregroundColor(.secondary)
                        }

                        Button {
                            showPDFPreview = true
                        } label: {
                            Label("Preview PDF", systemImage: "doc.fill")
                        }
                    } header: {
                        Text("Document Info")
                    }
                }
            }
            .navigationTitle("Review Scan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Menu {
                        Button {
                            onRescan()
                        } label: {
                            Label("Rescan", systemImage: "arrow.clockwise")
                        }

                        Button(role: .destructive) {
                            onDismiss()
                        } label: {
                            Label("Discard", systemImage: "trash")
                        }
                    } label: {
                        Text("Cancel")
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        uploadDocument()
                    } label: {
                        if isUploading {
                            ProgressView()
                        } else {
                            Text("Upload")
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(documentTitle.isEmpty || isUploading)
                }
            }
            .sheet(isPresented: $showPDFPreview) {
                PDFPreviewView(
                    images: images,
                    title: documentTitle.isEmpty ? "Scanned Document" : documentTitle
                )
            }
        }
    }

    private func uploadDocument() {
        isUploading = true

        let document = ScannedDocument(
            images: images,
            title: documentTitle,
            jobId: jobId
        )

        // Simulate upload delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            isUploading = false
            onConfirm(document)
        }
    }
}

#Preview {
    DocumentReviewView(
        images: [UIImage(systemName: "doc")!, UIImage(systemName: "doc.fill")!],
        jobId: 1,
        onConfirm: { _ in },
        onRescan: {},
        onDismiss: {}
    )
}
