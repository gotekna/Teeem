import SwiftUI

struct TaskStatusBadge: View {
    let status: TaskStatus

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: status.iconName)
                .font(.caption)

            Text(status.displayName)
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(status.color.opacity(0.15))
        .foregroundColor(status.color)
        .cornerRadius(8)
    }
}

#Preview {
    VStack(spacing: 16) {
        TaskStatusBadge(status: .notStarted)
        TaskStatusBadge(status: .inProgress)
        TaskStatusBadge(status: .onHold)
        TaskStatusBadge(status: .completed)
        TaskStatusBadge(status: .cancelled)
    }
    .padding()
}
