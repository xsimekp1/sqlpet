# Vercel Deployment Setup for PawShelter Web

## Project Configuration

### Framework Preset
- **Framework**: Next.js
- **Root Directory**: `apps/web`
- **Build Command**: `npm run build` (default)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (default)

### Environment Variables

Configure these environment variables in Vercel project settings:

#### Production
```
NEXT_PUBLIC_API_URL=https://joyful-elegance.up.railway.app
```

#### Preview/Development
```
NEXT_PUBLIC_API_URL=https://joyful-elegance.up.railway.app
```

Or use a separate preview/development backend if available.

## Backend Configuration (Railway)

The backend API is hosted on Railway:
- **Project**: joyful-elegance
- **Project ID**: 37de0081-ad49-4098-a7a1-e29a99745edb
- **API URL**: https://joyful-elegance.up.railway.app

Make sure the backend is deployed and accessible before deploying the frontend.

### CORS Configuration

The backend must allow requests from the Vercel domain. Update CORS settings in the FastAPI backend to include:
```python
# apps/api/src/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://your-vercel-domain.vercel.app",  # Add your Vercel domain
        "https://*.vercel.app",  # Allow all preview deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Deployment Steps

1. **Connect GitHub Repository**
   - Go to Vercel dashboard
   - Click "Add New Project"
   - Import the `sqlpet` repository
   - Select "Other" for framework (we'll configure it manually)

2. **Configure Build Settings**
   - Root Directory: `apps/web`
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`

3. **Set Environment Variables**
   - Add `NEXT_PUBLIC_API_URL` with the Railway backend URL
   - Apply to: Production, Preview, Development

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Vercel will generate a URL like `https://sqlpet-web.vercel.app`

5. **Update Backend CORS**
   - Add the Vercel URL to the backend CORS allowed origins
   - Redeploy the backend on Railway

## Testing Deployment

After deployment:
1. Visit the Vercel URL
2. Navigate to `/cs/login` (should redirect automatically)
3. Test login with credentials from the backend seed data
4. Verify organization selection works
5. Check that dashboard displays correctly
6. Test language switching (cs/en)

## Troubleshooting

### "Failed to fetch" or CORS errors
- Check that the backend is running on Railway
- Verify the API URL is correct in Vercel environment variables
- Ensure CORS is configured correctly in the backend

### "Invalid credentials" on login
- Verify the backend API is accessible
- Check that the backend has seed data
- Test the backend directly with curl or Postman

### Page not found (404)
- Ensure the build completed successfully
- Check that the output directory is `.next`
- Verify the root directory is `apps/web`

### Environment variables not working
- Rebuild the project after changing environment variables
- Ensure the variable name starts with `NEXT_PUBLIC_`
- Check that the variable is set for the correct environment (Production/Preview/Development)

## Continuous Deployment

Once configured, Vercel will automatically deploy:
- **Production**: Commits to `main` branch
- **Preview**: Pull requests and commits to other branches

To disable automatic deployments, go to:
Settings → Git → Deploy Hooks → Configure
