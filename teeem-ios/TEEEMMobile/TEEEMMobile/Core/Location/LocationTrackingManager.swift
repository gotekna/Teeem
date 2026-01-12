import Foundation
import CoreLocation
import UIKit
import Combine

/// LocationTrackingManager - Background location tracking for field workers
///
/// Part of Live Location Tracking System
/// Features:
/// - Background location updates during active session
/// - Geofence monitoring via CLCircularRegion
/// - Offline ping queue with automatic sync
/// - Battery-aware tracking (reduces frequency when low)
///
/// Usage:
///   LocationTrackingManager.shared.startTracking(session: session, job: job)
///   LocationTrackingManager.shared.stopTracking()
///
@MainActor
class LocationTrackingManager: NSObject, ObservableObject {

    // MARK: - Singleton

    static let shared = LocationTrackingManager()

    // MARK: - Published State

    @Published var isTracking = false
    @Published var currentLocation: CLLocation?
    @Published var isWithinGeofence = true
    @Published var distanceFromSite: Int = 0
    @Published var lastPingTime: Date?
    @Published var pendingPingsCount: Int = 0

    // MARK: - Configuration

    /// Interval between location pings (seconds)
    var pingInterval: TimeInterval = 60

    /// Minimum distance change to trigger update (meters)
    var distanceFilter: CLLocationDistance = 10

    /// Battery level below which we reduce tracking frequency
    let lowBatteryThreshold: Float = 0.20

    // MARK: - Private Properties

    private let locationManager = CLLocationManager()
    private let apiClient = APIClient.shared

    private var activeSessionId: Int?
    private var jobId: Int?
    private var jobLocation: CLLocation?
    private var geofenceRadius: Double = 100

    private var pingTimer: Timer?
    private var pendingPings: [LocationPingRequest] = []
    private var isSyncing = false

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Init

    override init() {
        super.init()
        setupLocationManager()
        setupBatteryMonitoring()
        loadPendingPings()
    }

    // MARK: - Setup

    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = distanceFilter
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.showsBackgroundLocationIndicator = true
    }

    private func setupBatteryMonitoring() {
        UIDevice.current.isBatteryMonitoringEnabled = true

        NotificationCenter.default.publisher(for: UIDevice.batteryLevelDidChangeNotification)
            .sink { [weak self] _ in
                self?.adjustTrackingForBattery()
            }
            .store(in: &cancellables)
    }

    // MARK: - Public Methods

    /// Start tracking for an active session
    func startTracking(sessionId: Int, job: Job) {
        guard !isTracking else { return }

        activeSessionId = sessionId
        jobId = job.id

        // Set job location for geofence
        if let lat = job.siteLatitude, let lng = job.siteLongitude {
            jobLocation = CLLocation(latitude: lat, longitude: lng)
            geofenceRadius = Double(job.siteRadiusMeters ?? 100)

            // Setup geofence monitoring
            setupGeofence(for: job)
        }

        // Request always authorization for background tracking
        let status = locationManager.authorizationStatus
        if status == .authorizedWhenInUse {
            locationManager.requestAlwaysAuthorization()
        } else if status == .notDetermined {
            locationManager.requestAlwaysAuthorization()
        }

        // Start location updates
        locationManager.startUpdatingLocation()

        // Start ping timer
        startPingTimer()

        isTracking = true

        print("[LocationTracking] Started tracking for session \(sessionId), job \(job.id)")
    }

    /// Stop tracking
    func stopTracking() {
        guard isTracking else { return }

        // Stop location updates
        locationManager.stopUpdatingLocation()

        // Stop geofence monitoring
        for region in locationManager.monitoredRegions {
            locationManager.stopMonitoring(for: region)
        }

        // Stop timer
        stopPingTimer()

        // Sync any pending pings
        Task {
            await syncPendingPings()
        }

        activeSessionId = nil
        jobId = nil
        jobLocation = nil
        isTracking = false

        print("[LocationTracking] Stopped tracking")
    }

    /// Force send a location ping now
    func sendPingNow() async {
        guard let location = currentLocation else { return }
        await sendLocationPing(location: location, source: "manual")
    }

    // MARK: - Geofence

    private func setupGeofence(for job: Job) {
        guard let lat = job.siteLatitude, let lng = job.siteLongitude else { return }

        // Remove any existing regions
        for region in locationManager.monitoredRegions {
            locationManager.stopMonitoring(for: region)
        }

        // Create new geofence region
        let center = CLLocationCoordinate2D(latitude: lat, longitude: lng)
        let region = CLCircularRegion(
            center: center,
            radius: geofenceRadius,
            identifier: "job_\(job.id)"
        )
        region.notifyOnExit = true
        region.notifyOnEntry = true

        locationManager.startMonitoring(for: region)

        print("[LocationTracking] Geofence set: \(lat), \(lng) radius \(geofenceRadius)m")
    }

    // MARK: - Ping Timer

    private func startPingTimer() {
        stopPingTimer()

        pingTimer = Timer.scheduledTimer(withTimeInterval: pingInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.timerFired()
            }
        }
    }

    private func stopPingTimer() {
        pingTimer?.invalidate()
        pingTimer = nil
    }

    private func timerFired() {
        guard let location = currentLocation else { return }

        Task {
            await sendLocationPing(location: location, source: "background")
        }
    }

    // MARK: - Send Location Ping

    private func sendLocationPing(location: CLLocation, source: String) async {
        guard let sessionId = activeSessionId, let jobId = jobId else { return }

        // Calculate distance from site
        var distance: Int? = nil
        if let jobLoc = jobLocation {
            distance = Int(location.distance(from: jobLoc))
            distanceFromSite = distance ?? 0
            isWithinGeofence = (distance ?? 0) <= Int(geofenceRadius)
        }

        let ping = LocationPingRequest(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            accuracy: location.horizontalAccuracy,
            altitude: location.altitude,
            speed: location.speed >= 0 ? location.speed : nil,
            heading: location.course >= 0 ? location.course : nil,
            source: source,
            batteryLevel: Int(UIDevice.current.batteryLevel * 100),
            batteryState: batteryStateString(),
            recordedAt: ISO8601DateFormatter().string(from: location.timestamp)
        )

        // Try to send immediately
        do {
            let response: LocationPingResponse = try await apiClient.post("location_tracking/ping", body: ping)
            if response.success {
                lastPingTime = Date()
                print("[LocationTracking] Ping sent: \(location.coordinate.latitude), \(location.coordinate.longitude)")
            } else {
                // Queue for later
                queuePing(ping)
            }
        } catch {
            // Network error - queue for later
            print("[LocationTracking] Ping failed, queuing: \(error)")
            queuePing(ping)
        }
    }

    // MARK: - Offline Queue

    private func queuePing(_ ping: LocationPingRequest) {
        pendingPings.append(ping)
        pendingPingsCount = pendingPings.count
        savePendingPings()
    }

    private func syncPendingPings() async {
        guard !pendingPings.isEmpty, !isSyncing else { return }

        isSyncing = true
        defer { isSyncing = false }

        let pingsToSync = pendingPings

        do {
            let response: BatchPingResponse = try await apiClient.post("location_tracking/batch_ping", body: ["pings": pingsToSync])

            if response.success {
                pendingPings.removeAll()
                pendingPingsCount = 0
                savePendingPings()
                print("[LocationTracking] Synced \(pingsToSync.count) pending pings")
            }
        } catch {
            print("[LocationTracking] Batch sync failed: \(error)")
        }
    }

    private func savePendingPings() {
        if let data = try? JSONEncoder().encode(pendingPings) {
            UserDefaults.standard.set(data, forKey: "pendingLocationPings")
        }
    }

    private func loadPendingPings() {
        if let data = UserDefaults.standard.data(forKey: "pendingLocationPings"),
           let pings = try? JSONDecoder().decode([LocationPingRequest].self, from: data) {
            pendingPings = pings
            pendingPingsCount = pings.count
        }
    }

    // MARK: - Battery Management

    private func adjustTrackingForBattery() {
        let batteryLevel = UIDevice.current.batteryLevel

        if batteryLevel < lowBatteryThreshold && batteryLevel >= 0 {
            // Low battery - reduce accuracy and frequency
            locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
            pingInterval = 120 // 2 minutes
            print("[LocationTracking] Low battery mode: reduced accuracy")
        } else {
            // Normal mode
            locationManager.desiredAccuracy = kCLLocationAccuracyBest
            pingInterval = 60 // 1 minute
        }

        // Restart timer with new interval
        if isTracking {
            startPingTimer()
        }
    }

    private func batteryStateString() -> String {
        switch UIDevice.current.batteryState {
        case .charging: return "charging"
        case .full: return "full"
        case .unplugged: return "unplugged"
        case .unknown: return "unknown"
        @unknown default: return "unknown"
        }
    }
}

