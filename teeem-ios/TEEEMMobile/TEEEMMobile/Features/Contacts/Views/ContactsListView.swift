import SwiftUI

struct ContactsListView: View {
    @StateObject private var viewModel = ContactsViewModel()
    @State private var searchText = ""

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.contacts.isEmpty {
                ProgressView("Loading contacts...")
            } else if viewModel.contacts.isEmpty {
                ContentUnavailableView("No Contacts", systemImage: "person.2", description: Text("No contacts found"))
            } else {
                List(filteredContacts) { contact in
                    NavigationLink(value: contact) {
                        ContactRowView(contact: contact)
                    }
                }
                .listStyle(.plain)
                .navigationDestination(for: Contact.self) { contact in
                    ContactDetailView(contact: contact, viewModel: viewModel)
                }
            }
        }
        .navigationTitle("Contacts")
        .searchable(text: $searchText)
        .refreshable { await viewModel.loadContacts() }
        .task { await viewModel.loadContacts() }
    }

    private var filteredContacts: [Contact] {
        searchText.isEmpty ? viewModel.contacts : viewModel.contacts.filter { $0.displayName.localizedCaseInsensitiveContains(searchText) }
    }
}

struct ContactRowView: View {
    let contact: Contact
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(contact.contactColor.gradient).frame(width: 44, height: 44)
                Text(contact.initials).font(.headline).foregroundColor(.white)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(contact.displayName).font(.headline)
                if let company = contact.company {
                    Text(company).font(.subheadline).foregroundColor(.secondary)
                }
            }
            Spacer()
            Label(contact.contactType.displayName, systemImage: contact.contactType.icon)
                .font(.caption2)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(contact.contactType.color.opacity(0.15))
                .foregroundColor(contact.contactType.color)
                .cornerRadius(6)
        }
    }
}

struct ContactDetailView: View {
    let contact: Contact
    @ObservedObject var viewModel: ContactsViewModel

    var body: some View {
        List {
            Section {
                if let email = contact.email {
                    Button { viewModel.email(contact: contact) } label: {
                        LabeledContent("Email", value: email)
                    }
                }
                if let phone = contact.displayPhone {
                    Button { viewModel.call(contact: contact) } label: {
                        LabeledContent("Phone", value: phone)
                    }
                }
            }
        }
        .navigationTitle(contact.displayName)
    }
}
