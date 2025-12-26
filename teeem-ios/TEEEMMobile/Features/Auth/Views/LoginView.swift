import SwiftUI

struct LoginView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var viewModel = LoginViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    // Logo
                    logoSection

                    // Login Form
                    loginFormSection

                    // Biometric Login (if available and previously logged in)
                    if viewModel.canUseBiometrics {
                        biometricSection
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 60)
            }
            .background(Color(.systemGroupedBackground))
            .navigationBarHidden(true)
            .alert("Login Failed", isPresented: $viewModel.showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage)
            }
            .disabled(viewModel.isLoading)
            .overlay {
                if viewModel.isLoading {
                    ProgressView()
                        .scaleEffect(1.5)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.black.opacity(0.2))
                }
            }
        }
    }

    // MARK: - Logo Section

    private var logoSection: some View {
        VStack(spacing: 16) {
            // Placeholder for TEEEM logo
            ZStack {
                Circle()
                    .fill(Color.accentColor.gradient)
                    .frame(width: 100, height: 100)

                Text("T")
                    .font(.system(size: 48, weight: .bold))
                    .foregroundColor(.white)
            }

            Text("TEEEM Mobile")
                .font(.title)
                .fontWeight(.bold)

            Text("Sign in to continue")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }

    // MARK: - Login Form Section

    private var loginFormSection: some View {
        VStack(spacing: 16) {
            // Email Field
            VStack(alignment: .leading, spacing: 8) {
                Text("Email")
                    .font(.subheadline)
                    .fontWeight(.medium)

                TextField("you@company.com", text: $viewModel.email)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
                    .autocorrectionDisabled()
            }

            // Password Field
            VStack(alignment: .leading, spacing: 8) {
                Text("Password")
                    .font(.subheadline)
                    .fontWeight(.medium)

                SecureField("Enter your password", text: $viewModel.password)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.password)
            }

            // Login Button
            Button {
                Task {
                    await viewModel.login(appState: appState)
                }
            } label: {
                Text("Sign In")
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(viewModel.canLogin ? Color.accentColor : Color.gray)
                    .cornerRadius(10)
            }
            .disabled(!viewModel.canLogin)
        }
        .padding(24)
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: 4)
    }

    // MARK: - Biometric Section

    private var biometricSection: some View {
        VStack(spacing: 16) {
            Divider()

            Button {
                Task {
                    await viewModel.loginWithBiometrics(appState: appState)
                }
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: viewModel.biometricType.systemImageName)
                        .font(.title2)

                    Text("Sign in with \(viewModel.biometricType.displayName)")
                        .font(.headline)
                }
                .foregroundColor(.accentColor)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.accentColor.opacity(0.1))
                .cornerRadius(10)
            }
        }
    }
}

// MARK: - Preview

#Preview {
    LoginView()
        .environmentObject(AppState())
}
