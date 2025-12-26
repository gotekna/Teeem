import Foundation
import SwiftUI

struct Job: Codable, Identifiable, Equatable {
    let id: Int
    let jobNumber: String?
    let name: String?
    let description: String?
    let status: String?
    let stage: String?
    let address: String?
    let suburb: String?
    let state: String?
    let postcode: String?
    let contractValue: Decimal?
    let startDate: Date?
    let endDate: Date?
    let clientName: String?
    let projectManagerId: Int?
    let supervisorId: Int?
    let createdAt: Date?
    let updatedAt: Date?

    var displayName: String {
        if let number = jobNumber, let name = name {
            return "\(number) - \(name)"
        } else if let name = name {
            return name
        } else if let number = jobNumber {
            return number
        } else {
            return "Job #\(id)"
        }
    }

    var fullAddress: String? {
        var parts: [String] = []
        if let address = address { parts.append(address) }
        if let suburb = suburb { parts.append(suburb) }
        if let state = state { parts.append(state) }
        if let postcode = postcode { parts.append(postcode) }
        return parts.isEmpty ? nil : parts.joined(separator: ", ")
    }

    var statusColor: Color {
        switch status?.lowercased() {
        case "active", "in_progress":
            return .green
        case "on_hold":
            return .orange
        case "completed":
            return .blue
        case "cancelled":
            return .red
        default:
            return .gray
        }
    }

    var formattedContractValue: String? {
        guard let value = contractValue else { return nil }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "AUD"
        return formatter.string(from: value as NSDecimalNumber)
    }
}
