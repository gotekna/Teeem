import SwiftUI

struct EmailListView: View {
    @StateObject private var viewModel = EmailViewModel()
    @EnvironmentObject var networkMonitor: NetworkMonitor
    @State private var searchText = ""
    @State private var showCompose = false
    @State private var showFolders = false
    @Binding var navigateToEmailId: Int?
    @State private var selectedEmail: Email?

    init(navigateToEmailId: Binding<Int?> = .constant(nil)) {
        _navigateToEmailId = navigateToEmailId
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.emails.isEmpty {
                loadingView
            } else if viewModel.emails.isEmpty {
                emptyStateView
            } else {
                emailList
            }
        }
        .navigationTitle(viewModel.selectedFolder?.name ?? "Inbox")
        .searchable(text: $searchText, prompt: "Search emails...")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                HStack(spacing: 8) {
                    Button {
                        showFolders = true
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: viewModel.selectedFolder?.icon ?? "tray.fill")
                            if viewModel.unreadCount > 0 {
                                Text("\(viewModel.unreadCount)")
                                    .font(.caption2)
                                    .fontWeight(.bold)
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.red)
                                    .clipShape(Capsule())
                            }
                        }
                    }

                    if !networkMonitor.isConnected {
                        OfflineIndicator()
                    }
                }
            }

            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 16) {
                    Button {
                        Task { await viewModel.syncEmails() }
                    } label: {
                        if viewModel.isSyncing {
                            ProgressView()
                        } else {
                            Image(systemName: "arrow.clockwise")
                        }
                    }

                    Button {
                        showCompose = true
                    } label: {
                        Image(systemName: "square.and.pencil")
                    }
                }
            }
        }
        .refreshable {
            await viewModel.loadEmails(refresh: true)
        }
        .task {
            await viewModel.loadFolders()
            await viewModel.loadEmails(refresh: true)
        }
        .sheet(isPresented: $showFolders) {
            FolderListSheet(
                folders: viewModel.folders,
                selectedFolder: viewModel.selectedFolder,
                onSelect: { folder in
                    Task { await viewModel.selectFolder(folder) }
                    showFolders = false
                }
            )
            .presentationDetents([.medium])
        }
        .sheet(isPresented: $showCompose) {
            EmailComposeView(onSend: { _ in
                showCompose = false
                Task { await viewModel.loadEmails(refresh: true) }
            })
        }
        .alert("Error", isPresented: .init(
            get: { viewModel.error != nil },
            set: { if !$0 { viewModel.error = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.error ?? "")
        }
        .onChange(of: navigateToEmailId) { _, emailId in
            if let emailId = emailId,
               let email = viewModel.emails.first(where: { $0.id == emailId }) {
                selectedEmail = email
                navigateToEmailId = nil
            }
        }
        .navigationDestination(item: $selectedEmail) { email in
            EmailDetailView(email: email, viewModel: viewModel)
        }
    }

    // MARK: - Email List

    private var emailList: some View {
        List {
            ForEach(filteredEmails) { email in
                NavigationLink(value: email) {
                    EmailRowView(email: email)
                        .task {
                            await viewModel.loadMoreIfNeeded(currentEmail: email)
                        }
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                    Button(role: .destructive) {
                        Task { await viewModel.delete(email) }
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }

                    Button {
                        Task { await viewModel.archive(email) }
                    } label: {
                        Label("Archive", systemImage: "archivebox")
                    }
                    .tint(.blue)
                }
                .swipeActions(edge: .leading) {
                    Button {
                        Task {
                            if email.isUnread {
                                await viewModel.markAsRead(email)
                            } else {
                                await viewModel.markAsUnread(email)
                            }
                        }
                    } label: {
                        Label(
                            email.isUnread ? "Read" : "Unread",
                            systemImage: email.isUnread ? "envelope.open" : "envelope.badge"
                        )
                    }
                    .tint(.purple)

                    Button {
                        Task { await viewModel.toggleStar(email) }
                    } label: {
                        Label(
                            email.isStarred == true ? "Unstar" : "Star",
                            systemImage: email.isStarred == true ? "star.slash" : "star.fill"
                        )
                    }
                    .tint(.yellow)
                }
            }
        }
        .listStyle(.plain)
        .navigationDestination(for: Email.self) { email in
            EmailDetailView(email: email, viewModel: viewModel)
        }
    }

    private var filteredEmails: [Email] {
        if searchText.isEmpty {
            return viewModel.emails
        }
        return viewModel.emails.filter { email in
            email.displaySubject.localizedCaseInsensitiveContains(searchText) ||
            email.displayFrom.localizedCaseInsensitiveContains(searchText) ||
            email.displaySnippet.localizedCaseInsensitiveContains(searchText)
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Loading emails...")
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        ContentUnavailableView {
            Label("No Emails", systemImage: "tray")
        } description: {
            Text("Your inbox is empty.")
        } actions: {
            Button {
                Task { await viewModel.syncEmails() }
            } label: {
                Label("Sync", systemImage: "arrow.clockwise")
            }
            .buttonStyle(.borderedProminent)
        }
    }
}

// MARK: - Email Row View

struct EmailRowView: View {
    let email: Email

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Sender Avatar
            ZStack {
                Circle()
                    .fill(email.senderColor.gradient)
                    .frame(width: 44, height: 44)

                Text(email.senderInitials)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
            }

            VStack(alignment: .leading, spacing: 4) {
                // From and Date
                HStack {
                    Text(email.displayFrom)
                        .font(.subheadline)
                        .fontWeight(email.isUnread ? .bold : .regular)
                        .lineLimit(1)

                    Spacer()

                    Text(email.formattedDate)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                // Subject
                HStack {
                    if email.isUnread {
                        Circle()
                            .fill(Color.blue)
                            .frame(width: 8, height: 8)
                    }

                    Text(email.displaySubject)
                        .font(.subheadline)
                        .fontWeight(email.isUnread ? .semibold : .regular)
                        .lineLimit(1)

                    if email.isStarred == true {
                        Image(systemName: "star.fill")
                            .font(.caption)
                            .foregroundColor(.yellow)
                    }
                }

                // Snippet
                Text(email.displaySnippet)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)

                // Attachments and Job
                HStack(spacing: 12) {
                    if email.hasAttachments == true {
                        Label("\(email.attachmentCount ?? 1)", systemImage: "paperclip")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }

                    if let jobName = email.jobName {
                        Label(jobName, systemImage: "briefcase")
                            .font(.caption2)
                            .foregroundColor(.blue)
                            .lineLimit(1)
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Folder List Sheet

struct FolderListSheet: View {
    let folders: [EmailFolder]
    let selectedFolder: EmailFolder?
    let onSelect: (EmailFolder) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List(folders) { folder in
                Button {
                    onSelect(folder)
                } label: {
                    HStack {
                        Image(systemName: folder.icon)
                            .foregroundColor(.accentColor)
                            .frame(width: 24)

                        Text(folder.name)

                        Spacer()

                        if let unread = folder.unreadCount, unread > 0 {
                            Text("\(unread)")
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(Color.blue)
                                .clipShape(Capsule())
                        }

                        if folder.id == selectedFolder?.id {
                            Image(systemName: "checkmark")
                                .foregroundColor(.accentColor)
                        }
                    }
                }
                .foregroundColor(.primary)
            }
            .navigationTitle("Folders")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

#Preview {
    EmailListView()
}
