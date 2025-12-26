import Foundation
import SwiftUI

struct Contact: Codable, Identifiable, Hashable {
    let id: Int
    let name: String?
    let email: String?
    let phone: String?
    let mobile: String?
    let company: String?
    let type: String?

    var displayName: String { name ?? company ?? "Contact #\(id)" }
    var displayPhone: String? { mobile ?? phone }

    var initials: String {
        let parts = displayName.split(separator: " ")
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return String(displayName.prefix(2)).uppercased()
    }

    var contactColor: Color {
        let colors: [Color] = [.blue, .green, .orange, .purple, .red]
        return colors[abs(displayName.hashValue) % colors.count]
    }

    var contactType: ContactType {
        ContactType(rawValue: type ?? "") ?? .other
    }
}

enum ContactType: String, CaseIterable {
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
