import Foundation
import CoreLocation

@MainActor
class LocationService: NSObject, ObservableObject {
    static let shared = LocationService()

    @Published var currentLocation: CLLocation?
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined
    @Published var isUpdating = false

    private let locationManager = CLLocationManager()

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        authorizationStatus = locationManager.authorizationStatus
    }

    func requestPermission() {
        locationManager.requestWhenInUseAuthorization()
    }

    func startUpdating() {
        guard authorizationStatus == .authorizedWhenInUse || authorizationStatus == .authorizedAlways else {
            requestPermission()
            return
        }

        isUpdating = true
        locationManager.startUpdatingLocation()
    }

    func stopUpdating() {
        isUpdating = false
        locationManager.stopUpdatingLocation()
    }

    func getCurrentLocation() async -> CLLocation? {
        // If we have a recent location (within 30 seconds), use it
        if let location = currentLocation,
           Date().timeIntervalSince(location.timestamp) < 30 {
            return location
        }

        // Otherwise, request a fresh location
        startUpdating()

        // Wait for location update (with timeout)
        let startTime = Date()
        while currentLocation == nil || Date().timeIntervalSince(currentLocation!.timestamp) > 5 {
            try? await Task.sleep(nanoseconds: 100_000_000) // 0.1 second

            // Timeout after 10 seconds
            if Date().timeIntervalSince(startTime) > 10 {
                break
            }
        }

        stopUpdating()
        return currentLocation
    }

    var formattedLocation: String? {
        guard let location = currentLocation else { return nil }
        return String(format: "%.6f, %.6f", location.coordinate.latitude, location.coordinate.longitude)
    }
}

// MARK: - CLLocationManagerDelegate

extension LocationService: CLLocationManagerDelegate {
    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }

        Task { @MainActor in
            self.currentLocation = location
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location error: \(error.localizedDescription)")
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            self.authorizationStatus = manager.authorizationStatus
        }
    }
}
