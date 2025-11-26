# Be sure to restart your server when you modify this file.

# Avoid CORS issues when API is called from the frontend app.
# Handle Cross-Origin Resource Sharing (CORS) in order to accept cross-origin Ajax requests.

# Read more: https://github.com/cyu/rack-cors

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    # Allow all Vercel preview and production deployments, plus localhost
    origins(
      /https:\/\/trapid.*\.vercel\.app$/,  # All Vercel deployments (trapid.vercel.app, trapid-*.vercel.app, trapidrob.vercel.app, etc.)
      /http:\/\/localhost:(5173|5174|5175|5176|5177|5178|5179|5180|5181|5182|5183|5184|5185|5186)$/  # Localhost ports 5173-5186
    )

    resource "*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      credentials: true
  end
end
