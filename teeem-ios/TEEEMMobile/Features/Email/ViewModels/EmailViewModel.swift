import SwiftUI

@MainActor
class EmailViewModel: ObservableObject {
    @Published var emails: [Email] = []
    @Published var folders: [EmailFolder] = []
    @Published var selectedFolder: EmailFolder?
    @Published var isLoading = false
    @Published var isSyncing = false
    @Published var error: String?
    @Published var unreadCount = 0

    private let emailService = EmailService.shared
    private var currentPage = 1
    private var hasMorePages = true

    // MARK: - Load Data

    func loadFolders() async {
        do {
            folders = try await emailService.getFolders()

            // Select inbox by default
            if selectedFolder == nil {
                selectedFolder = folders.first { $0.type == .inbox } ?? folders.first
            }

            // Calculate total unread
            unreadCount = folders.reduce(0) { $0 + ($1.unreadCount ?? 0) }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadEmails(refresh: Bool = false) async {
        if refresh {
            currentPage = 1
            hasMorePages = true
        }

        guard hasMorePages else { return }

        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await emailService.getEmails(
                folderId: selectedFolder?.id,
                page: currentPage
            )

            if refresh {
                emails = response.data
            } else {
                emails.append(contentsOf: response.data)
            }

            if let meta = response.meta {
                hasMorePages = (meta.currentPage ?? 1) < (meta.totalPages ?? 1)
                currentPage = (meta.currentPage ?? 1) + 1
            } else {
                hasMorePages = response.data.count >= 50
                currentPage += 1
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadMoreIfNeeded(currentEmail: Email) async {
        guard let index = emails.firstIndex(where: { $0.id == currentEmail.id }) else { return }

        // Load more when near the end
        if index >= emails.count - 5 {
            await loadEmails()
        }
    }

    func selectFolder(_ folder: EmailFolder) async {
        selectedFolder = folder
        emails = []
        await loadEmails(refresh: true)
    }

    // MARK: - Sync

    func syncEmails() async {
        isSyncing = true
        defer { isSyncing = false }

        do {
            _ = try await emailService.syncEmails()
            await loadEmails(refresh: true)
            await loadFolders()
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Email Actions

    func markAsRead(_ email: Email) async {
        guard email.isUnread else { return }

        do {
            try await emailService.markAsRead(id: email.id)
            updateEmailInList(email.id) { $0 = Email(
                id: $0.id, subject: $0.subject, snippet: $0.snippet, body: $0.body,
                htmlBody: $0.htmlBody, fromAddress: $0.fromAddress, fromName: $0.fromName,
                toAddresses: $0.toAddresses, ccAddresses: $0.ccAddresses,
                receivedAt: $0.receivedAt, sentAt: $0.sentAt, isRead: true,
                isStarred: $0.isStarred, isDraft: $0.isDraft, isSent: $0.isSent,
                hasAttachments: $0.hasAttachments, attachmentCount: $0.attachmentCount,
                folderId: $0.folderId, folderName: $0.folderName, threadId: $0.threadId,
                jobId: $0.jobId, jobName: $0.jobName, contactId: $0.contactId,
                contactName: $0.contactName, createdAt: $0.createdAt, updatedAt: $0.updatedAt
            )}
            unreadCount = max(0, unreadCount - 1)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func markAsUnread(_ email: Email) async {
        guard !email.isUnread else { return }

        do {
            try await emailService.markAsUnread(id: email.id)
            updateEmailInList(email.id) { $0 = Email(
                id: $0.id, subject: $0.subject, snippet: $0.snippet, body: $0.body,
                htmlBody: $0.htmlBody, fromAddress: $0.fromAddress, fromName: $0.fromName,
                toAddresses: $0.toAddresses, ccAddresses: $0.ccAddresses,
                receivedAt: $0.receivedAt, sentAt: $0.sentAt, isRead: false,
                isStarred: $0.isStarred, isDraft: $0.isDraft, isSent: $0.isSent,
                hasAttachments: $0.hasAttachments, attachmentCount: $0.attachmentCount,
                folderId: $0.folderId, folderName: $0.folderName, threadId: $0.threadId,
                jobId: $0.jobId, jobName: $0.jobName, contactId: $0.contactId,
                contactName: $0.contactName, createdAt: $0.createdAt, updatedAt: $0.updatedAt
            )}
            unreadCount += 1
        } catch {
            self.error = error.localizedDescription
        }
    }

    func toggleStar(_ email: Email) async {
        do {
            if email.isStarred == true {
                try await emailService.unstar(id: email.id)
            } else {
                try await emailService.star(id: email.id)
            }
            updateEmailInList(email.id) { $0 = Email(
                id: $0.id, subject: $0.subject, snippet: $0.snippet, body: $0.body,
                htmlBody: $0.htmlBody, fromAddress: $0.fromAddress, fromName: $0.fromName,
                toAddresses: $0.toAddresses, ccAddresses: $0.ccAddresses,
                receivedAt: $0.receivedAt, sentAt: $0.sentAt, isRead: $0.isRead,
                isStarred: !($0.isStarred ?? false), isDraft: $0.isDraft, isSent: $0.isSent,
                hasAttachments: $0.hasAttachments, attachmentCount: $0.attachmentCount,
                folderId: $0.folderId, folderName: $0.folderName, threadId: $0.threadId,
                jobId: $0.jobId, jobName: $0.jobName, contactId: $0.contactId,
                contactName: $0.contactName, createdAt: $0.createdAt, updatedAt: $0.updatedAt
            )}
        } catch {
            self.error = error.localizedDescription
        }
    }

    func archive(_ email: Email) async {
        do {
            try await emailService.archive(id: email.id)
            emails.removeAll { $0.id == email.id }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func delete(_ email: Email) async {
        do {
            try await emailService.delete(id: email.id)
            emails.removeAll { $0.id == email.id }
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Helpers

    private func updateEmailInList(_ id: Int, update: (inout Email) -> Void) {
        if let index = emails.firstIndex(where: { $0.id == id }) {
            update(&emails[index])
        }
    }
}
