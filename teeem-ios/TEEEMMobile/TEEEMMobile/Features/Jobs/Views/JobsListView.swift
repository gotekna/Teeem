import SwiftUI
import UIKit

struct JobsListView: View {
    @StateObject private var viewModel = JobsViewModel()
    @State private var searchText = ""

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.jobs.isEmpty {
                ProgressView("Loading jobs...")
            } else if viewModel.jobs.isEmpty {
                ContentUnavailableView("No Jobs", systemImage: "briefcase", description: Text("No jobs found"))
            } else {
                List(filteredJobs) { job in
                    NavigationLink(value: job) {
                        JobRowView(job: job)
                    }
                }
                .listStyle(.plain)
                .navigationDestination(for: Job.self) { job in
                    JobDetailView(job: job)
                }
            }
        }
        .navigationTitle("Jobs")
        .searchable(text: $searchText)
        .refreshable { await viewModel.loadJobs() }
        .task { await viewModel.loadJobs() }
    }

    private var filteredJobs: [Job] {
        searchText.isEmpty ? viewModel.jobs : viewModel.jobs.filter { $0.displayName.localizedCaseInsensitiveContains(searchText) }
    }
}

struct JobRowView: View {
    let job: Job
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(job.displayName).font(.headline)
                Spacer()
                Text(job.statusName)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(job.statusColor.opacity(0.15))
                    .foregroundColor(job.statusColor)
                    .cornerRadius(4)
            }
            if let loc = job.location, !loc.isEmpty {
                Text(loc).font(.subheadline).foregroundColor(.secondary)
            }
            if let value = job.formattedContractValue {
                Text(value).font(.caption).foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

struct JobDetailView: View {
    let job: Job
    @State private var showSchedule = false
    @State private var showPOs = false
    @State private var showPlans = false
    @State private var showPhotos = false
    @State private var showDocs = false
    @State private var showPeople = false

    var body: some View {
        List {
            // Job Info Section
            Section("Job Details") {
                LabeledContent("Job ID", value: "\(job.id)")
                LabeledContent("Status", value: job.statusName)
                if let value = job.formattedContractValue {
                    LabeledContent("Contract Value", value: value)
                }
                if let loc = job.location, !loc.isEmpty {
                    LabeledContent("Location", value: loc)
                }
            }

            // Quick Actions - Grid of buttons
            Section("Quick Actions") {
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 16) {
                    JobActionButton(icon: "calendar", title: "Schedule", color: .blue) {
                        showSchedule = true
                    }
                    JobActionButton(icon: "doc.text", title: "PO", color: .orange) {
                        showPOs = true
                    }
                    JobActionButton(icon: "doc.richtext", title: "Plans", color: .purple) {
                        showPlans = true
                    }
                    JobActionButton(icon: "photo.on.rectangle", title: "Photos", color: .green) {
                        showPhotos = true
                    }
                    JobActionButton(icon: "folder", title: "Docs", color: .indigo) {
                        showDocs = true
                    }
                    JobActionButton(icon: "person.2", title: "People", color: .pink) {
                        showPeople = true
                    }
                }
                .padding(.vertical, 8)
            }
        }
        .navigationTitle(job.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showSchedule) {
            NavigationStack {
                JobScheduleTab(job: job)
                    .navigationTitle("Schedule")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { showSchedule = false }
                        }
                    }
            }
        }
        .sheet(isPresented: $showPOs) {
            NavigationStack {
                JobPOTab(job: job)
                    .navigationTitle("Purchase Orders")
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { showPOs = false }
                        }
                    }
            }
        }
        .sheet(isPresented: $showPlans) {
            NavigationStack {
                JobPlansTab(job: job)
                    .navigationTitle("Plans")
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { showPlans = false }
                        }
                    }
            }
        }
        .sheet(isPresented: $showPhotos) {
            NavigationStack {
                JobPhotosTab(job: job)
                    .navigationTitle("Photos")
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { showPhotos = false }
                        }
                    }
            }
        }
        .sheet(isPresented: $showDocs) {
            NavigationStack {
                JobDocumentsTab(job: job)
                    .navigationTitle("Documents")
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { showDocs = false }
                        }
                    }
            }
        }
        .sheet(isPresented: $showPeople) {
            NavigationStack {
                JobPeopleTab(job: job)
                    .navigationTitle("People")
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { showPeople = false }
                        }
                    }
            }
        }
    }
}

