import Foundation
import SwiftUI

struct PurchaseOrder: Identifiable, Codable, Hashable {
    let id: Int
    let purchaseOrderNumber: String
    let jobId: Int?
    let supplierId: Int?
    let status: String
    let description: String?
    let subTotal: String?
    let tax: String?
    let total: String?
    let requiredDate: String?
    let orderedDate: String?
    let expectedDeliveryDate: String?
    let receivedDate: String?
    let supplier: POSupplier?

    var displayNumber: String { purchaseOrderNumber }

    var supplierName: String {
        supplier?.displayName ?? "Unknown Supplier"
    }

    var formattedTotal: String? {
        guard let totalStr = total, let amount = Double(totalStr) else { return nil }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "AUD"
        return formatter.string(from: NSNumber(value: amount))
    }

    var statusColor: Color {
        switch status.lowercased() {
        case "draft": return .gray
        case "pending", "sent": return .orange
        case "approved", "ordered": return .blue
        case "received", "complete", "completed": return .green
        case "cancelled": return .red
        default: return .gray
        }
    }

    var statusDisplayName: String {
        status.capitalized
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case purchaseOrderNumber = "purchase_order_number"
        case jobId = "job_id"
        case supplierId = "supplier_id"
        case status
        case description
        case subTotal = "sub_total"
        case tax
        case total
        case requiredDate = "required_date"
        case orderedDate = "ordered_date"
        case expectedDeliveryDate = "expected_delivery_date"
        case receivedDate = "received_date"
        case supplier
    }
}

struct POSupplier: Codable, Hashable {
    let id: Int
    let displayName: String?
    let email: String?
    let mobilePhone: String?
    let officePhone: String?

    private enum CodingKeys: String, CodingKey {
        case id
        case displayName = "display_name"
        case email
        case mobilePhone = "mobile_phone"
        case officePhone = "office_phone"
    }
}
