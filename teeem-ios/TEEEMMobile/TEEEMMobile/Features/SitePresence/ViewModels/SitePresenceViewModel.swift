import Foundation
import CoreLocation
import Combine

/// ViewModel for Site Presence check-in/checkout flow
/// Part of Site Presence & Cost Intelligence System
@MainActor
class SitePresenceViewModel: NSObject, ObservableObject {
    // MARK: - Published State

    @Published var activeSession: SitePresenceSession?
    @Published var recentSessions: [SitePresenceSession] = []
    @Published var selectedJob: Job?
    @Published var availableJobs: [Job] = []

    @Published var isLoading = false
    @Published var isCheckingIn = false
    @Published var isCheckingOut = false

    @Published var showError = false
    @Published var errorMessage = ""

    @Published var showSuccess = false
    @Published var successMessage = ""

    @Published var currentLocation: CLLocation?
    @Published var locationStatus: LocationStatus = .unknown

    @Published var capturedPhotoData: Data?
    @Published var capturedPhotoUrl: String?

    @Published var notes: String = ""

    // Timer for active session
    @Published var elapsedTime: TimeInterval = 0
    private var timer: Timer?

    // MARK: - Dependencies

    private let apiClient = APIClient.shared
    private let cache = CacheManager.shared
    private let locationManager = CLLocationManager()

    // MARK: - Location Status

    enum LocationStatus {
        case unknown
        case requesting
        case authorized
        case denied
        case error(String)
    }

    // MARK: - Init

    override init() {
        super.init()
        setupLocationManager()
        loadCachedData()
    }

    // MARK: - Setup

    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
    }

    private func loadCachedData() {
        // Load cached jobs
        if let cached = cache.load([Job].self, forKey: CacheManager.jobsKey) {
            availableJobs = cached
        }
    }

    // MARK: - Location

    func requestLocationPermission() {
        locationStatus = .requesting
        locationManager.requestWhenInUseAuthorization()
    }

    func startLocationUpdates() {
        locationManager.startUpdatingLocation()
    }

    func stopLocationUpdates() {
        locationManager.stopUpdatingLocation()
    }

    // MARK: - Data Loading

    func loadActiveSession() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let response: ActiveSessionResponse = try await apiClient.get("site_presence_sessions/active")
            if response.hasActiveSession, let session = response.session {
                activeSession = session
                startTimer()
            } else {
                activeSession = nil
                stopTimer()
            }
        } catch {
            print("Failed to load active session: \(error)")
            // Don't show error for this - might just mean no active session
        }
    }

    func loadAvailableJobs() async {
        do {
            let jobs: [Job] = try await apiClient.get("jobs?status=active")
            availableJobs = jobs
            cache.save(jobs, forKey: CacheManager.jobsKey)
        } catch {
            print("Failed to load jobs: \(error)")
            // Use cached data
        }
    }

    func loadRecentSessions() async {
        do {
            let sessions: [SitePresenceSession] = try await apiClient.get("site_presence_sessions/my_sessions?limit=10")
            recentSessions = sessions
        } catch {
            print("Failed to load recent sessions: \(error)")
        }
    }

    // MARK: - Check-in

    func checkIn() async {
        guard let job = selectedJob else {
            showError(message: "Please select a job first")
            return
        }

        guard let location = currentLocation else {
            showError(message: "Unable to get your location. Please enable location services.")
            return
        }

        isCheckingIn = true
        defer { isCheckingIn = false }

        do {
            let request = CheckinRequest(
                jobId: job.id,
                latitude: location.coordinate.latitude,
                longitude: location.coordinate.longitude,
                photoUrl: capturedPhotoUrl,
                notes: notes.isEmpty ? nil : notes
            )

            let response: CheckinResponse = try await apiClient.post("site_presence_sessions/checkin", body: request)

            if response.success, let session = response.session {
                activeSession = session
                notes = ""
                capturedPhotoData = nil
                capturedPhotoUrl = nil
                startTimer()

                var message = "Checked in to \(job.name)"
                if let verification = response.verification {
                    if verification.gpsVerified {
                        message += " - GPS verified"
                    }
                    if let distance = verification.distanceFromSite {
                        message += " (\(Int(distance))m from site)"
                    }
                }
                showSuccess(message: message)
            } else {
                showError(message: response.error ?? "Check-in failed")
            }
        } catch {
            showError(message: "Check-in failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Check-out

    func checkOut() async {
        guard let session = activeSession else {
            showError(message: "No active session to check out from")
            return
        }

        guard let location = currentLocation else {
            showError(message: "Unable to get your location")
            return
        }

        isCheckingOut = true
        defer { isCheckingOut = false }

        do {
            let request = CheckoutRequest(
                latitude: location.coordinate.latitude,
                longitude: location.coordinate.longitude,
                photoUrl: capturedPhotoUrl,
                notes: notes.isEmpty ? nil : notes
            )

            let response: CheckoutResponse = try await apiClient.post("site_presence_sessions/\(session.id)/checkout", body: request)

            if response.success {
                stopTimer()

                var message = "Checked out successfully"
                if let updatedSession = response.session {
                    message = "Worked \(updatedSession.formattedTotalHours)"
                }
                if let cost = response.labourCostEntry {
                    let formatter = NumberFormatter()
                    formatter.numberStyle = .currency
                    formatter.currencyCode = "AUD"
                    if let formatted = formatter.string(from: NSNumber(value: cost.totalCost)) {
                        message += " - Cost: \(formatted)"
                    }
                }

                activeSession = nil
                notes = ""
                capturedPhotoData = nil
                capturedPhotoUrl = nil

                showSuccess(message: message)

                // Refresh sessions list
                await loadRecentSessions()
            } else {
                showError(message: response.error ?? "Check-out failed")
            }
        } catch {
            showError(message: "Check-out failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Timer

    private func startTimer() {
        timer?.invalidate()
        updateElapsedTime()

        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.updateElapsedTime()
            }
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
        elapsedTime = 0
    }

    private func updateElapsedTime() {
        guard let session = activeSession, let checkin = session.checkinAt else {
            elapsedTime = 0
            return
        }
        elapsedTime = Date().timeIntervalSince(checkin)
    }

    var formattedElapsedTime: String {
        let hours = Int(elapsedTime) / 3600
        let minutes = (Int(elapsedTime) % 3600) / 60
        let seconds = Int(elapsedTime) % 60
        return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
    }

    // MARK: - Photo Upload

    func uploadPhoto(_ imageData: Data) async -> String? {
        // For now, we'll use base64 encoding and let the backend handle upload
        // In a production app, you'd upload to Cloudinary directly
        return imageData.base64EncodedString()
    }

    // MARK: - Helpers

    private func showError(message: String) {
        errorMessage = message
        showError = true
    }

    private func showSuccess(message: String) {
        successMessage = message
        showSuccess = true
    }
}

// MARK: - CLLocationManagerDelegate

extension SitePresenceViewModel: CLLocationManagerDelegate {
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            locationStatus = .authorized
            startLocationUpdates()
        case .denied, .restricted:
            locationStatus = .denied
        case .notDetermined:
            locationStatus = .unknown
        @unknown default:
            locationStatus = .unknown
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        currentLocation = locations.last
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location error: \(error)")
        locationStatus = .error(error.localizedDescription)
    }
}