// MARK: - Job Action Button
struct JobActionButton: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .frame(width: 50, height: 50)
                    .background(color.opacity(0.15))
                    .foregroundColor(color)
                    .cornerRadius(12)
                Text(title)
                    .font(.caption)
                    .foregroundColor(.primary)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Job Schedule Tab (Tasks)
struct JobScheduleTab: View {
    let job: Job
    @State private var tasks: [SMTask] = []
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading schedule...")
            } else if tasks.isEmpty {
                ContentUnavailableView("No Tasks", systemImage: "calendar", description: Text("No tasks for this job"))
            } else {
                List(tasks) { task in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(task.displayName).font(.headline)
                        HStack {
                            Text(task.taskStatus.displayName)
                                .font(.caption)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(task.taskStatus.color.opacity(0.15))
                                .foregroundColor(task.taskStatus.color)
                                .cornerRadius(4)
                            if let date = task.formattedDueDate {
                                Text(date)
                                    .font(.caption)
                                    .foregroundColor(task.dueStatusColor)
                            }
                        }
                    }
                }
            }
        }
        .task {
            await loadTasks()
        }
    }

    func loadTasks() async {
        do {
            tasks = try await APIClient.shared.get("sm_tasks?job_id=\(job.id)")
        } catch {
            print("Failed to load job tasks: \(error)")
        }
        isLoading = false
    }
}

// MARK: - Job PO Tab (Purchase Orders)
struct JobPOTab: View {
    let job: Job
    @State private var purchaseOrders: [PurchaseOrder] = []
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading purchase orders...")
            } else if purchaseOrders.isEmpty {
                ContentUnavailableView("No Purchase Orders", systemImage: "doc.text", description: Text("No POs for this job"))
            } else {
                List(purchaseOrders) { po in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(po.displayNumber)
                                .font(.headline)
                            Spacer()
                            Text(po.statusDisplayName)
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(po.statusColor.opacity(0.15))
                                .foregroundColor(po.statusColor)
                                .cornerRadius(4)
                        }

                        Text(po.supplierName)
                            .font(.subheadline)
                            .foregroundColor(.secondary)

                        if let desc = po.description, !desc.isEmpty {
                            Text(desc)
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(2)
                        }

                        if let total = po.formattedTotal {
                            Text(total)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundColor(.primary)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .task {
            await loadPurchaseOrders()
        }
    }

    func loadPurchaseOrders() async {
        do {
            purchaseOrders = try await APIClient.shared.get("purchase_orders?job_id=\(job.id)")
        } catch {
            print("Failed to load purchase orders: \(error)")
        }
        isLoading = false
    }
}

// MARK: - Job Plans Tab
struct JobPlansTab: View {
    let job: Job
    @State private var plans: [JobPlan] = []
    @State private var isLoading = true
    @State private var selectedPlan: JobPlan?

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading plans...")
            } else if plans.isEmpty {
                ContentUnavailableView("No Plans", systemImage: "doc.richtext", description: Text("No plans for this job"))
            } else {
                ScrollView {
                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible())
                    ], spacing: 16) {
                        ForEach(plans) { plan in
                            PlanThumbnailCard(plan: plan)
                                .onTapGesture {
                                    selectedPlan = plan
                                }
                        }
                    }
                    .padding()
                }
            }
        }
        .task {
            await loadPlans()
        }
        .sheet(item: $selectedPlan) { plan in
            NavigationStack {
                PlanDetailView(plan: plan)
                    .navigationTitle(plan.displayName)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { selectedPlan = nil }
                        }
                    }
            }
        }
    }

    func loadPlans() async {
        do {
            plans = try await APIClient.shared.get("jobs/\(job.id)/job_plans")
        } catch {
            print("Failed to load plans: \(error)")
        }
        isLoading = false
    }
}

