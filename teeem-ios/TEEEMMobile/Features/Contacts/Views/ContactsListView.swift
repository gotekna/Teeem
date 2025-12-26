import SwiftUI

struct ContactsListView: View {
    @StateObject private var viewModel = ContactsViewModel()
    @EnvironmentObject var networkMonitor: NetworkMonitor
    @State private var searchText = ""

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.contacts.isEmpty {
                loadingView
            } else if viewModel.contacts.isEmpty {
                emptyStateView
            } else {
                contactsList
            }
        }
        .navigationTitle("Contacts")
        .searchable(text: $searchText, prompt: "Search contacts...")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                if !networkMonitor.isConnected {
                    OfflineIndicator()
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        viewModel.selectedType = nil
                    } label: {
                        HStack {
                            Text("All")
                            if viewModel.selectedType == nil {
                                Image(systemName: "checkmark")
                            }
                        }
                    }

                    Divider()

                    ForEach(ContactType.allCases, id: \.self) { type in
                        Button {
                            viewModel.selectedType = type
                        } label: {
                            HStack {
                                Label(type.displayName, systemImage: type.icon)
                                if viewModel.selectedType == type {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                } label: {
                    Image(systemName: "line.3.horizontal.decrease.circle")
                }
            }
        }
        .refreshable {
            await viewModel.loadContacts()
        }
        .task {
            await viewModel.loadContacts()
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
            Button("Retry") {
                Task { await viewModel.loadContacts() }
            }
        } message: {
            Text(viewModel.errorMessage)
        }
    }

    // MARK: - Contacts List

    private var contactsList: some View {
        List {
            // Type Filter Pills
            if viewModel.selectedType == nil {
                Section {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            FilterPill(
                                title: "Clients",
                                count: viewModel.clientCount,
                                color: .blue,
                                icon: "building.2"
                            ) {
                                viewModel.selectedType = .client
                            }

                            FilterPill(
                                title: "Subcontractors",
                                count: viewModel.subcontractorCount,
                                color: .orange,
                                icon: "hammer"
                            ) {
                                viewModel.selectedType = .subcontractor
                            }

                            FilterPill(
                                title: "Suppliers",
                                count: viewModel.supplierCount,
                                color: .purple,
                                icon: "shippingbox"
                            ) {
                                viewModel.selectedType = .supplier
                            }
                        }
                        .padding(.horizontal, 4)
                    }
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }

            // Contacts
            ForEach(filteredContacts) { contact in
                NavigationLink(value: contact) {
                    ContactRowView(contact: contact)
                }
            }
        }
        .listStyle(.plain)
        .navigationDestination(for: Contact.self) { contact in
            ContactDetailView(contact: contact, viewModel: viewModel)
        }
    }

    private var filteredContacts: [Contact] {
        let typeFiltered = viewModel.filteredContacts

        if searchText.isEmpty {
            return typeFiltered
        }

        return typeFiltered.filter { contact in
            contact.displayName.localizedCaseInsensitiveContains(searchText) ||
            contact.email?.localizedCaseInsensitiveContains(searchText) == true ||
            contact.company?.localizedCaseInsensitiveContains(searchText) == true ||
            contact.phone?.localizedCaseInsensitiveContains(searchText) == true
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Loading contacts...")
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        ContentUnavailableView {
            Label("No Contacts", systemImage: "person.crop.circle")
        } description: {
            Text("You don't have any contacts yet.")
        } actions: {
            Button("Refresh") {
                Task { await viewModel.loadContacts() }
            }
        }
    }
}

// MARK: - Contact Row

struct ContactRowView: View {
    let contact: Contact

    var body: some View {
        HStack(spacing: 12) {
            // Avatar
            ZStack {
                Circle()
                    .fill(contact.contactColor.gradient)
                    .frame(width: 50, height: 50)

                Text(contact.initials)
                    .font(.headline)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
            }

            VStack(alignment: .leading, spacing: 4) {
                // Name
                HStack {
                    Text(contact.displayName)
                        .font(.headline)
                        .lineLimit(1)

                    Spacer()

                    // Type Badge
                    Label(contact.contactType.displayName, systemImage: contact.contactType.icon)
                        .font(.caption2)
                        .fontWeight(.medium)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(contact.contactType.color.opacity(0.15))
                        .foregroundColor(contact.contactType.color)
                        .cornerRadius(6)
                }

                // Company/Position
                if let company = contact.company {
                    HStack(spacing: 4) {
                        Image(systemName: "building.2")
                            .font(.caption2)
                        Text(company)
                            .font(.subheadline)
                        if let position = contact.position {
                            Text("- \(position)")
                                .font(.caption)
                        }
                    }
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                }

                // Contact Info
                HStack(spacing: 16) {
                    if contact.email != nil {
                        Image(systemName: "envelope.fill")
                            .font(.caption)
                            .foregroundColor(.blue)
                    }

                    if contact.displayPhone != nil {
                        Image(systemName: "phone.fill")
                            .font(.caption)
                            .foregroundColor(.green)
                    }

                    if let jobsCount = contact.jobsCount, jobsCount > 0 {
                        Label("\(jobsCount) jobs", systemImage: "briefcase")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Filter Pill

struct FilterPill: View {
    let title: String
    let count: Int
    let color: Color
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)
                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
                Text("\(count)")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.white.opacity(0.3))
                    .cornerRadius(8)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(color.gradient)
            .foregroundColor(.white)
            .cornerRadius(20)
        }
    }
}

#Preview {
    NavigationStack {
        ContactsListView()
            .environmentObject(NetworkMonitor.shared)
    }
}
