import Foundation
import UIKit
import Combine

@MainActor
class ContactsViewModel: ObservableObject {
    @Published var contacts: [Contact] = []
    @Published var isLoading = false

    private let apiClient = APIClient.shared
    private let cache = CacheManager.shared

    init() {
        if let cached = cache.load([Contact].self, forKey: CacheManager.contactsKey) {
            contacts = cached
        }
    }

    func loadContacts() async {
        isLoading = true
        do {
            let loadedContacts: [Contact] = try await apiClient.get("contacts")
            contacts = loadedContacts
            cache.save(loadedContacts, forKey: CacheManager.contactsKey)
        } catch {
            print("Contacts load error: \(error)")
        }
        isLoading = false
    }

    func call(contact: Contact) {
        guard let phone = contact.displayPhone,
              let url = URL(string: "tel://\(phone.replacingOccurrences(of: " ", with: ""))") else { return }
        UIApplication.shared.open(url)
    }

    func email(contact: Contact) {
        guard let email = contact.email,
              let url = URL(string: "mailto:\(email)") else { return }
        UIApplication.shared.open(url)
    }
}
