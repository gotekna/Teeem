import SwiftUI

struct EmailComposeView: View {
    var replyTo: Email?
    var forwardFrom: Email?
    let onSend: (ComposeEmail) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var toField = ""
    @State private var ccField = ""
    @State private var subject = ""
    @State private var body = ""
    @State private var isSending = false
    @State private var showError = false
    @State private var errorMessage = ""

    private let emailService = EmailService.shared

    var body: some View {
        NavigationStack {
            Form {
                // Recipients
                Section {
                    HStack {
                        Text("To:")
                            .foregroundColor(.secondary)
                            .frame(width: 40, alignment: .leading)
                        TextField("Recipients", text: $toField)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                    }

                    HStack {
                        Text("Cc:")
                            .foregroundColor(.secondary)
                            .frame(width: 40, alignment: .leading)
                        TextField("Cc", text: $ccField)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                    }
                }

                // Subject
                Section {
                    TextField("Subject", text: $subject)
                }

                // Body
                Section {
                    TextEditor(text: $body)
                        .frame(minHeight: 200)
                }

                // Original Email (for reply/forward)
                if let original = replyTo ?? forwardFrom {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(replyTo != nil ? "In reply to:" : "Forwarding:")
                                .font(.caption)
                                .foregroundColor(.secondary)

                            Text(original.displaySubject)
                                .font(.subheadline)
                                .fontWeight(.medium)

                            Text("From: \(original.displayFrom)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    } header: {
                        Text("Original Message")
                    }
                }
            }
            .navigationTitle(navigationTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        sendEmail()
                    } label: {
                        if isSending {
                            ProgressView()
                        } else {
                            Image(systemName: "paperplane.fill")
                        }
                    }
                    .disabled(!canSend || isSending)
                }
            }
            .onAppear {
                setupInitialContent()
            }
            .alert("Send Failed", isPresented: $showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage)
            }
        }
    }

    private var navigationTitle: String {
        if replyTo != nil {
            return "Reply"
        } else if forwardFrom != nil {
            return "Forward"
        } else {
            return "New Email"
        }
    }

    private var canSend: Bool {
        !toField.isEmpty && toField.contains("@")
    }

    private func setupInitialContent() {
        if let reply = replyTo {
            // Reply
            toField = reply.fromAddress ?? ""
            subject = reply.subject?.hasPrefix("Re:") == true
                ? reply.subject ?? ""
                : "Re: \(reply.subject ?? "")"

            let originalText = reply.body ?? ""
            let quotedText = originalText.components(separatedBy: "\n")
                .map { "> \($0)" }
                .joined(separator: "\n")

            body = "\n\n\nOn \(reply.formattedDate), \(reply.displayFrom) wrote:\n\(quotedText)"

        } else if let forward = forwardFrom {
            // Forward
            subject = forward.subject?.hasPrefix("Fwd:") == true
                ? forward.subject ?? ""
                : "Fwd: \(forward.subject ?? "")"

            body = """


            ---------- Forwarded message ----------
            From: \(forward.displayFrom)
            Date: \(forward.formattedDate)
            Subject: \(forward.displaySubject)

            \(forward.body ?? "")
            """
        }
    }

    private func sendEmail() {
        isSending = true

        let toAddresses = toField
            .components(separatedBy: CharacterSet(charactersIn: ",;"))
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        let ccAddresses = ccField
            .components(separatedBy: CharacterSet(charactersIn: ",;"))
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        let compose = ComposeEmail(
            to: toAddresses,
            cc: ccAddresses,
            subject: subject,
            body: body,
            replyToId: replyTo?.id,
            forwardFromId: forwardFrom?.id
        )

        Task {
            do {
                if let replyTo = replyTo {
                    _ = try await emailService.reply(to: replyTo.id, body: body)
                } else if let forwardFrom = forwardFrom {
                    _ = try await emailService.forward(
                        emailId: forwardFrom.id,
                        to: toAddresses,
                        body: body
                    )
                } else {
                    _ = try await emailService.sendEmail(compose)
                }

                await MainActor.run {
                    isSending = false
                    onSend(compose)
                }
            } catch {
                await MainActor.run {
                    isSending = false
                    errorMessage = error.localizedDescription
                    showError = true
                }
            }
        }
    }
}

#Preview("New Email") {
    EmailComposeView(onSend: { _ in })
}

#Preview("Reply") {
    EmailComposeView(
        replyTo: Email(
            id: 1,
            subject: "Project Update",
            snippet: nil,
            body: "Hi, here's the update...",
            htmlBody: nil,
            fromAddress: "john@example.com",
            fromName: "John Smith",
            toAddresses: nil,
            ccAddresses: nil,
            receivedAt: Date(),
            sentAt: nil,
            isRead: true,
            isStarred: nil,
            isDraft: nil,
            isSent: nil,
            hasAttachments: nil,
            attachmentCount: nil,
            folderId: nil,
            folderName: nil,
            threadId: nil,
            jobId: nil,
            jobName: nil,
            contactId: nil,
            contactName: nil,
            createdAt: nil,
            updatedAt: nil
        ),
        onSend: { _ in }
    )
}
