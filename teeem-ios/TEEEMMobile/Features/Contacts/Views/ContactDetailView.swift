import SwiftUI

struct ContactDetailView: View {
    let contact: Contact
    @ObservedObject var viewModel: ContactsViewModel

    var body: some View {
        List {
            // Header Section
            Section {
                VStack(spacing: 16) {
                    // Avatar
                    ZStack {
                        Circle()
                            .fill(contact.contactColor.gradient)
                            .frame(width: 100, height: 100)

                        Text(contact.initials)
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                    }

                    // Name
                    VStack(spacing: 4) {
                        Text(contact.displayName)
                            .font(.title2)
                            .fontWeight(.bold)

                        if let company = contact.company {
                            Text(company)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }

                        if let position = contact.position {
                            Text(position)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    // Type Badge
                    Label(contact.contactType.displayName, systemImage: contact.contactType.icon)
                        .font(.caption)
                        .fontWeight(.medium)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(contact.contactType.color.opacity(0.15))
                        .foregroundColor(contact.contactType.color)
                        .cornerRadius(12)

                    // Quick Actions
                    HStack(spacing: 24) {
                        if contact.displayPhone != nil {
                            QuickActionButton(
                                icon: "phone.fill",
                                title: "Call",
                                color: .green
                            ) {
                                viewModel.call(contact: contact)
                            }

                            QuickActionButton(
                                icon: "message.fill",
                                title: "Message",
                                color: .blue
                            ) {
                                viewModel.message(contact: contact)
                            }
                        }

                        if contact.email != nil {
                            QuickActionButton(
                                icon: "envelope.fill",
                                title: "Email",
                                color: .orange
                            ) {
                                viewModel.email(contact: contact)
                            }
                        }
                    }
                    .padding(.top, 8)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
            }
            .listRowBackground(Color.clear)

            // Contact Info Section
            Section {
                if let email = contact.email {
                    Button {
                        viewModel.email(contact: contact)
                    } label: {
                        HStack {
                            Label("Email", systemImage: "envelope")
                            Spacer()
                            Text(email)
                                .foregroundColor(.accentColor)
                        }
                    }
                    .foregroundColor(.primary)
                }

                if let phone = contact.phone {
                    Button {
                        if let url = URL(string: "tel://\(phone.replacingOccurrences(of: " ", with: ""))") {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        HStack {
                            Label("Phone", systemImage: "phone")
                            Spacer()
                            Text(phone)
                                .foregroundColor(.accentColor)
                        }
                    }
                    .foregroundColor(.primary)
                }

                if let mobile = contact.mobile {
                    Button {
                        if let url = URL(string: "tel://\(mobile.replacingOccurrences(of: " ", with: ""))") {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        HStack {
                            Label("Mobile", systemImage: "iphone")
                            Spacer()
                            Text(mobile)
                                .foregroundColor(.accentColor)
                        }
                    }
                    .foregroundColor(.primary)
                }
            } header: {
                Text("Contact Information")
            }

            // Address Section
            if let address = contact.fullAddress {
                Section {
                    Button {
                        openMaps(address: address)
                    } label: {
                        HStack(alignment: .top) {
                            Label("Address", systemImage: "mappin.and.ellipse")
                            Spacer()
                            Text(address)
                                .multilineTextAlignment(.trailing)
                                .foregroundColor(.accentColor)
                        }
                    }
                    .foregroundColor(.primary)
                } header: {
                    Text("Location")
                }
            }

            // Stats Section
            if let jobsCount = contact.jobsCount, jobsCount > 0 {
                Section {
                    HStack {
                        Label("Jobs", systemImage: "briefcase")
                        Spacer()
                        Text("\(jobsCount)")
                            .fontWeight(.medium)
                            .foregroundColor(.secondary)
                    }

                    if let poCount = contact.purchaseOrdersCount, poCount > 0 {
                        HStack {
                            Label("Purchase Orders", systemImage: "doc.text")
                            Spacer()
                            Text("\(poCount)")
                                .fontWeight(.medium)
                                .foregroundColor(.secondary)
                        }
                    }
                } header: {
                    Text("Activity")
                }
            }

            // Notes Section
            if let notes = contact.notes, !notes.isEmpty {
                Section {
                    Text(notes)
                        .font(.body)
                        .foregroundColor(.secondary)
                } header: {
                    Text("Notes")
                }
            }
        }
        .navigationTitle("Contact")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func openMaps(address: String) {
        let encodedAddress = address.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        if let url = URL(string: "http://maps.apple.com/?q=\(encodedAddress)") {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - Quick Action Button

struct QuickActionButton: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                ZStack {
                    Circle()
                        .fill(color.opacity(0.15))
                        .frame(width: 50, height: 50)

                    Image(systemName: icon)
                        .font(.title3)
                        .foregroundColor(color)
                }

                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}

#Preview {
    NavigationStack {
        ContactDetailView(
            contact: Contact(
                id: 1,
                name: "John Smith",
                email: "john@example.com",
                phone: "07 1234 5678",
                mobile: "0412 345 678",
                company: "Acme Construction",
                position: "Project Manager",
                type: "client",
                status: "active",
                address: "123 Main Street",
                suburb: "Brisbane",
                state: "QLD",
                postcode: "4000",
                notes: "Key client for major projects",
                avatarUrl: nil,
                createdAt: nil,
                updatedAt: nil,
                organizationId: 1,
                jobsCount: 5,
                purchaseOrdersCount: 12
            ),
            viewModel: ContactsViewModel()
        )
    }
}
