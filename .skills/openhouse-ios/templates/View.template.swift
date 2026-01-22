/**
 * SwiftUI View Template for OpenHouse iOS App
 *
 * Usage: Copy and customize for new views
 *
 * Checklist:
 * - [ ] Proper state management (@State, @StateObject, @Binding)
 * - [ ] Loading/error/empty states handled
 * - [ ] Accessibility labels and hints
 * - [ ] Dynamic Type support
 * - [ ] Dark mode compatible colors
 * - [ ] Navigation configured correctly
 */

import SwiftUI

// MARK: - View

struct FeatureNameView: View {
    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    // MARK: - State

    @StateObject private var viewModel = FeatureNameViewModel()
    @State private var showSheet = false

    // MARK: - Properties

    let propertyId: String

    // MARK: - Body

    var body: some View {
        content
            .navigationTitle("Feature Name")
            .navigationBarTitleDisplayMode(.large)
            .toolbar { toolbarContent }
            .refreshable { await viewModel.refresh() }
            .task { await viewModel.load() }
            .sheet(isPresented: $showSheet) { sheetContent }
            .alert("Error", isPresented: $viewModel.showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage ?? "An error occurred")
            }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingView

        case .loaded(let data):
            if data.isEmpty {
                emptyView
            } else {
                loadedView(data: data)
            }

        case .error(let error):
            errorView(error: error)
        }
    }

    private var loadingView: some View {
        ProgressView("Loading...")
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyView: some View {
        ContentUnavailableView(
            "No Items",
            systemImage: "tray",
            description: Text("Items will appear here once available.")
        )
    }

    private func loadedView(data: [FeatureItem]) -> some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                ForEach(data) { item in
                    FeatureItemRow(item: item)
                }
            }
            .padding()
        }
    }

    private func errorView(error: Error) -> some View {
        ContentUnavailableView {
            Label("Unable to Load", systemImage: "exclamationmark.triangle")
        } description: {
            Text(error.localizedDescription)
        } actions: {
            Button("Try Again") {
                Task { await viewModel.load() }
            }
            .buttonStyle(.borderedProminent)
            .tint(.openHouseGold)
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Button("Add", systemImage: "plus") {
                showSheet = true
            }
        }

        ToolbarItem(placement: .topBarLeading) {
            Menu {
                Button("Option 1") { }
                Button("Option 2") { }
            } label: {
                Label("More", systemImage: "ellipsis.circle")
            }
        }
    }

    // MARK: - Sheet

    @ViewBuilder
    private var sheetContent: some View {
        NavigationStack {
            Text("Sheet Content")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { showSheet = false }
                    }
                }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

// MARK: - View Model

@MainActor
class FeatureNameViewModel: ObservableObject {
    enum State {
        case loading
        case loaded([FeatureItem])
        case error(Error)
    }

    @Published var state: State = .loading
    @Published var showError = false
    @Published var errorMessage: String?

    func load() async {
        state = .loading
        do {
            // Simulate API call
            try await Task.sleep(for: .seconds(1))
            let items: [FeatureItem] = [] // Replace with actual API call
            state = .loaded(items)
        } catch {
            state = .error(error)
        }
    }

    func refresh() async {
        await load()
    }
}

// MARK: - Supporting Types

struct FeatureItem: Identifiable {
    let id: String
    let title: String
    let subtitle: String
}

struct FeatureItemRow: View {
    let item: FeatureItem

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "star")
                .foregroundStyle(.openHouseGold)

            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .font(.headline)

                Text(item.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding()
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(item.title), \(item.subtitle)")
        .accessibilityHint("Double tap to view details")
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        FeatureNameView(propertyId: "preview-id")
    }
}
