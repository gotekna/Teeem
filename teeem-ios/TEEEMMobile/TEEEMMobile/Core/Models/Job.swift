import Foundation
import SwiftUI

// Simple Job model - only decode basic fields, ignore nested objects for now
struct Job: Identifiable, Hashable {
    let id: Int
    let name: String?
    let suburb: String?
    let state: String?
    let contractPrice: Double?

    var displayName: String {
        if let jobName = name, !jobName.isEmpty {
            return "\(id) - \(jobName)"
        }
        return "Job #\(id)"
    }

    var location: String? {
        [suburb, state].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
    }

    var formattedContractValue: String? {
        guard let value = contractPrice else { return nil }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "AUD"
        return formatter.string(from: NSNumber(value: value))
    }

    var statusName: String { "Active" }
    var statusColor: Color { .green }
}

extension Job: Decodable {
    private enum CodingKeys: String, CodingKey {
        case id, name, suburb, state
        case contractPrice = "contract_price"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        suburb = try container.decodeIfPresent(String.self, forKey: .suburb)
        state = try container.decodeIfPresent(String.self, forKey: .state)
        contractPrice = try container.decodeIfPresent(Double.self, forKey: .contractPrice)
    }
}
