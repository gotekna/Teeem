import SwiftUI
import WebKit

struct EmailDetailView: View {
    let email: Email
    @ObservedObject var viewModel: EmailViewModel

    @State private var showReply = false
    @State private var showForward = false
    @State private var showActions = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Header
                headerSection

                Divider()

                // Body
                if let htmlBody = email.htmlBody, !htmlBody.isEmpty {
                    HTMLContentView(html: htmlBody)
                        .frame(minHeight: 200)
                } else if let body = email.body {
                    Text(body)
                        .font(.body)
                        .textSelection(.enabled)
                } else {
                    Text("No content")
                        .foregroundColor(.secondary)
                        .italic()
                }

                // Attachments
                if email.hasAttachments == true {
                    attachmentsSection
                }

                // Job Link
                if let jobName = email.jobName, let jobId = email.jobId {
                    jobLinkSection(jobId: jobId, jobName: jobName)
                }
            }
            .padding()
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .bottomBar) {
                Button {
                    Task { await viewModel.archive(email) }
                } label: {
                    Image(systemName: "archivebox")
                }

                Spacer()

                Button {
                    Task { await viewModel.delete(email) }
                } label: {
                    Image(systemName: "trash")
                }

                Spacer()

                Button {
                    Task {
                        if email.isUnread {
                            await viewModel.markAsRead(email)
                        } else {
                            await viewModel.markAsUnread(email)
                        }
                    }
                } label: {
                    Image(systemName: email.isUnread ? "envelope.open" : "envelope.badge")
                }

                Spacer()

                Button {
                    showReply = true
                } label: {
                    Image(systemName: "arrowshape.turn.up.left")
                }

                Spacer()

                Menu {
                    Button {
                        showReply = true
                    } label: {
                        Label("Reply", systemImage: "arrowshape.turn.up.left")
                    }

                    Button {
                        showForward = true
                    } label: {
                        Label("Forward", systemImage: "arrowshape.turn.up.right")
                    }

                    Divider()

                    Button {
                        Task { await viewModel.toggleStar(email) }
                    } label: {
                        Label(
                            email.isStarred == true ? "Unstar" : "Star",
                            systemImage: email.isStarred == true ? "star.slash" : "star"
                        )
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .task {
            if email.isUnread {
                await viewModel.markAsRead(email)
            }
        }
        .sheet(isPresented: $showReply) {
            EmailComposeView(
                replyTo: email,
                onSend: { _ in showReply = false }
            )
        }
        .sheet(isPresented: $showForward) {
            EmailComposeView(
                forwardFrom: email,
                onSend: { _ in showForward = false }
            )
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Subject
            HStack {
                Text(email.displaySubject)
                    .font(.title2)
                    .fontWeight(.bold)

                if email.isStarred == true {
                    Image(systemName: "star.fill")
                        .foregroundColor(.yellow)
                }
            }

            // From
            HStack(alignment: .top, spacing: 12) {
                ZStack {
                    Circle()
                        .fill(email.senderColor.gradient)
                        .frame(width: 48, height: 48)

                    Text(email.senderInitials)
                        .font(.headline)
                        .foregroundColor(.white)
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(email.displayFrom)
                            .font(.headline)

                        Spacer()

                        Text(email.formattedDate)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    if let fromAddress = email.fromAddress {
                        Text(fromAddress)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    // To
                    if let toAddresses = email.toAddresses, !toAddresses.isEmpty {
                        HStack {
                            Text("To:")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(toAddresses.joined(separator: ", "))
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        }
                    }

                    // CC
                    if let ccAddresses = email.ccAddresses, !ccAddresses.isEmpty {
                        HStack {
                            Text("Cc:")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(ccAddresses.joined(separator: ", "))
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Attachments Section

    private var attachmentsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Attachments")
                .font(.headline)

            // Placeholder for attachments
            HStack {
                Image(systemName: "paperclip")
                Text("\(email.attachmentCount ?? 1) attachment(s)")
                    .font(.subheadline)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.systemGray6))
            .cornerRadius(8)
        }
    }

    // MARK: - Job Link Section

    private func jobLinkSection(jobId: Int, jobName: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Linked Job")
                .font(.headline)

            NavigationLink(value: jobId) {
                HStack {
                    Image(systemName: "briefcase.fill")
                        .foregroundColor(.blue)
                    Text(jobName)
                        .foregroundColor(.primary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(8)
            }
        }
    }
}

// MARK: - HTML Content View

struct HTMLContentView: UIViewRepresentable {
    let html: String

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let styledHTML = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    font-size: 16px;
                    line-height: 1.5;
                    color: #333;
                    margin: 0;
                    padding: 0;
                }
                @media (prefers-color-scheme: dark) {
                    body { color: #fff; }
                }
                img { max-width: 100%; height: auto; }
                a { color: #007AFF; }
            </style>
        </head>
        <body>\(html)</body>
        </html>
        """
        webView.loadHTMLString(styledHTML, baseURL: nil)
    }
}

#Preview {
    NavigationStack {
        EmailDetailView(
            email: Email(
                id: 1,
                subject: "Project Update - Kitchen Renovation",
                snippet: "Hi, here's the latest update on the kitchen renovation project...",
                body: "Hi,\n\nHere's the latest update on the kitchen renovation project. We've completed the demolition phase and are ready to begin installation.\n\nBest regards,\nJohn",
                htmlBody: nil,
                fromAddress: "john@example.com",
                fromName: "John Smith",
                toAddresses: ["you@teeem.com.au"],
                ccAddresses: nil,
                receivedAt: Date(),
                sentAt: nil,
                isRead: false,
                isStarred: true,
                isDraft: false,
                isSent: false,
                hasAttachments: true,
                attachmentCount: 2,
                folderId: 1,
                folderName: "Inbox",
                threadId: nil,
                jobId: 1,
                jobName: "J2024-001 - Smith Kitchen",
                contactId: 1,
                contactName: "John Smith",
                createdAt: Date(),
                updatedAt: Date()
            ),
            viewModel: EmailViewModel()
        )
    }
}
