import SwiftUI

struct LoginView: View {
    @EnvironmentObject var appState: AppState
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                Spacer()
                Text("TEEEM")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                Text("Mobile")
                    .font(.title2)
                    .foregroundColor(.secondary)

                VStack(spacing: 16) {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .textFieldStyle(.roundedBorder)

                    SecureField("Password", text: $password)
                        .textContentType(.password)
                        .textFieldStyle(.roundedBorder)
                }
                .padding(.horizontal, 32)

                if let error = errorMessage {
                    Text(error)
                        .foregroundColor(.red)
                        .font(.caption)
                }

                Button {
                    Task { await login() }
                } label: {
                    if isLoading {
                        ProgressView()
                    } else {
                        Text("Sign In")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .padding(.horizontal, 32)
                .disabled(email.isEmpty || password.isEmpty || isLoading)

                Spacer()
            }
        }
    }

    private func login() async {
        isLoading = true
        errorMessage = nil
        do {
            try await appState.login(email: email, password: password)
        } catch {
            errorMessage = "Invalid email or password"
        }
        isLoading = false
    }
}
