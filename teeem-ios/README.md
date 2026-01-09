# TEEEM Mobile - iOS App

Native iOS app for TEEEM field supervisors built with Swift and SwiftUI.

## Setup Instructions

### Prerequisites

1. **Mac with macOS 14+ (Sonoma)**
2. **Xcode 15+** - Download from [Mac App Store](https://apps.apple.com/app/xcode/id497799835)
3. **Apple Developer Account** - Create at [developer.apple.com](https://developer.apple.com) ($99/year)

### Create Xcode Project

Since Claude cannot create `.xcodeproj` files directly, follow these steps:

1. **Open Xcode**
2. **File → New → Project**
3. **Choose "App" under iOS**
4. **Configure:**
   - Product Name: `TEEEMMobile`
   - Team: Your Apple Developer Team
   - Organization Identifier: `com.teeem`
   - Bundle Identifier: `com.teeem.mobile`
   - Interface: SwiftUI
   - Language: Swift
   - Storage: None (we use custom CoreData)
5. **Choose location:** This `teeem-ios` folder
6. **Delete the auto-generated files** (ContentView.swift, Assets.xcassets, Preview Content)
7. **Drag the `TEEEMMobile` folder** into the Xcode project navigator

### Project Structure

```
TEEEMMobile/
├── App/
│   ├── TEEEMMobileApp.swift    # App entry point
│   └── AppState.swift          # Global app state
├── Core/
│   ├── Network/
│   │   ├── APIClient.swift     # HTTP client with async/await
│   │   ├── Endpoints.swift     # API endpoint definitions
│   │   └── AuthManager.swift   # JWT token + biometric auth
│   ├── Storage/
│   │   └── KeychainManager.swift   # Secure token storage
│   └── Models/
│       ├── User.swift
│       ├── Job.swift
│       ├── SMTask.swift
│       └── Photo.swift
├── Features/
│   ├── Auth/
│   │   ├── Views/LoginView.swift
│   │   └── ViewModels/LoginViewModel.swift
│   ├── Jobs/
│   │   ├── Views/JobsListView.swift, JobDetailView.swift
│   │   └── ViewModels/JobsViewModel.swift
│   ├── Tasks/
│   │   ├── Views/TasksListView.swift, TaskDetailView.swift
│   │   ├── ViewModels/TasksViewModel.swift
│   │   └── Components/TaskStatusBadge.swift
│   └── Settings/
│       └── SettingsView.swift
└── Shared/
    ├── Components/
    └── Extensions/
```

### Xcode Configuration

After adding files to Xcode:

1. **Info.plist - Add required keys:**
   ```xml
   <key>NSCameraUsageDescription</key>
   <string>TEEEM needs camera access to capture job photos</string>
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>TEEEM uses your location to tag photos and track job sites</string>
   <key>NSFaceIDUsageDescription</key>
   <string>Use Face ID to quickly unlock TEEEM</string>
   ```

2. **Capabilities (Signing & Capabilities tab):**
   - Push Notifications
   - Background Modes: Background fetch, Remote notifications
   - Keychain Sharing (optional)

3. **Build Settings:**
   - iOS Deployment Target: 16.0
   - Swift Language Version: 5.0

### Running the App

1. **Select a simulator** (iPhone 15 Pro recommended)
2. **Press ⌘R** to build and run
3. **Login** with your TEEEM credentials

### Local Development

The app connects to:
- **Debug:** `http://localhost:3001` (local Rails backend)
- **Release:** `https://teeemlive-ce8e2660a615.herokuapp.com` (production)

To test with local backend:
1. Start Rails: `cd backend && bin/rails server -p 3001`
2. Run app in Simulator

### App Store Submission

When ready to submit:

1. **Archive:** Product → Archive
2. **App Store Connect:** Create app listing
3. **Screenshots:** iPhone 15 Pro + iPad Pro 12.9"
4. **Privacy Policy:** Required URL
5. **Submit for Review**

## Features

### Phase 1 (Current)
- [x] JWT Authentication
- [x] Biometric unlock (FaceID/TouchID)
- [x] Jobs list and detail
- [x] Tasks list and detail
- [x] Task actions (start, complete, hold)
- [x] Settings and logout

### Phase 2 (Planned)
- [ ] Photo capture with GPS
- [ ] Photo upload queue
- [ ] Document scanner (VisionKit)
- [ ] Offline sync (Core Data)
- [ ] Push notifications

### Phase 3 (Future)
- [ ] Contacts module
- [ ] Voice notes
- [ ] iPad split view
- [ ] Widget

## API Endpoints Used

| Feature | Endpoint |
|---------|----------|
| Login | `POST /api/v1/auth/login` |
| Current User | `GET /api/v1/auth/me` |
| Jobs List | `GET /api/v1/jobs` |
| Job Detail | `GET /api/v1/jobs/:id` |
| My Tasks | `GET /api/v1/sm_tasks?mine=true` |
| Start Task | `POST /api/v1/sm_tasks/:id/start` |
| Complete Task | `POST /api/v1/sm_tasks/:id/complete` |
| Hold Task | `POST /api/v1/sm_tasks/:id/hold` |
| Upload Photo | `POST /api/v1/sm_field/upload_photo` |

## Troubleshooting

### "No such module" errors
Xcode needs to index files. Clean build: ⌘⇧K, then rebuild: ⌘B

### Simulator won't connect to localhost
Add App Transport Security exception in Info.plist:
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
</dict>
```

### Keychain errors in Simulator
Reset simulator: Device → Erase All Content and Settings

## Support

- **Issues:** Contact TEEEM support
- **Code questions:** Ask Claude
