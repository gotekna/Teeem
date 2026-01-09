import SwiftUI

struct EmailListView: View {
    @StateObject private var viewModel = EmailViewModel()
    @State private var searchText = ""

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.emails.isEmpty {
                ProgressView("Loading emails...")
            } else if viewModel.emails.isEmpty {
                ContentUnavailableView("No Emails", systemImage: "envelope", description: Text("Your inbox is empty"))
            } else {
                List(filteredEmails) { email in
                    NavigationLink(value: email) {
                        EmailRowView(email: email)
                    }
                }
                .listStyle(.plain)
                .navigationDestination(for: Email.self) { email in
                    EmailDetailView(email: email)
                }
            }
        }
        .navigationTitle("Inbox")
        .searchable(text: $searchText)
        .refreshable { await viewModel.loadEmails() }
        .task { await viewModel.loadEmails() }
    }

    private var filteredEmails: [Email] {
        searchText.isEmpty ? viewModel.emails : viewModel.emails.filter {
            $0.displaySubject.localizedCaseInsensitiveContains(searchText) ||
            $0.displayFrom.localizedCaseInsensitiveContains(searchText)
        }
    }
}

struct EmailRowView: View {
    let email: Email
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle().fill(email.senderColor.gradient).frame(width: 44, height: 44)
                Text(email.senderInitials).font(.subheadline).fontWeight(.semibold).foregroundColor(.white)
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(email.displayFrom).font(.subheadline).fontWeight(email.isUnread ? .bold : .regular)
                    Spacer()
                    Text(email.formattedDate).font(.caption).foregroundColor(.secondary)
                }
                HStack {
                    if email.isUnread { Circle().fill(.blue).frame(width: 8, height: 8) }
                    Text(email.displaySubject).font(.subheadline).fontWeight(email.isUnread ? .semibold : .regular).lineLimit(1)
                }
                Text(email.displaySnippet).font(.caption).foregroundColor(.secondary).lineLimit(2)
            }
        }
        .padding(.vertical, 4)
    }
}

struct EmailDetailView: View {
    let email: Email
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(email.displaySubject).font(.title2).fontWeight(.bold)
                HStack {
                    ZStack {
                        Circle().fill(email.senderColor.gradient).frame(width: 40, height: 40)
                        Text(email.senderInitials).font(.caption).fontWeight(.semibold).foregroundColor(.white)
                    }
                    VStack(alignment: .leading) {
                        Text(email.displayFrom).font(.subheadline).fontWeight(.semibold)
                        Text(email.formattedDate).font(.caption).foregroundColor(.secondary)
                    }
                }
                Divider()
                Text(email.body ?? "").font(.body)
            }
            .padding()
        }
        .navigationTitle("Email")
        .navigationBarTitleDisplayMode(.inline)
    }
}
