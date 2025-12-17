# Be sure to restart your server when you modify this file.

# Avoid CORS issues when API is called from the frontend app.
# Handle Cross-Origin Resource Sharing (CORS) in order to accept cross-origin Ajax requests.

# Read more: https://github.com/cyu/rack-cors

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    # Allow all Vercel preview and production deployments, plus localhost
    origins(
      "https://teeemlive.vercel.app",      # Production frontend
      "https://teeemrob.vercel.app",       # Rob's dev frontend
      "https://teeemsam.vercel.app",       # Sam's dev frontend
      "https://teeem.vercel.app",          # Legacy production frontend
      "https://oldfrontend-one.vercel.app", # Legacy frontend deployment
      /https:\/\/teeem.*\.vercel\.app$/,   # All Vercel deployments (teeem.vercel.app, teeem-*.vercel.app, etc.)
      /http:\/\/localhost:(3000|3001|5173|5174|5175|5176|5177|5178|5179|5180|5181|5182|5183|5184|5185|5186)$/,  # Localhost ports 3000-3001 and 5173-5186
      "https://tekna.com.au",              # Tekna Homes website (embedded login widget)
      "https://www.tekna.com.au"           # Tekna Homes www subdomain
    )

    resource "*",
      headers: :any,
      methods: [ :get, :post, :put, :patch, :delete, :options, :head ],
      credentials: true
  end
end
