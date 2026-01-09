import Foundation

/// Site Presence Session - Photo-verified time tracking
/// Part of Site Presence & Cost Intelligence System
struct SitePresenceSession: Identifiable, Codable {
    let id: Int
    let workerProfileId: Int
    let jobId: Int
    let status: String
    let checkinAt: Date?
    let checkoutAt: Date?
    let totalHours: Double?
    let billableHours: Double?
    let breakMinutes: Int?
    let latitudeCheckin: Double?
    let longitudeCheckin: Double?
    let distanceFromSiteCheckin: Double?
    let gpsVerifiedCheckin: Bool
    let faceVerifiedCheckin: Bool
    let faceConfidenceCheckin: Double?
    let approvalStatus: String
    let workerNotes: String?
    let supervisorNotes: String?
    let hasAnomalies: Bool?

    // Associated job info (optional, for display)
    let job: SessionJob?
    let workerProfile: SessionWorkerProfile?

    enum CodingKeys: String, CodingKey {
        case id
        case workerProfileId = "worker_profile_id"
        case jobId = "job_id"
        case status
        case checkinAt = "checkin_at"
        case checkoutAt = "checkout_at"
        case totalHours = "total_hours"
        case billableHours = "billable_hours"
        case breakMinutes = "break_minutes"
        case latitudeCheckin = "latitude_checkin"
        case longitudeCheckin = "longitude_checkin"
        case distanceFromSiteCheckin = "distance_from_site_checkin"
        case gpsVerifiedCheckin = "gps_verified_checkin"
        case faceVerifiedCheckin = "face_verified_checkin"
        case faceConfidenceCheckin = "face_confidence_checkin"
        case approvalStatus = "approval_status"
        case workerNotes = "worker_notes"
        case supervisorNotes = "supervisor_notes"
        case hasAnomalies = "has_anomalies"
        case job
        case workerProfile = "worker_profile"
    }

    var isActive: Bool {
        status == "active"
    }

    var formattedTotalHours: String {
        guard let hours = totalHours else { return "-" }
        let h = Int(hours)
        let m = Int((hours - Double(h)) * 60)
        return m > 0 ? "\(h)h \(m)m" : "\(h)h"
    }

    var elapsedTime: TimeInterval? {
        guard let checkin = checkinAt else { return nil }
        if let checkout = checkoutAt {
            return checkout.timeIntervalSince(checkin)
        }
        return Date().timeIntervalSince(checkin)
    }

    var formattedElapsedTime: String {
        guard let elapsed = elapsedTime else { return "-" }
        let hours = Int(elapsed) / 3600
        let minutes = (Int(elapsed) % 3600) / 60
        return String(format: "%d:%02d", hours, minutes)
    }
}

struct SessionJob: Codable {
    let id: Int
    let name: String?
    let title: String?

    var displayName: String {
        name ?? title ?? "Job #\(id)"
    }
}

struct SessionWorkerProfile: Codable {
    let id: Int
    let displayName: String?
    let workerType: String?
    let profilePhotoUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case displayName = "display_name"
        case workerType = "worker_type"
        case profilePhotoUrl = "profile_photo_url"
    }
}

// Request structs for check-in/checkout
struct CheckinRequest: Encodable {
    let jobId: Int
    let latitude: Double
    let longitude: Double
    let photoUrl: String?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case jobId = "job_id"
        case latitude
        case longitude
        case photoUrl = "photo_url"
        case notes
    }
}

struct CheckoutRequest: Encodable {
    let latitude: Double
    let longitude: Double
    let photoUrl: String?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case latitude
        case longitude
        case photoUrl = "photo_url"
        case notes
    }
}

// Response wrappers
struct CheckinResponse: Decodable {
    let success: Bool
    let session: SitePresenceSession?
    let error: String?
    let verification: VerificationInfo?
}

struct CheckoutResponse: Decodable {
    let success: Bool
    let session: SitePresenceSession?
    let error: String?
    let labourCostEntry: LabourCostEntryPreview?

    enum CodingKeys: String, CodingKey {
        case success
        case session
        case error
        case labourCostEntry = "labour_cost_entry"
    }
}

struct VerificationInfo: Decodable {
    let gpsVerified: Bool
    let distanceFromSite: Double?
    let withinRadius: Bool
    let photoUploaded: Bool
    let faceVerificationPending: Bool

    enum CodingKeys: String, CodingKey {
        case gpsVerified = "gps_verified"
        case distanceFromSite = "distance_from_site"
        case withinRadius = "within_radius"
        case photoUploaded = "photo_uploaded"
        case faceVerificationPending = "face_verification_pending"
    }
}

struct LabourCostEntryPreview: Decodable {
    let id: Int
    let totalHours: Double
    let totalCost: Double
    let regularHours: Double
    let overtime15xHours: Double
    let overtime2xHours: Double

    enum CodingKeys: String, CodingKey {
        case id
        case totalHours = "total_hours"
        case totalCost = "total_cost"
        case regularHours = "regular_hours"
        case overtime15xHours = "overtime_1_5x_hours"
        case overtime2xHours = "overtime_2x_hours"
    }
}

struct ActiveSessionResponse: Decodable {
    let success: Bool
    let session: SitePresenceSession?
    let hasActiveSession: Bool

    enum CodingKeys: String, CodingKey {
        case success
        case session
        case hasActiveSession = "has_active_session"
    }
}