// MARK: - Plan Thumbnail Card
struct PlanThumbnailCard: View {
    let plan: JobPlan

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Thumbnail
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(.systemGray6))
                    .aspectRatio(1.4, contentMode: .fit)

                if let thumbnailData = plan.microThumbnailData,
                   let uiImage = UIImage(data: thumbnailData) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                } else {
                    Image(systemName: "doc.richtext")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                }
            }

            // Plan info
            VStack(alignment: .leading, spacing: 2) {
                Text(plan.planType?.name ?? plan.displayName)
                    .font(.caption)
                    .fontWeight(.medium)
                    .lineLimit(2)

                HStack {
                    Text(plan.revisionLabel)
                        .font(.caption2)
                        .foregroundColor(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.blue)
                        .cornerRadius(4)

                    if !plan.fileSize.isEmpty {
                        Text(plan.fileSize)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .padding(8)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
    }
}

// MARK: - Plan Detail View
struct PlanDetailView: View {
    let plan: JobPlan
    @State private var showPDFViewer = false

    var body: some View {
        List {
            // View PDF Button - prominent at top
            if let fileId = plan.currentRevision?.sharepointFileId {
                Section {
                    Button {
                        showPDFViewer = true
                    } label: {
                        Label("View PDF", systemImage: "doc.text.fill")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                    }
                    .buttonStyle(.borderedProminent)
                    .listRowBackground(Color.clear)
                }
            }

            Section("Plan Information") {
                LabeledContent("Name", value: plan.planType?.name ?? plan.displayName)
                LabeledContent("Code", value: plan.planType?.code ?? "-")
                LabeledContent("Category", value: plan.categoryName)
                LabeledContent("Revision", value: plan.revisionLabel)
                LabeledContent("File Size", value: plan.fileSize)
            }

            if let thumbnailData = plan.microThumbnailData,
               let uiImage = UIImage(data: thumbnailData) {
                Section("Preview") {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .cornerRadius(8)
                }
            }

            if let webUrl = plan.currentRevision?.sharepointWebUrl,
               let url = URL(string: webUrl) {
                Section {
                    Link(destination: url) {
                        Label("Open in SharePoint", systemImage: "safari")
                    }
                }
            }
        }
        .fullScreenCover(isPresented: $showPDFViewer) {
            if let fileId = plan.currentRevision?.sharepointFileId {
                NavigationStack {
                    PDFViewerView(fileId: fileId, fileName: plan.fileName)
                        .toolbar {
                            ToolbarItem(placement: .topBarLeading) {
                                Button("Done") { showPDFViewer = false }
                            }
                        }
                }
            }
        }
    }
}

// MARK: - Job Photos Tab
struct JobPhotosTab: View {
    let job: Job
    @State private var photoFolders: [PhotoFolder] = []
    @State private var isLoading = true
    @State private var selectedFolder: PhotoFolder?
    @State private var jobFolderId: String?

    // Hardcoded photo folder categories with their typical names
    let defaultCategories = [
        ("Site", "mappin.and.ellipse", Color.orange),
        ("Slab", "square.grid.3x3.fill", Color.gray),
        ("Frame", "square.dashed", Color.brown),
        ("Enclosed", "house.fill", Color.blue),
        ("Fixing", "wrench.and.screwdriver.fill", Color.purple),
        ("PC", "checkmark.seal.fill", Color.green),
        ("Supervisor", "person.badge.shield.checkmark.fill", Color.indigo)
    ]

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading photos...")
            } else if photoFolders.isEmpty {
                ContentUnavailableView("No Photo Folders", systemImage: "photo.on.rectangle", description: Text("No photo folders for this job"))
            } else {
                ScrollView {
                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible())
                    ], spacing: 16) {
                        ForEach(photoFolders) { folder in
                            PhotoCategoryCard(folder: folder)
                                .onTapGesture {
                                    selectedFolder = folder
                                }
                        }
                    }
                    .padding()
                }
            }
        }
        .task {
            await loadPhotoFolders()
        }
        .sheet(item: $selectedFolder) { folder in
            NavigationStack {
                PhotoFolderView(folder: folder)
                    .navigationTitle(folder.displayName)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { selectedFolder = nil }
                        }
                    }
            }
        }
    }

    func loadPhotoFolders() async {
        // First, find the job's folder in SharePoint
        // Then navigate to the "06 Photo" subfolder
        do {
            // Get root folders to find TEEEM Jobs
            let rootResponse: SharePointFolderResponse = try await fetchFolders(folderId: nil)

            // Find TEEEM Jobs folder
            guard let teeemJobsFolder = rootResponse.folders.first(where: { $0.name == "TEEEM Jobs" }) else {
                print("TEEEM Jobs folder not found")
                isLoading = false
                return
            }

            // Find job folder (format: "046 - Job Name")
            let jobPrefix = String(format: "%03d", job.id)
            let jobFoldersResponse: SharePointFolderResponse = try await fetchFolders(folderId: teeemJobsFolder.id)

            guard let jobFolder = jobFoldersResponse.folders.first(where: { $0.name.hasPrefix(jobPrefix) }) else {
                print("Job folder not found for \(jobPrefix)")
                isLoading = false
                return
            }

            jobFolderId = jobFolder.id

            // Get subfolders of job folder
            let jobSubfoldersResponse: SharePointFolderResponse = try await fetchFolders(folderId: jobFolder.id)

            // Find Photo folder (usually "06 Photo")
            guard let photoMainFolder = jobSubfoldersResponse.folders.first(where: { $0.name.lowercased().contains("photo") }) else {
                print("Photo folder not found")
                isLoading = false
                return
            }

            // Get photo category subfolders
            let photoCategoriesResponse: SharePointFolderResponse = try await fetchFolders(folderId: photoMainFolder.id)
            photoFolders = photoCategoriesResponse.folders

        } catch {
            print("Failed to load photo folders: \(error)")
        }
        isLoading = false
    }

    func fetchFolders(folderId: String?) async throws -> SharePointFolderResponse {
        let baseURL = "https://teeemlive-ce8e2660a615.herokuapp.com/api/v1"
        var urlString = "\(baseURL)/documents/browse_folders"
        if let folderId = folderId {
            urlString += "?folder_id=\(folderId)"
        }

        guard let url = URL(string: urlString) else {
            throw URLError(.badURL)
        }

        var request = URLRequest(url: url)
        if let token = AuthManager.shared.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (data, _) = try await URLSession.shared.data(for: request)
        let decoder = JSONDecoder()
        return try decoder.decode(SharePointFolderResponse.self, from: data)
    }
}

