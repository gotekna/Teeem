import Foundation

struct User: Codable, Identifiable {
    let id: Int
    let email: String
    let firstName: String?
    let lastName: String?
    let role: String?
    let avatarUrl: String?
    let name: String?  // Some APIs return full name directly

    var displayName: String {
        if let n = name, !n.isEmpty { return n }
        if let first = firstName, let last = lastName {
            return "\(first) \(last)"
        }
        return firstName ?? email
    }

    var initials: String {
        let components = displayName.split(separator: " ")
        if components.count >= 2 {
            return String(components[0].prefix(1) + components[1].prefix(1)).uppercased()
        }
        return String(displayName.prefix(2)).uppercased()
    }
}
