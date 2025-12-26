import Foundation
import SwiftUI

// Nested status object from API
struct JobStatus: Decodable {
    let id: Int?
    let name: String?
    let color: String?

    // Allow decoding to fail gracefully
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(Int.self, forKey: .id)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        color = try container.decodeIfPresent(String.self, forKey: .color)
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, color
    }
}

struct Job: Identifiable, Hashable {
    let id: Int
    let name: String?
    let suburb: String?
    let state: String?
    let contractPrice: Double?
    let streetNumber: String?
    let streetName: String?
    let lotNumber: String?
    let jobStatus: JobStatus?

    var displayName: String {
        // Build address-style display name
        var parts: [String] = []

        if let lot = lotNumber, !lot.isEmpty {
            parts.append("Lot \(lot)")
        }
        if let num = streetNumber, !num.isEmpty {
            parts.append(num)
        }
        if let street = streetName, !street.isEmpty {
            parts.append(street)
        }
        if let sub = suburb, !sub.isEmpty {
            parts.append(sub)
        }

        if parts.isEmpty {
            if let jobName = name, !jobName.isEmpty {
                return "\(id) - \(jobName)"
            }
            return "Job #\(id)"
        }

        return parts.joined(separator: " ")
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

    var statusName: String {
        jobStatus?.name ?? "Active"
    }

    var statusColor: Color {
        guard let colorHex = jobStatus?.color else { return .green }
        return Color(hex: colorHex) ?? .green
    }

    // Hashable conformance - only use id
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: Job, rhs: Job) -> Bool {
        lhs.id == rhs.id
    }
}

extension Job: Decodable {
    private enum CodingKeys: String, CodingKey {
        case id, name, suburb, state
        case contractPrice = "contract_price"
        case streetNumber = "street_number"
        case streetName = "street_name"
        case lotNumber = "lot_number"
        case jobStatus = "job_status"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int.self, forKey: .id)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        suburb = try container.decodeIfPresent(String.self, forKey: .suburb)
        state = try container.decodeIfPresent(String.self, forKey: .state)
        streetNumber = try container.decodeIfPresent(String.self, forKey: .streetNumber)
        streetName = try container.decodeIfPresent(String.self, forKey: .streetName)
        lotNumber = try container.decodeIfPresent(String.self, forKey: .lotNumber)
        jobStatus = try container.decodeIfPresent(JobStatus.self, forKey: .jobStatus)

        // contract_price comes as string from Rails API - convert to Double
        if let priceString = try container.decodeIfPresent(String.self, forKey: .contractPrice) {
            contractPrice = Double(priceString)
        } else if let priceDouble = try? container.decodeIfPresent(Double.self, forKey: .contractPrice) {
            contractPrice = priceDouble
        } else {
            contractPrice = nil
        }
    }
}

// Color extension for hex parsing
extension Color {
    init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }

        let r = Double((rgb & 0xFF0000) >> 16) / 255.0
        let g = Double((rgb & 0x00FF00) >> 8) / 255.0
        let b = Double(rgb & 0x0000FF) / 255.0

        self.init(red: r, green: g, blue: b)
    }
}
