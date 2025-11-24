# Trapid Frontend

React frontend for Trapid application, built with Vite.

## Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Update .env with your API URL

# Start development server
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173).

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## API Integration

The app uses a configured API client (`src/api.js`) to communicate with the backend:

```javascript
import { api } from './api';

// Example usage
const fetchData = async () => {
  try {
    const data = await api.get('/api/v1/items');
    console.log(data);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
};
```

## Environment Variables

Create a `.env` file in the frontend directory:

```
VITE_API_URL=http://localhost:3000
```

For production (Vercel), set this in your Vercel project settings.

## Deployment on Vercel

### Option 1: Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow the prompts
```

### Option 2: Using GitHub Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Configure:
   - Framework Preset: Vite
   - Root Directory: frontend
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Add environment variable:
   - Name: `VITE_API_URL`
   - Value: `https://your-api.herokuapp.com`
6. Deploy

## Project Structure

```
frontend/
├── public/          # Static assets
├── src/
│   ├── assets/      # Images, fonts, etc.
│   ├── api.js       # API client
│   ├── App.jsx      # Main app component
│   ├── App.css      # App styles
│   ├── index.css    # Global styles
│   └── main.jsx     # Entry point
├── .env             # Environment variables (local)
├── .env.example     # Environment template
├── index.html       # HTML template
├── package.json     # Dependencies
├── vercel.json      # Vercel configuration
└── vite.config.js   # Vite configuration
```

## Building for Production

```bash
npm run build
```

This creates an optimized production build in the `dist` directory.

## Technologies

- React 19
- Vite 7
- ESLint
