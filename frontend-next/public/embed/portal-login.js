(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    apiUrl: 'https://teeemlive-ce8e2660a615.herokuapp.com',
    portalUrl: 'https://teeemlive.vercel.app/portal',
    containerId: 'teeem-portal-login'
  };

  // Styles for the widget
  const styles = `
    .teeem-login-widget {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 400px;
      margin: 0 auto;
      padding: 32px;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }

    .teeem-login-widget * {
      box-sizing: border-box;
    }

    .teeem-login-title {
      font-size: 24px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 8px 0;
      text-align: center;
    }

    .teeem-login-subtitle {
      font-size: 14px;
      color: #6b7280;
      margin: 0 0 24px 0;
      text-align: center;
    }

    .teeem-login-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .teeem-input-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .teeem-input-label {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
    }

    .teeem-input {
      width: 100%;
      padding: 12px 16px;
      font-size: 16px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .teeem-input:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }

    .teeem-input::placeholder {
      color: #9ca3af;
    }

    .teeem-submit-btn {
      width: 100%;
      padding: 14px 24px;
      font-size: 16px;
      font-weight: 600;
      color: #ffffff;
      background: #2563eb;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: background-color 0.15s ease, transform 0.1s ease;
      margin-top: 8px;
    }

    .teeem-submit-btn:hover {
      background: #1d4ed8;
    }

    .teeem-submit-btn:active {
      transform: scale(0.98);
    }

    .teeem-submit-btn:disabled {
      background: #9ca3af;
      cursor: not-allowed;
      transform: none;
    }

    .teeem-error {
      padding: 12px 16px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      color: #dc2626;
      font-size: 14px;
      text-align: center;
    }

    .teeem-forgot-link {
      text-align: center;
      margin-top: 16px;
    }

    .teeem-forgot-link a {
      font-size: 14px;
      color: #2563eb;
      text-decoration: none;
    }

    .teeem-forgot-link a:hover {
      text-decoration: underline;
    }

    .teeem-loading-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #ffffff;
      border-radius: 50%;
      border-top-color: transparent;
      animation: teeem-spin 0.8s linear infinite;
      margin-right: 8px;
      vertical-align: middle;
    }

    @keyframes teeem-spin {
      to { transform: rotate(360deg); }
    }

    .teeem-powered-by {
      text-align: center;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #9ca3af;
    }

    .teeem-powered-by a {
      color: #6b7280;
      text-decoration: none;
    }

    .teeem-powered-by a:hover {
      color: #2563eb;
    }

    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      .teeem-login-widget[data-theme="auto"] {
        background: #1f2937;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
      }

      .teeem-login-widget[data-theme="auto"] .teeem-login-title {
        color: #f9fafb;
      }

      .teeem-login-widget[data-theme="auto"] .teeem-login-subtitle {
        color: #9ca3af;
      }

      .teeem-login-widget[data-theme="auto"] .teeem-input-label {
        color: #d1d5db;
      }

      .teeem-login-widget[data-theme="auto"] .teeem-input {
        background: #374151;
        border-color: #4b5563;
        color: #f9fafb;
      }

      .teeem-login-widget[data-theme="auto"] .teeem-input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
      }

      .teeem-login-widget[data-theme="auto"] .teeem-powered-by {
        border-top-color: #374151;
      }
    }
  `;

  // Inject styles
  function injectStyles() {
    if (document.getElementById('teeem-login-styles')) return;

    const styleSheet = document.createElement('style');
    styleSheet.id = 'teeem-login-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  // Create the login widget HTML
  function createWidget(container, options) {
    const theme = options.theme || 'auto';
    const title = options.title || 'Client Portal';
    const subtitle = options.subtitle || 'Sign in to view your project';
    const buttonText = options.buttonText || 'Sign In';
    const showPoweredBy = options.showPoweredBy !== false;

    container.innerHTML = `
      <div class="teeem-login-widget" data-theme="${theme}">
        <h2 class="teeem-login-title">${title}</h2>
        <p class="teeem-login-subtitle">${subtitle}</p>

        <form class="teeem-login-form" id="teeem-login-form">
          <div class="teeem-error" id="teeem-error" style="display: none;"></div>

          <div class="teeem-input-group">
            <label class="teeem-input-label" for="teeem-email">Email</label>
            <input
              type="email"
              id="teeem-email"
              class="teeem-input"
              placeholder="your@email.com"
              required
              autocomplete="email"
            />
          </div>

          <div class="teeem-input-group">
            <label class="teeem-input-label" for="teeem-password">Password</label>
            <input
              type="password"
              id="teeem-password"
              class="teeem-input"
              placeholder="Enter your password"
              required
              autocomplete="current-password"
            />
          </div>

          <button type="submit" class="teeem-submit-btn" id="teeem-submit">
            ${buttonText}
          </button>
        </form>

        <div class="teeem-forgot-link">
          <a href="${CONFIG.portalUrl}/forgot-password" target="_blank">Forgot password?</a>
        </div>

        ${showPoweredBy ? `
          <div class="teeem-powered-by">
            Powered by <a href="https://teeem.com.au" target="_blank">TEEEM</a>
          </div>
        ` : ''}
      </div>
    `;

    // Attach form handler
    const form = document.getElementById('teeem-login-form');
    form.addEventListener('submit', handleSubmit);
  }

  // Handle form submission
  async function handleSubmit(e) {
    e.preventDefault();

    const email = document.getElementById('teeem-email').value.trim();
    const password = document.getElementById('teeem-password').value;
    const submitBtn = document.getElementById('teeem-submit');
    const errorEl = document.getElementById('teeem-error');
    const originalBtnText = submitBtn.textContent;

    // Clear previous errors
    errorEl.style.display = 'none';
    errorEl.textContent = '';

    // Show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="teeem-loading-spinner"></span>Signing in...';

    try {
      const response = await fetch(`${CONFIG.apiUrl}/api/v1/portal/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        // Store token for portal
        localStorage.setItem('portal_token', data.token);
        localStorage.setItem('portal_user', JSON.stringify(data.user));

        // Show success briefly
        submitBtn.innerHTML = 'Success! Redirecting...';
        submitBtn.style.background = '#059669';

        // Redirect to portal
        setTimeout(() => {
          window.location.href = CONFIG.portalUrl + '/dashboard';
        }, 500);
      } else {
        throw new Error(data.error || 'Invalid email or password');
      }
    } catch (err) {
      // Show error
      errorEl.textContent = err.message || 'Login failed. Please try again.';
      errorEl.style.display = 'block';

      // Reset button
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  }

  // Initialize the widget
  function init() {
    injectStyles();

    const container = document.getElementById(CONFIG.containerId);
    if (!container) {
      console.warn('TEEEM Portal Login: Container element not found. Add <div id="teeem-portal-login"></div> to your page.');
      return;
    }

    // Get options from data attributes
    const options = {
      theme: container.dataset.theme,
      title: container.dataset.title,
      subtitle: container.dataset.subtitle,
      buttonText: container.dataset.buttonText,
      showPoweredBy: container.dataset.poweredBy !== 'false'
    };

    createWidget(container, options);
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for manual initialization
  window.TeeemPortalLogin = {
    init: init,
    config: CONFIG
  };
})();