// MARK: - Photo Category Card
struct PhotoCategoryCard: View {
    let folder: PhotoFolder

    var body: some View {
        VStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(folder.color.opacity(0.15))
                    .frame(height: 100)

                VStack(spacing: 8) {
                    Image(systemName: folder.icon)
                        .font(.system(size: 32))
                        .foregroundColor(folder.color)

                    Text("\(folder.childCount)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Text(folder.displayName)
                .font(.subheadline)
                .fontWeight(.medium)
                .lineLimit(1)
        }
        .padding(8)
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
    }
}

// MARK: - Photo Folder View (shows photos in a category)
struct PhotoFolderView: View {
    let folder: PhotoFolder
    @State private var files: [PhotoFile] = []
    @State private var isLoading = true
    @State private var selectedPhoto: PhotoFile?

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading photos...")
            } else if files.isEmpty {
                ContentUnavailableView("No Photos", systemImage: "photo", description: Text("No photos in this folder"))
            } else {
                ScrollView {
                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible()),
                        GridItem(.flexible())
                    ], spacing: 4) {
                        ForEach(files) { file in
                            PhotoThumbnail(file: file)
                                .onTapGesture {
                                    selectedPhoto = file
                                }
                        }
                    }
                    .padding(4)
                }
            }
        }
        .task {
            await loadFiles()
        }
        .sheet(item: $selectedPhoto) { photo in
            NavigationStack {
                PhotoDetailView(photo: photo)
                    .navigationTitle(photo.name)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Done") { selectedPhoto = nil }
                        }
                    }
            }
        }
    }

    func loadFiles() async {
        do {
            let baseURL = "https://teeemlive-ce8e2660a615.herokuapp.com/api/v1"
            let urlString = "\(baseURL)/documents/browse_folders?folder_id=\(folder.id)"

            guard let url = URL(string: urlString) else { return }

            var request = URLRequest(url: url)
            if let token = AuthManager.shared.accessToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }

            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try JSONDecoder().decode(SharePointFolderResponse.self, from: data)
            files = response.files ?? []
        } catch {
            print("Failed to load files: \(error)")
        }
        isLoading = false
    }
}

