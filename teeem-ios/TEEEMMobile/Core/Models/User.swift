import Foundation

struct User: Codable, Identifiable, Equatable {
    let id: Int
    let email: String
    let firstName: String?
    let lastName: String?
    let role: String?
    let permissions: [String]?
    let avatarUrl: String?
    let createdAt: Date?
    let updatedAt: Date?

    var displayName: String {
        if let first = firstName, let last = lastName {
            return "\(first) \(last)"
        } else if let first = firstName {
            return first
        } else if let last = lastName {
            return last
        } else {
            return email
        }
    }

    var initials: String {
        let first = firstName?.prefix(1) ?? ""
        let last = lastName?.prefix(1) ?? ""
        if first.isEmpty && last.isEmpty {
            return String(email.prefix(2)).uppercased()
        }
        return "\(first)\(last)".uppercased()
    }

    func hasPermission(_ permission: String) -> Bool {
        permissions?.contains(permission) ?? false
    }
}
