# TEEEM - Quick Start Guide

## What's Been Built

Your TEEEM application foundation is complete with:

### Backend (Rails API)
- Rails 8.0 API-only mode
- PostgreSQL database configured
- CORS enabled for frontend communication
- Health check endpoint at `/health`
- Ready for Heroku deployment

### Frontend (React + Vite)
- React 19 with Vite 7
- API client utility pre-configured
- Environment variable setup
- Ready for Vercel deployment

## Next Steps

### 1. Test Locally

**Terminal 1 - Backend:**
```bash
cd backend
rails db:create
rails db:migrate
rails server
```

Visit [http://localhost:3000/health](http://localhost:3000/health) - you should see:
```json
{"status":"ok","timestamp":"...","environment":"development"}
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) - you should see the React app.

### 2. Push to GitHub

```bash
# From the teeem directory
git add .
git commit -m "Initial commit: Rails + React setup"
git branch -M main

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/teeem.git
git push -u origin main
```

### 3. Deploy Backend to Heroku

```bash
cd backend

# Login to Heroku
heroku login

# Create app
heroku create teeem-api

# Add PostgreSQL
heroku addons:create heroku-postgresql:essential-0

# Set environment variables
heroku config:set RAILS_ENV=production
heroku config:set RAILS_LOG_TO_STDOUT=enabled
heroku config:set CORS_ORIGINS=http://localhost:5173

# Deploy
git push heroku main

# Run migrations
heroku run rails db:migrate

# Test it
heroku open
# Visit /health endpoint
```

### 4. Deploy Frontend to Vercel

**Option A - CLI:**
```bash
cd frontend
npm i -g vercel
vercel
# Follow prompts
```

**Option B - GitHub (Recommended):**
1. Go to [vercel.com](https://vercel.com) and login
2. Click "New Project"
3. Import your GitHub repository
4. Configure:
   - Framework: Vite
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Add Environment Variable:
   - Name: `VITE_API_URL`
   - Value: `https://teeem-api.herokuapp.com` (your Heroku URL)
6. Deploy

### 5. Update CORS

After deploying to Vercel, update your Heroku CORS settings:

```bash
heroku config:set CORS_ORIGINS=https://your-vercel-app.vercel.app
```

## Project Structure

```
teeem/
├── backend/                # Rails API
│   ├── app/
│   │   └── controllers/
│   │       └── health_controller.rb
│   ├── config/
│   │   ├── database.yml
│   │   ├── routes.rb
│   │   └── initializers/
│   │       └── cors.rb
│   ├── Procfile           # Heroku configuration
│   ├── app.json           # Heroku app manifest
│   └── .env.example
│
├── frontend/              # React app
│   ├── src/
│   │   ├── api.js        # API client utility
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vercel.json       # Vercel configuration
│   └── .env.example
│
└── README.md             # Main documentation
```

## Adding Your First API Endpoint

### Backend (Rails):

1. Generate a controller:
```bash
cd backend
rails g controller api/v1/items index create show update destroy
```

2. Add routes in [config/routes.rb](backend/config/routes.rb):
```ruby
namespace :api do
  namespace :v1 do
    resources :items
  end
end
```

3. Implement controller logic in [app/controllers/api/v1/items_controller.rb](backend/app/controllers/api/v1/items_controller.rb)

### Frontend (React):

Use the API client in your components:
```javascript
import { api } from './api';

function ItemsList() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get('/api/v1/items')
       .then(data => setItems(data))
       .catch(error => console.error(error));
  }, []);

  return (
    <ul>
      {items.map(item => <li key={item.id}>{item.name}</li>)}
    </ul>
  );
}
```

## Troubleshooting

### CORS Issues
- Ensure `CORS_ORIGINS` environment variable includes your frontend URL
- Check [backend/config/initializers/cors.rb](backend/config/initializers/cors.rb)

### Database Connection Issues
- Check PostgreSQL is running: `pg_isready`
- Verify [backend/config/database.yml](backend/config/database.yml) settings

### Build Errors
- Backend: Run `bundle install`
- Frontend: Run `npm install`

## Resources

- [Rails Guides](https://guides.rubyonrails.org/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vite.dev/)
- [Heroku Dev Center](https://devcenter.heroku.com/)
- [Vercel Documentation](https://vercel.com/docs)

## Support

For issues or questions:
1. Check the README files in `backend/` and `frontend/` directories
2. Review deployment logs on Heroku and Vercel
3. Check environment variables are set correctly

---

Happy coding!