// MARK: - CLLocationManagerDelegate

extension LocationTrackingManager: CLLocationManagerDelegate {

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }

        Task { @MainActor in
            self.currentLocation = location

            // Update distance from site
            if let jobLoc = self.jobLocation {
                self.distanceFromSite = Int(location.distance(from: jobLoc))
                self.isWithinGeofence = self.distanceFromSite <= Int(self.geofenceRadius)
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        print("[LocationTracking] Exited geofence: \(region.identifier)")

        Task { @MainActor in
            self.isWithinGeofence = false

            // Send immediate ping on geofence exit
            if let location = self.currentLocation {
                await self.sendLocationPing(location: location, source: "geofence_exit")
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        print("[LocationTracking] Entered geofence: \(region.identifier)")

        Task { @MainActor in
            self.isWithinGeofence = true

            // Send immediate ping on geofence enter
            if let location = self.currentLocation {
                await self.sendLocationPing(location: location, source: "geofence_enter")
            }
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            switch manager.authorizationStatus {
            case .authorizedAlways:
                print("[LocationTracking] Always authorization granted")
            case .authorizedWhenInUse:
                print("[LocationTracking] When in use authorization - requesting always")
                manager.requestAlwaysAuthorization()
            case .denied, .restricted:
                print("[LocationTracking] Location access denied")
            case .notDetermined:
                break
            @unknown default:
                break
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("[LocationTracking] Location error: \(error)")
    }
}

// MARK: - Request/Response Models

struct LocationPingRequest: Codable {
    let latitude: Double
    let longitude: Double
    let accuracy: Double?
    let altitude: Double?
    let speed: Double?
    let heading: Double?
    let source: String
    let batteryLevel: Int?
    let batteryState: String?
    let recordedAt: String

    enum CodingKeys: String, CodingKey {
        case latitude, longitude, accuracy, altitude, speed, heading, source
        case batteryLevel = "battery_level"
        case batteryState = "battery_state"
        case recordedAt = "recorded_at"
    }
}

struct LocationPingResponse: Codable {
    let success: Bool
    let data: LocationPingData?

    struct LocationPingData: Codable {
        let id: Int?
        let withinGeofence: Bool?
        let distanceFromSite: Int?

        enum CodingKeys: String, CodingKey {
            case id
            case withinGeofence = "within_geofence"
            case distanceFromSite = "distance_from_site"
        }
    }
}

struct BatchPingResponse: Codable {
    let success: Bool
    let data: BatchPingData?

    struct BatchPingData: Codable {
        let created: Int
        let total: Int
    }
}
