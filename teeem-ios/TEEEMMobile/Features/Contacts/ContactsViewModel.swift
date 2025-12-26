import Foundation
import Combine

@MainActor
class ContactsViewModel: ObservableObject {
    @Published var contacts: [Contact] = []
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage = ""
    @Published var selectedType: ContactType?

    private let apiClient = APIClient.shared

    // MARK: - Load Contacts

    func loadContacts() async {
        isLoading = true

        do {
            let response: [Contact] = try await apiClient.get(Endpoint.contacts.path)
            contacts = response
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }

        isLoading = false
    }

    // MARK: - Get Contact Detail

    func getContact(id: Int) async -> Contact? {
        do {
            return try await apiClient.get(Endpoint.contact(id: id).path)
        } catch {
            errorMessage = error.localizedDescription
            showError = true
            return nil
        }
    }

    // MARK: - Filtered Contacts

    var filteredContacts: [Contact] {
        guard let type = selectedType else {
            return contacts
        }
        return contacts.filter { $0.contactType == type }
    }

    // MARK: - Contact Stats

    var clientCount: Int {
        contacts.filter { $0.contactType == .client }.count
    }

    var subcontractorCount: Int {
        contacts.filter { $0.contactType == .subcontractor }.count
    }

    var supplierCount: Int {
        contacts.filter { $0.contactType == .supplier }.count
    }

    // MARK: - Actions

    func call(contact: Contact) {
        guard let phone = contact.displayPhone,
              let url = URL(string: "tel://\(phone.replacingOccurrences(of: " ", with: ""))") else {
            return
        }
        UIApplication.shared.open(url)
    }

    func email(contact: Contact) {
        guard let email = contact.email,
              let url = URL(string: "mailto:\(email)") else {
            return
        }
        UIApplication.shared.open(url)
    }

    func message(contact: Contact) {
        guard let phone = contact.displayPhone,
              let url = URL(string: "sms://\(phone.replacingOccurrences(of: " ", with: ""))") else {
            return
        }
        UIApplication.shared.open(url)
    }
}
