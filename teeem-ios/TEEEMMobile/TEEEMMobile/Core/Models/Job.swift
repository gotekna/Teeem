import Foundation
import SwiftUI

struct Job: Codable, Identifiable, Hashable {
    let id: Int
    let jobNumber: String?
    let name: String?
    let clientName: String?
    let status: String?
    let stage: String?
    let address: String?
    let suburb: String?
    let state: String?
    let postcode: String?
    let contractValue: Double?

    var displayName: String {
        if let number = jobNumber, let jobName = name {
            return "\(number) - \(jobName)"
        }
        return name ?? jobNumber ?? "Job #\(id)"
    }

    var fullAddress: String? {
        [address, suburb, state, postcode].compactMap { $0 }.joined(separator: ", ")
    }

    var formattedContractValue: String? {
        guard let value = contractValue else { return nil }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "AUD"
        return formatter.string(from: NSNumber(value: value))
    }

    var statusColor: Color {
        switch status?.lowercased() {
        case "active": return .green
        case "completed": return .blue
        case "on_hold": return .orange
        default: return .gray
        }
    }
}
