import Foundation
import SwiftUI

struct Contact: Identifiable, Hashable {
    let id: Int
    let displayNameFromApi: String?
    let firstName: String?
    let lastName: String?
    let email: String?
    let officePhone: String?
    let mobilePhone: String?
    let companyName: String?
    let contactType: String?
    let address: String?
    let isActive: Bool?

    var displayName: String {
        // Try display_name first, then build from first/last, then company
        if let dn = displayNameFromApi, !dn.isEmpty { return dn }
        let fullName = [firstName, lastName].compactMap { $0 }.joined(separator: " ")
        if !fullName.isEmpty { return fullName }
        if let company = companyName, !company.isEmpty { return company }
        return "Contact #\(id)"
    }

    var displayPhone: String? { mobilePhone ?? officePhone }

    var initials: String {
        let name = displayName
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }

    var contactColor: Color {
        let colors: [Color] = [.blue, .green, .orange, .purple, .red]
        return colors[abs(displayName.hashValue) % colors.count]
    }

    var type: ContactTypeEnum {
        ContactTypeEnum(rawValue: contactType ?? "") ?? .other
    }

    // Hashable
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: Contact, rhs: Contact) -> Bool {
        lhs.id == rhs.id
    }
}

extension Contact: Codable {
    private enum CodingKeys: String, CodingKey {
        case id
        case displayNameFromApi = "display_name"
        case firstName = "first_name"
        case lastName = "last_name"
        case email
        case officePhone = "office_phone"
        case mobilePhone = "mobile_phone"
        case companyName = "company_name_or_trust"
        case contactType = "contact_type"
        case address
        case isActive = "is_active"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        displayNameFromApi = try container.decodeIfPresent(String.self, forKey: .displayNameFromApi)
        firstName = try container.decodeIfPresent(String.self, forKey: .firstName)
        lastName = try container.decodeIfPresent(String.self, forKey: .lastName)
        email = try container.decodeIfPresent(String.self, forKey: .email)
        officePhone = try container.decodeIfPresent(String.self, forKey: .officePhone)
        mobilePhone = try container.decodeIfPresent(String.self, forKey: .mobilePhone)
        companyName = try container.decodeIfPresent(String.self, forKey: .companyName)
        contactType = try container.decodeIfPresent(String.self, forKey: .contactType)
        address = try container.decodeIfPresent(String.self, forKey: .address)
        isActive = try container.decodeIfPresent(Bool.self, forKey: .isActive)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(displayNameFromApi, forKey: .displayNameFromApi)
        try container.encodeIfPresent(firstName, forKey: .firstName)
        try container.encodeIfPresent(lastName, forKey: .lastName)
        try container.encodeIfPresent(email, forKey: .email)
        try container.encodeIfPresent(officePhone, forKey: .officePhone)
        try container.encodeIfPresent(mobilePhone, forKey: .mobilePhone)
        try container.encodeIfPresent(companyName, forKey: .companyName)
        try container.encodeIfPresent(contactType, forKey: .contactType)
        try container.encodeIfPresent(address, forKey: .address)
        try container.encodeIfPresent(isActive, forKey: .isActive)
    }
}

enum ContactTypeEnum: String, CaseIterable {
    case client, subcontractor, supplier, staff, other

    var displayName: String { rawValue.capitalized }

    var icon: String {
        switch self {
        case .client: return "building.2"
        case .subcontractor: return "hammer"
        case .supplier: return "shippingbox"
        case .staff: return "person"
        case .other: return "person.crop.circle"
        }
    }

    var color: Color {
        switch self {
        case .client: return .blue
        case .subcontractor: return .orange
        case .supplier: return .purple
        case .staff: return .green
        case .other: return .gray
        }
    }
}
