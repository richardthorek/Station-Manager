# Quick Start: Azure Static Web App Deployment

**Status**: Configuration complete, ready for deployment  
**Estimated Time**: 15-20 minutes  
**Cost**: ~$13-20 AUD/month (Static Web App is FREE)

---

## What Has Been Done

✅ **Architecture Designed**: Hybrid approach (Static Web App + App Service)  
✅ **Configuration Files Created**: All necessary config files in place  
✅ **Code Updated**: Backend CORS configured for Static Web Apps  
✅ **Documentation Written**: Comprehensive guides created  
✅ **Local Testing**: Verified everything works locally  

---

## What You Need to Do

### Step 1: Review the Master Plan (5 min)

Read the **[MASTER_PLAN.md](MASTER_PLAN.md)** file at the root of the project to understand:
- Why we chose this architecture
- What the WebSocket constraint means
- How the system will work in production

**Key Point**: Azure Functions don't support WebSockets, so we're keeping your backend on App Service where Socket.io works perfectly.

### Step 2: Create Azure Static Web App (10 min)

Follow the detailed guide: **[docs/STATIC_WEB_APP_SETUP.md](docs/STATIC_WEB_APP_SETUP.md)**

**Quick steps**:
1. Sign in to Azure Portal: https://portal.azure.com
2. Create a resource → Search "Static Web Apps"
3. Configure:
   - **Source**: GitHub
   - **Repository**: `richardthorek/Station-Manager`
   - **Branch**: `main` (or your branch)
   - **App location**: `/frontend`
   - **Api location**: (leave empty)
   - **Output location**: `dist`

Azure will automatically create a GitHub Actions workflow.

### Step 3: Configure Environment Variables (5 min)

**In Azure Static Web App**:
1. Go to your Static Web App → Configuration → Application settings
2. Add these variables:
   ```
   VITE_API_URL=https://bungrfsstation.azurewebsites.net/api
   VITE_SOCKET_URL=https://bungrfsstation.azurewebsites.net
   ```

**In Azure App Service (bungrfsstation)**:
1. Go to your App Service → Configuration → Application settings
2. Update `FRONTEND_URL`:
   ```
   FRONTEND_URL=https://<your-static-web-app-name>.azurestaticapps.net
   ```
3. Verify these are still set:
   - `PORT=8080`
   - `NODE_ENV=production`
   - `MONGODB_URI=<your-cosmos-db-connection-string>`

**In App Service → Configuration → General settings**:
1. Verify:
   - **Web sockets**: ON ✅
   - **Always On**: ON ✅

### Step 4: Deploy and Test (5-10 min)

**Deployment happens automatically** via GitHub Actions when you push to your branch.

After deployment:
1. Visit your Static Web App URL
2. Navigate to `/signin`
3. Test member check-in
4. Open a second browser/device
5. Verify check-in appears on both devices instantly
6. Check browser console for any errors

---

## Verification Checklist

After deployment, verify:

- [ ] Frontend loads from Static Web App URL
- [ ] All routes work (/, /signin, /profile/:id, /truckcheck)
- [ ] No 404 errors for routes
- [ ] API calls reach backend (check Network tab)
- [ ] WebSocket connection establishes (check console)
- [ ] Connection status shows "Connected"
- [ ] Member check-in appears on all devices within 2 seconds
- [ ] Activity changes propagate instantly
- [ ] No CORS errors in console
- [ ] SSL/TLS working (HTTPS/WSS)

---

## Troubleshooting

### If you see CORS errors:

1. Check `FRONTEND_URL` is set correctly in App Service
2. Verify Static Web App URL in environment variable
3. Restart App Service after changes
4. Clear browser cache

### If WebSocket doesn't connect:

1. Verify Web Sockets are ON in App Service settings
2. Check Always On is enabled
3. Verify `VITE_SOCKET_URL` uses HTTPS (not HTTP)
4. Check browser console for connection errors

### If environment variables don't work:

1. They're build-time variables - need redeployment
2. Trigger new deployment: `git commit --allow-empty -m "Rebuild" && git push`
3. Wait for GitHub Actions to complete
4. Clear browser cache

**Full troubleshooting guide**: See section in [STATIC_WEB_APP_SETUP.md](docs/STATIC_WEB_APP_SETUP.md)

---

## Important Files

- **[MASTER_PLAN.md](MASTER_PLAN.md)** - Complete refactoring strategy
- **[docs/STATIC_WEB_APP_SETUP.md](docs/STATIC_WEB_APP_SETUP.md)** - Detailed setup guide
- **[LOCAL_TESTING_RESULTS.md](LOCAL_TESTING_RESULTS.md)** - Local testing verification
- **frontend/public/staticwebapp.config.json** - Static Web App configuration
- **swa-cli.config.json** - Local testing configuration

---

## Architecture Summary

```
Frontend (Azure Static Web Apps - FREE)
         ↓
         HTTPS + WSS (WebSocket Secure)
         ↓
Backend (Azure App Service - bungrfsstation - ~$13/month)
         ↓
Database (Azure Cosmos DB - MongoDB API)
```

**Why this works**:
- ✅ Static Web Apps hosts your React frontend for free
- ✅ App Service keeps your Express + Socket.io backend working
- ✅ WebSocket real-time sync continues to work perfectly
- ✅ No code changes to your application logic
- ✅ Best of both worlds: free frontend hosting + real-time backend

---

## Cost Breakdown

- **Azure Static Web Apps**: $0/month (Free tier)
  - 100GB bandwidth/month
  - Free SSL
  - Global CDN

- **Azure App Service B1**: ~$13 AUD/month
  - Already deployed (bungrfsstation)
  - WebSocket support
  - Always On

- **Azure Cosmos DB**: $0-7 AUD/month
  - Free tier available (1000 RU/s, 25GB)
  - Or consumption-based

**Total**: **~$13-20 AUD/month**

---

## Next Steps After Deployment

1. **Monitor usage** in Azure Portal
2. **Test thoroughly** with real users
3. **Update documentation** if needed
4. **Consider Application Insights** for monitoring (optional)

---

## Truck Checks Feature

The truck checks feature will work with the same architecture. No changes needed. It uses the same real-time sync via Socket.io.

---

## Support

If you encounter issues:

1. Check [STATIC_WEB_APP_SETUP.md](docs/STATIC_WEB_APP_SETUP.md) troubleshooting section
2. Review [LOCAL_TESTING_RESULTS.md](LOCAL_TESTING_RESULTS.md) for expected behavior
3. Check GitHub Actions workflow logs
4. Review Azure App Service logs
5. Check browser console for errors

---

## Summary

🎉 **Your application is ready for Azure Static Web Apps deployment!**

Everything has been configured to work with the hybrid architecture. The sign-in book functionality, including real-time synchronization, will work exactly as it does now.

Just follow the steps above to deploy, and you'll have:
- Free static frontend hosting
- Global CDN for fast loading
- Existing backend with full WebSocket support
- Real-time sign-in synchronization working perfectly

**Next action**: Create your Azure Static Web App following Step 2 above! 🚀
