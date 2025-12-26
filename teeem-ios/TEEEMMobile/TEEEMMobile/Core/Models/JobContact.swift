import Foundation
import SwiftUI

struct JobContact: Identifiable, Codable, Hashable {
    let id: Int
    let contactId: Int
    let userId: Int?
    let primary: Bool
    let role: String?
    let contact: JobContactDetail

    var displayName: String { contact.displayName ?? "Unknown" }
    var email: String? { contact.email }
    var mobilePhone: String? { contact.mobilePhone }
    var officePhone: String? { contact.officePhone }
    var companyName: String? { contact.companyNameOrTrust }

    var roleDisplayName: String {
        guard let role = role else { return "Contact" }
        return role.capitalized
    }

    var roleColor: Color {
        switch role?.lowercased() {
        case "client": return .blue
        case "builder": return .orange
        case "architect": return .purple
        case "engineer": return .green
        case "subcontractor": return .indigo
        case "supplier": return .pink
        default: return .gray
        }
    }

    var initials: String {
        let parts = displayName.split(separator: " ")
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return String(displayName.prefix(2)).uppercased()
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case contactId = "contact_id"
        case userId = "user_id"
        case primary
        case role
        case contact
    }
}

struct JobContactDetail: Codable, Hashable {
    let id: Int
    let displayName: String?
    let firstName: String?
    let lastName: String?
    let email: String?
    let mobilePhone: String?
    let officePhone: String?
    let companyNameOrTrust: String?
    let entityType: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case displayName = "display_name"
        case firstName = "first_name"
        case lastName = "last_name"
        case email
        case mobilePhone = "mobile_phone"
        case officePhone = "office_phone"
        case companyNameOrTrust = "company_name_or_trust"
        case entityType = "entity_type"
    }
}