// MARK: - Photo Thumbnail
struct PhotoThumbnail: View {
    let file: PhotoFile

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 4)
                .fill(Color(.systemGray5))
                .aspectRatio(1, contentMode: .fit)

            if file.isImage {
                Image(systemName: "photo")
                    .font(.title)
                    .foregroundColor(.secondary)
            } else {
                Image(systemName: "doc")
                    .font(.title)
                    .foregroundColor(.secondary)
            }
        }
    }
}

// MARK: - Photo Detail View
struct PhotoDetailView: View {
    let photo: PhotoFile
    @State private var imageData: Data?
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading image...")
            } else if let data = imageData, let uiImage = UIImage(data: data) {
                ScrollView {
                    Image(uiImage: uiImage)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                }
            } else {
                ContentUnavailableView("Cannot Load", systemImage: "photo", description: Text("Could not load image"))
            }
        }
        .task {
            await loadImage()
        }
    }

    func loadImage() async {
        do {
            let baseURL = "https://teeemlive-ce8e2660a615.herokuapp.com/api/v1"
            let urlString = "\(baseURL)/documents/download?file_id=\(photo.id)"

            guard let url = URL(string: urlString) else { return }

            var request = URLRequest(url: url)
            if let token = AuthManager.shared.accessToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }

            let (data, _) = try await URLSession.shared.data(for: request)
            imageData = data
        } catch {
            print("Failed to load image: \(error)")
        }
        isLoading = false
    }
}

// MARK: - Job Documents Tab
struct JobDocumentsTab: View {
    let job: Job

    var body: some View {
        ContentUnavailableView("Documents", systemImage: "folder", description: Text("Coming soon"))
    }
}

// MARK: - Job People Tab
struct JobPeopleTab: View {
    let job: Job
    @State private var contacts: [JobContact] = []
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading people...")
            } else if contacts.isEmpty {
                ContentUnavailableView("No People", systemImage: "person.2", description: Text("No contacts for this job"))
            } else {
                List(contacts) { contact in
                    HStack(spacing: 12) {
                        // Avatar
                        ZStack {
                            Circle()
                                .fill(contact.roleColor.gradient)
                                .frame(width: 44, height: 44)
                            Text(contact.initials)
                                .font(.headline)
                                .foregroundColor(.white)
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text(contact.displayName)
                                    .font(.headline)
                                if contact.primary {
                                    Image(systemName: "star.fill")
                                        .font(.caption)
                                        .foregroundColor(.yellow)
                                }
                            }

                            Text(contact.roleDisplayName)
                                .font(.caption)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(contact.roleColor.opacity(0.15))
                                .foregroundColor(contact.roleColor)
                                .cornerRadius(4)

                            if let company = contact.companyName, !company.isEmpty {
                                Text(company)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }

                        Spacer()

                        // Action buttons
                        HStack(spacing: 12) {
                            if let phone = contact.mobilePhone ?? contact.officePhone, !phone.isEmpty {
                                Button {
                                    callPhone(phone)
                                } label: {
                                    Image(systemName: "phone.fill")
                                        .foregroundColor(.green)
                                }
                            }

                            if let email = contact.email, !email.isEmpty {
                                Button {
                                    sendEmail(email)
                                } label: {
                                    Image(systemName: "envelope.fill")
                                        .foregroundColor(.blue)
                                }
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .task {
            await loadContacts()
        }
    }

    func loadContacts() async {
        do {
            contacts = try await APIClient.shared.get("jobs/\(job.id)/job_contacts")
        } catch {
            print("Failed to load job contacts: \(error)")
        }
        isLoading = false
    }

    func callPhone(_ phone: String) {
        let cleaned = phone.replacingOccurrences(of: " ", with: "")
        if let url = URL(string: "tel://\(cleaned)") {
            UIApplication.shared.open(url)
        }
    }

    func sendEmail(_ email: String) {
        if let url = URL(string: "mailto:\(email)") {
            UIApplication.shared.open(url)
        }
    }
}
