---
name: OpenHouse iOS
description: Build and maintain the OpenHouse AI iOS app with SwiftUI. Covers Human Interface Guidelines, SwiftUI patterns, navigation, property management features, and homeowner-focused design. Use when working on the iOS mobile app.
version: 1.0.0
triggers:
  - ios
  - swift
  - swiftui
  - mobile
  - iphone
  - ipad
  - xcode
  - homeowner app
---

# OpenHouse iOS Development Skill

Master iOS Human Interface Guidelines (HIG) and SwiftUI patterns to build the OpenHouse AI homeowner mobile app—a polished, native iOS experience for property management.

---

## Part 1: OpenHouse iOS App Context

### App Purpose

The OpenHouse AI iOS app serves homeowners in new-build developments, providing:

- **AI Chat Assistant** - Answer questions about their home using property documentation
- **Document Access** - View and download property documents (user manuals, warranties, etc.)
- **Snagging Reports** - Submit and track defects/issues with photos
- **Notifications** - Receive updates from developers about their property
- **Digital Handover** - Access keys, codes, and handover documentation

### Design Language

The app should reflect the OpenHouse brand:

- **Primary Color**: Gold (#F5B800) - Used for CTAs, highlights, and branding
- **Secondary**: Deep charcoal/black for backgrounds and contrast
- **Accent**: System blue for links and interactive elements
- **Style**: Modern, professional, premium feel befitting property ownership

### Target Users

- New homeowners (first-time buyers to experienced)
- Age range: 25-65+
- Tech comfort: Varies widely
- Usage context: At home, on-the-go, during move-in

---

## Part 2: SwiftUI Fundamentals

### Core Principles

1. **Clarity** - Content is legible, icons are precise, adornments are subtle
2. **Deference** - UI helps users understand content without competing with it
3. **Depth** - Visual layers and motion convey hierarchy and enable navigation

### Layout System

#### Stack-Based Layouts

```swift
// Vertical stack with alignment
VStack(alignment: .leading, spacing: 12) {
    Text("Property Dashboard")
        .font(.headline)
    Text("Welcome to your new home")
        .font(.subheadline)
        .foregroundStyle(.secondary)
}

// Horizontal stack with flexible spacing
HStack {
    Image(systemName: "house.fill")
        .foregroundStyle(Color.openHouseGold)
    Text("Unit 42")
    Spacer()
    Text("View Details")
        .foregroundStyle(.blue)
}
```

#### Grid Layouts

```swift
// Adaptive grid for document cards
LazyVGrid(columns: [
    GridItem(.adaptive(minimum: 150, maximum: 200))
], spacing: 16) {
    ForEach(documents) { document in
        DocumentCard(document: document)
    }
}

// Fixed 2-column grid for quick actions
LazyVGrid(columns: [
    GridItem(.flexible()),
    GridItem(.flexible())
], spacing: 12) {
    QuickActionCard(title: "Report Issue", icon: "exclamationmark.triangle")
    QuickActionCard(title: "View Documents", icon: "doc.text")
    QuickActionCard(title: "Contact Developer", icon: "envelope")
    QuickActionCard(title: "AI Assistant", icon: "sparkles")
}
```

---

## Part 3: OpenHouse Design System

### Color System

```swift
extension Color {
    // OpenHouse Brand Colors
    static let openHouseGold = Color(red: 245/255, green: 184/255, blue: 0/255) // #F5B800
    static let openHouseGoldDark = Color(red: 204/255, green: 153/255, blue: 0/255)
    static let openHouseGoldLight = Color(red: 255/255, green: 214/255, blue: 102/255)

    // Semantic Colors
    static let openHousePrimary = openHouseGold
    static let openHouseBackground = Color(uiColor: .systemBackground)
    static let openHouseSecondaryBackground = Color(uiColor: .secondarySystemBackground)

    // Status Colors
    static let openHouseSuccess = Color.green
    static let openHouseWarning = Color.orange
    static let openHouseError = Color.red
    static let openHouseInfo = Color.blue
}
```

### Typography Scale

```swift
struct OpenHouseTypography {
    // Titles
    static let largeTitle = Font.largeTitle.weight(.bold)      // 34pt - Dashboard headers
    static let title = Font.title.weight(.semibold)            // 28pt - Screen titles
    static let title2 = Font.title2.weight(.semibold)          // 22pt - Section headers
    static let title3 = Font.title3.weight(.semibold)          // 20pt - Card titles

    // Body
    static let headline = Font.headline                         // 17pt semibold - Emphasis
    static let body = Font.body                                 // 17pt regular - Primary text
    static let callout = Font.callout                          // 16pt - Secondary info

    // Supporting
    static let subheadline = Font.subheadline                  // 15pt - Metadata
    static let footnote = Font.footnote                        // 13pt - Timestamps
    static let caption = Font.caption                          // 12pt - Labels
}
```

### Standard Spacing

```swift
struct OpenHouseSpacing {
    static let xxs: CGFloat = 4
    static let xs: CGFloat = 8
    static let sm: CGFloat = 12
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48

    // Standard content insets
    static let screenPadding: CGFloat = 16
    static let cardPadding: CGFloat = 16
    static let listRowPadding: CGFloat = 12
}
```

---

## Part 4: Component Library

### Property Card

```swift
struct PropertyCard: View {
    let property: Property

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header with image
            AsyncImage(url: property.imageURL) { phase in
                switch phase {
                case .empty:
                    Rectangle()
                        .fill(Color.openHouseSecondaryBackground)
                        .overlay(ProgressView())
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                case .failure:
                    Rectangle()
                        .fill(Color.openHouseSecondaryBackground)
                        .overlay(
                            Image(systemName: "house")
                                .font(.largeTitle)
                                .foregroundStyle(.secondary)
                        )
                @unknown default:
                    EmptyView()
                }
            }
            .frame(height: 160)
            .clipShape(RoundedRectangle(cornerRadius: 12))

            // Property Info
            VStack(alignment: .leading, spacing: 4) {
                Text(property.name)
                    .font(.headline)

                Text(property.address)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                HStack {
                    Label(property.development, systemImage: "building.2")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Spacer()

                    StatusBadge(status: property.status)
                }
            }
        }
        .padding(OpenHouseSpacing.cardPadding)
        .background(Color.openHouseBackground, in: RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.08), radius: 8, y: 4)
    }
}
```

### Document Row

```swift
struct DocumentRow: View {
    let document: Document
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // File type icon
                DocumentIcon(type: document.fileType)
                    .frame(width: 44, height: 44)

                // Document info
                VStack(alignment: .leading, spacing: 2) {
                    Text(document.title)
                        .font(.body)
                        .foregroundStyle(.primary)
                        .lineLimit(1)

                    Text(document.category)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                // Download indicator
                if document.isDownloaded {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                } else {
                    Image(systemName: "arrow.down.circle")
                        .foregroundStyle(.blue)
                }

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
    }
}

struct DocumentIcon: View {
    let type: DocumentType

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(type.backgroundColor)

            Image(systemName: type.iconName)
                .font(.title3)
                .foregroundStyle(type.iconColor)
        }
    }
}
```

### Snagging Item Card

```swift
struct SnaggingItemCard: View {
    let item: SnaggingItem
    @State private var showDetail = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Photo preview
            if let photoURL = item.photos.first {
                AsyncImage(url: photoURL) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    Rectangle()
                        .fill(Color.openHouseSecondaryBackground)
                }
                .frame(height: 120)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            // Item details
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(item.title)
                        .font(.headline)
                    Spacer()
                    SnaggingStatusBadge(status: item.status)
                }

                Text(item.location)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Text(item.createdAt, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(12)
        .background(Color.openHouseBackground, in: RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
        .onTapGesture { showDetail = true }
        .sheet(isPresented: $showDetail) {
            SnaggingDetailView(item: item)
        }
    }
}

struct SnaggingStatusBadge: View {
    let status: SnaggingStatus

    var body: some View {
        Text(status.displayName)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(status.backgroundColor, in: Capsule())
            .foregroundStyle(status.textColor)
    }
}
```

### AI Chat Message

```swift
struct ChatMessageView: View {
    let message: ChatMessage

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if message.isFromAI {
                // AI Avatar
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [.openHouseGold, .openHouseGoldDark],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 32, height: 32)
                    .overlay(
                        Image(systemName: "sparkles")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)
                    )
            }

            VStack(alignment: message.isFromAI ? .leading : .trailing, spacing: 4) {
                Text(message.content)
                    .font(.body)
                    .padding(12)
                    .background(
                        message.isFromAI
                            ? Color.openHouseSecondaryBackground
                            : Color.openHouseGold
                    )
                    .foregroundStyle(message.isFromAI ? .primary : .white)
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                Text(message.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }

            if !message.isFromAI {
                Spacer(minLength: 40)
            }
        }
        .padding(.horizontal)
    }
}
```

### Quick Action Button

```swift
struct QuickActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(color)
                    .frame(width: 48, height: 48)
                    .background(color.opacity(0.15), in: Circle())

                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color.openHouseBackground, in: RoundedRectangle(cornerRadius: 12))
            .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
        }
        .buttonStyle(.plain)
    }
}
```

---

## Part 5: Navigation Patterns

### Main Tab Structure

```swift
struct MainTabView: View {
    @State private var selectedTab: Tab = .home
    @StateObject private var notificationManager = NotificationManager()

    enum Tab: String, CaseIterable {
        case home, documents, chat, snagging, profile

        var title: String {
            switch self {
            case .home: return "Home"
            case .documents: return "Documents"
            case .chat: return "Assistant"
            case .snagging: return "Snagging"
            case .profile: return "Profile"
            }
        }

        var icon: String {
            switch self {
            case .home: return "house"
            case .documents: return "doc.text"
            case .chat: return "sparkles"
            case .snagging: return "checklist"
            case .profile: return "person"
            }
        }
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            ForEach(Tab.allCases, id: \.self) { tab in
                NavigationStack {
                    tabContent(for: tab)
                }
                .tabItem {
                    Label(tab.title, systemImage: tab.icon)
                }
                .tag(tab)
                .badge(tab == .snagging ? notificationManager.snaggingBadgeCount : 0)
            }
        }
        .tint(.openHouseGold)
    }

    @ViewBuilder
    private func tabContent(for tab: Tab) -> some View {
        switch tab {
        case .home:
            HomeView()
        case .documents:
            DocumentsView()
        case .chat:
            ChatView()
        case .snagging:
            SnaggingListView()
        case .profile:
            ProfileView()
        }
    }
}
```

### NavigationStack with Destinations

```swift
struct HomeView: View {
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 24) {
                    // Welcome header
                    WelcomeHeader()

                    // Quick actions grid
                    QuickActionsGrid()

                    // Recent activity
                    RecentActivitySection()

                    // Property overview
                    PropertyOverviewCard()
                }
                .padding()
            }
            .navigationTitle("Home")
            .navigationDestination(for: HomeDestination.self) { destination in
                switch destination {
                case .property(let id):
                    PropertyDetailView(propertyId: id)
                case .document(let id):
                    DocumentDetailView(documentId: id)
                case .notification(let id):
                    NotificationDetailView(notificationId: id)
                }
            }
        }
    }

    enum HomeDestination: Hashable {
        case property(id: String)
        case document(id: String)
        case notification(id: String)
    }
}
```

### Sheet Presentation

```swift
struct SnaggingListView: View {
    @State private var showNewSnaggingSheet = false
    @State private var selectedFilter: SnaggingFilter = .all

    var body: some View {
        List {
            ForEach(filteredItems) { item in
                SnaggingItemRow(item: item)
            }
        }
        .navigationTitle("Snagging")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Report Issue", systemImage: "plus") {
                    showNewSnaggingSheet = true
                }
            }

            ToolbarItem(placement: .topBarLeading) {
                Menu {
                    ForEach(SnaggingFilter.allCases, id: \.self) { filter in
                        Button(filter.displayName) {
                            selectedFilter = filter
                        }
                    }
                } label: {
                    Label("Filter", systemImage: "line.3.horizontal.decrease.circle")
                }
            }
        }
        .sheet(isPresented: $showNewSnaggingSheet) {
            NewSnaggingView()
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
    }
}
```

---

## Part 6: Data Loading Patterns

### Async Content View

```swift
struct DocumentsView: View {
    @StateObject private var viewModel = DocumentsViewModel()

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                ProgressView("Loading documents...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

            case .loaded(let documents):
                if documents.isEmpty {
                    ContentUnavailableView(
                        "No Documents",
                        systemImage: "doc.text",
                        description: Text("Your property documents will appear here once uploaded by your developer.")
                    )
                } else {
                    DocumentListView(documents: documents)
                }

            case .error(let error):
                ContentUnavailableView {
                    Label("Unable to Load", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error.localizedDescription)
                } actions: {
                    Button("Try Again") {
                        Task { await viewModel.loadDocuments() }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.openHouseGold)
                }
            }
        }
        .navigationTitle("Documents")
        .refreshable {
            await viewModel.loadDocuments()
        }
        .task {
            await viewModel.loadDocuments()
        }
    }
}

@MainActor
class DocumentsViewModel: ObservableObject {
    enum State {
        case loading
        case loaded([Document])
        case error(Error)
    }

    @Published var state: State = .loading

    func loadDocuments() async {
        state = .loading
        do {
            let documents = try await DocumentService.shared.fetchDocuments()
            state = .loaded(documents)
        } catch {
            state = .error(error)
        }
    }
}
```

### Pull-to-Refresh

```swift
struct NotificationsView: View {
    @StateObject private var viewModel = NotificationsViewModel()

    var body: some View {
        List(viewModel.notifications) { notification in
            NotificationRow(notification: notification)
        }
        .listStyle(.plain)
        .refreshable {
            await viewModel.refresh()
        }
        .overlay {
            if viewModel.isLoading && viewModel.notifications.isEmpty {
                ProgressView()
            }
        }
    }
}
```

### Skeleton Loading

```swift
struct DocumentListSkeleton: View {
    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<5, id: \.self) { _ in
                DocumentRowSkeleton()
            }
        }
        .padding()
    }
}

struct DocumentRowSkeleton: View {
    @State private var isAnimating = false

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.gray.opacity(0.2))
                .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 6) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.gray.opacity(0.2))
                    .frame(height: 16)
                    .frame(maxWidth: 200)

                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.gray.opacity(0.15))
                    .frame(height: 12)
                    .frame(maxWidth: 120)
            }

            Spacer()
        }
        .opacity(isAnimating ? 0.5 : 1.0)
        .animation(.easeInOut(duration: 0.8).repeatForever(), value: isAnimating)
        .onAppear { isAnimating = true }
    }
}
```

---

## Part 7: Forms and Input

### New Snagging Report Form

```swift
struct NewSnaggingView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = NewSnaggingViewModel()

    var body: some View {
        NavigationStack {
            Form {
                Section("Issue Details") {
                    TextField("Title", text: $viewModel.title)

                    Picker("Location", selection: $viewModel.selectedRoom) {
                        ForEach(Room.allCases, id: \.self) { room in
                            Text(room.displayName).tag(room)
                        }
                    }

                    Picker("Category", selection: $viewModel.selectedCategory) {
                        ForEach(SnaggingCategory.allCases, id: \.self) { category in
                            Text(category.displayName).tag(category)
                        }
                    }
                }

                Section("Description") {
                    TextEditor(text: $viewModel.description)
                        .frame(minHeight: 100)
                }

                Section("Photos") {
                    PhotoPickerGrid(photos: $viewModel.photos)

                    Button("Add Photo", systemImage: "camera") {
                        viewModel.showPhotoPicker = true
                    }
                }

                Section("Priority") {
                    Picker("Priority", selection: $viewModel.priority) {
                        ForEach(SnaggingPriority.allCases, id: \.self) { priority in
                            Label(priority.displayName, systemImage: priority.icon)
                                .tag(priority)
                        }
                    }
                    .pickerStyle(.segmented)
                }
            }
            .navigationTitle("Report Issue")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Submit") {
                        Task { await viewModel.submit() }
                    }
                    .disabled(!viewModel.isValid)
                }
            }
            .sheet(isPresented: $viewModel.showPhotoPicker) {
                PhotoPicker(selectedPhotos: $viewModel.photos)
            }
            .alert("Error", isPresented: $viewModel.showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage ?? "An error occurred")
            }
        }
    }
}
```

---

## Part 8: Accessibility

### VoiceOver Support

```swift
struct PropertyCard: View {
    let property: Property

    var body: some View {
        // ... visual content ...
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(property.name), \(property.address)")
        .accessibilityValue("Status: \(property.status.displayName)")
        .accessibilityHint("Double tap to view property details")
        .accessibilityAddTraits(.isButton)
    }
}
```

### Dynamic Type Support

```swift
struct AdaptiveDocumentRow: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let document: Document

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                // Vertical layout for accessibility sizes
                VStack(alignment: .leading, spacing: 8) {
                    DocumentIcon(type: document.fileType)
                    documentInfo
                    downloadStatus
                }
            } else {
                // Horizontal layout for standard sizes
                HStack(spacing: 12) {
                    DocumentIcon(type: document.fileType)
                    documentInfo
                    Spacer()
                    downloadStatus
                }
            }
        }
    }

    private var documentInfo: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(document.title)
                .font(.body)
            Text(document.category)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var downloadStatus: some View {
        Image(systemName: document.isDownloaded ? "checkmark.circle.fill" : "arrow.down.circle")
            .foregroundStyle(document.isDownloaded ? .green : .blue)
    }
}
```

---

## Part 9: Animations

### Micro-interactions

```swift
struct LikeButton: View {
    @State private var isLiked = false

    var body: some View {
        Button {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                isLiked.toggle()
            }

            // Haptic feedback
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()
        } label: {
            Image(systemName: isLiked ? "heart.fill" : "heart")
                .font(.title2)
                .foregroundStyle(isLiked ? .red : .secondary)
                .scaleEffect(isLiked ? 1.2 : 1.0)
        }
        .buttonStyle(.plain)
        .symbolEffect(.bounce, value: isLiked)
    }
}
```

### Loading Transitions

```swift
struct ContentTransitionView: View {
    @State private var isLoaded = false
    let content: [Item]

    var body: some View {
        VStack {
            ForEach(Array(content.enumerated()), id: \.element.id) { index, item in
                ItemRow(item: item)
                    .opacity(isLoaded ? 1 : 0)
                    .offset(y: isLoaded ? 0 : 20)
                    .animation(
                        .spring(response: 0.4, dampingFraction: 0.8)
                            .delay(Double(index) * 0.05),
                        value: isLoaded
                    )
            }
        }
        .onAppear {
            isLoaded = true
        }
    }
}
```

---

## Part 10: Best Practices Checklist

### Design

- [ ] Use semantic colors (`.primary`, `.secondary`, `.background`)
- [ ] Apply OpenHouse brand colors for accents and CTAs
- [ ] Use SF Symbols for consistent iconography
- [ ] Support Dynamic Type with semantic fonts
- [ ] Test in both light and dark mode
- [ ] Ensure minimum 44pt touch targets

### Navigation

- [ ] Use NavigationStack for hierarchical navigation
- [ ] Use TabView for main app sections (max 5 tabs)
- [ ] Use sheets for modal content
- [ ] Support state restoration with `@SceneStorage`
- [ ] Handle deep links appropriately

### Performance

- [ ] Use `LazyVStack`/`LazyHStack` for long lists
- [ ] Implement skeleton loading for async content
- [ ] Use `@StateObject` for view models (not `@ObservedObject`)
- [ ] Avoid unnecessary re-renders with proper state management

### Accessibility

- [ ] Add `accessibilityLabel` to all interactive elements
- [ ] Use `accessibilityHint` for complex interactions
- [ ] Support VoiceOver navigation
- [ ] Test with Dynamic Type at all sizes
- [ ] Ensure sufficient color contrast

### User Experience

- [ ] Provide haptic feedback for important actions
- [ ] Show clear loading and error states
- [ ] Use pull-to-refresh for updatable content
- [ ] Display meaningful empty states
- [ ] Animate state transitions smoothly

---

## Resources

- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [SwiftUI Documentation](https://developer.apple.com/documentation/swiftui)
- [SF Symbols App](https://developer.apple.com/sf-symbols/)
- [WWDC SwiftUI Sessions](https://developer.apple.com/videos/swiftui/)
