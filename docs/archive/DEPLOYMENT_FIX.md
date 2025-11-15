# Azure Deployment Fix - Station Manager

## Issues Fixed

### 1. **Missing Root package.json**
- **Problem**: The GitHub Actions workflow was running `npm install` and `npm run build` at the root level, but no root `package.json` existed.
- **Solution**: Created `/package.json` with scripts to build both frontend and backend.

### 2. **Improper Build Artifact**
- **Problem**: The workflow was uploading the entire directory including source files and node_modules.
- **Solution**: Updated workflow to create a zip file excluding unnecessary files and deploy only built artifacts.

### 3. **Missing Azure Configuration**
- **Problem**: Azure App Service didn't know how to run the Node.js application.
- **Solution**: 
  - Created `web.config` for IIS/iisnode configuration
  - Created `.deployment` file to configure Azure build settings
  - Added startup script

### 4. **Frontend Not Served**
- **Problem**: Backend wasn't configured to serve the frontend static files.
- **Solution**: Updated `backend/src/index.ts` to serve frontend dist files and handle SPA routing.

### 5. **Environment Configuration**
- **Problem**: Frontend API/Socket URLs were hardcoded for localhost.
- **Solution**: 
  - Created `.env.production` for production environment variables
  - Updated socket connection to use relative URLs in production

## Files Modified/Created

### Created:
1. `/package.json` - Root package file for monorepo build
2. `/web.config` - Azure App Service IIS configuration
3. `/startup.sh` - Azure startup script
4. `/.deployment` - Azure deployment configuration
5. `/frontend/.env.production` - Production environment variables

### Modified:
1. `/.github/workflows/main_bungrfsstation.yml` - Fixed build and deployment process
2. `/backend/src/index.ts` - Added static file serving and SPA routing
3. `/frontend/src/hooks/useSocket.ts` - Dynamic socket URL based on environment

## Deployment Process

When you push to the `main` branch:

1. **Build Job**:
   - Installs dependencies for both frontend and backend
   - Builds TypeScript backend → `backend/dist/`
   - Builds React frontend → `frontend/dist/`
   - Creates optimized zip artifact (excludes source files and node_modules)

2. **Deploy Job**:
   - Downloads and extracts the build artifact
   - Deploys to Azure App Service
   - Azure runs the start command: `npm start` (which runs `node backend/dist/index.js`)

3. **Runtime**:
   - Backend serves API routes at `/api/*`
   - Backend serves frontend static files
   - All other routes serve `index.html` (SPA routing)

## Azure App Service Configuration

### Required Settings in Azure Portal:

1. **General Settings**:
   - Stack: Node.js
   - Node version: 22.x (or 18+)
   - Startup Command: `npm start` (or leave empty, uses package.json start script)

2. **Application Settings** (if needed):
   - `PORT`: Auto-set by Azure (typically 8080 or 80)
   - `NODE_ENV`: production
   - `MONGODB_URI`: (if using MongoDB)
   - `FRONTEND_URL`: Can be empty (uses same domain)

3. **WebSocket Support**:
   - Ensure WebSockets are enabled in Configuration → General settings

## Testing the Deployment

After deployment completes (5-10 minutes):

1. Visit: `https://bungrfsstation.azurewebsites.net/`
2. Should see the frontend landing page
3. Check health: `https://bungrfsstation.azurewebsites.net/health`

## Troubleshooting

### If still seeing holding page:
1. Check GitHub Actions logs for build errors
2. Go to Azure Portal → Your App Service → Deployment Center → Logs
3. Check application logs: Azure Portal → Monitoring → Log stream

### Common Issues:
- **Build fails**: Check if all dependencies are in package.json files
- **404 errors**: Verify web.config is deployed
- **Socket connection fails**: Enable WebSockets in Azure App Service settings
- **API calls fail**: Check browser console for CORS errors

## Local Development

The changes are backward compatible with local development:

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

## Next Steps

1. Commit and push all changes to trigger deployment
2. Monitor GitHub Actions workflow
3. Once deployed, test the application
4. Configure custom domain (optional)
5. Set up monitoring and alerts (recommended)
