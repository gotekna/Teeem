import Foundation
import SwiftUI

/// Represents a contact (client, subcontractor, supplier, etc.)
struct Contact: Codable, Identifiable, Hashable {
    let id: Int
    let name: String?
    let email: String?
    let phone: String?
    let mobile: String?
    let company: String?
    let position: String?
    let type: String?
    let status: String?
    let address: String?
    let suburb: String?
    let state: String?
    let postcode: String?
    let notes: String?
    let avatarUrl: String?
    let createdAt: Date?
    let updatedAt: Date?

    // Association fields
    let organizationId: Int?
    let jobsCount: Int?
    let purchaseOrdersCount: Int?

    enum CodingKeys: String, CodingKey {
        case id, name, email, phone, mobile, company, position, type, status
        case address, suburb, state, postcode, notes
        case avatarUrl = "avatar_url"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case organizationId = "organization_id"
        case jobsCount = "jobs_count"
        case purchaseOrdersCount = "purchase_orders_count"
    }
}

// MARK: - Display Helpers

extension Contact {
    var displayName: String {
        name ?? company ?? "Unknown Contact"
    }

    var initials: String {
        let components = displayName.split(separator: " ")
        if components.count >= 2 {
            return String(components[0].prefix(1) + components[1].prefix(1)).uppercased()
        }
        return String(displayName.prefix(2)).uppercased()
    }

    var contactColor: Color {
        let colors: [Color] = [.blue, .green, .orange, .purple, .red, .pink, .indigo]
        let hash = abs(displayName.hashValue)
        return colors[hash % colors.count]
    }

    var fullAddress: String? {
        let parts = [address, suburb, state, postcode].compactMap { $0 }
        return parts.isEmpty ? nil : parts.joined(separator: ", ")
    }

    var displayPhone: String? {
        mobile ?? phone
    }

    var contactType: ContactType {
        ContactType(rawValue: type ?? "") ?? .other
    }

    var statusColor: Color {
        switch status?.lowercased() {
        case "active":
            return .green
        case "inactive":
            return .gray
        case "pending":
            return .orange
        default:
            return .secondary
        }
    }
}

// MARK: - Contact Type

enum ContactType: String, CaseIterable {
    case client = "client"
    case subcontractor = "subcontractor"
    case supplier = "supplier"
    case staff = "staff"
    case other = "other"

    var displayName: String {
        switch self {
        case .client: return "Client"
        case .subcontractor: return "Subcontractor"
        case .supplier: return "Supplier"
        case .staff: return "Staff"
        case .other: return "Other"
        }
    }

    var icon: String {
        switch self {
        case .client: return "building.2"
        case .subcontractor: return "hammer"
        case .supplier: return "shippingbox"
        case .staff: return "person.badge.shield.checkmark"
        case .other: return "person"
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
