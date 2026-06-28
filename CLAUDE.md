# Project Architecture

## Stack

**Frontend**: React + Vite (JavaScript or TypeScript)
**Backend**: FastAPI + uvicorn (Python)
**Deploy**: Single Docker service on Render (or Railway)
**Math/Data**: SymPy for symbolic math, NumPy for numerics, KaTeX for rendering

## Key Decisions

### Single-service Docker deploy
The Dockerfile uses a multi-stage build:
1. Node stage builds the React app (`npm run build`)
2. Python stage runs FastAPI and serves both the API and the built React SPA as static files

This means one URL, no CORS issues, no separate frontend hosting.

### API calls (same-origin in production)
`frontend/src/api.js` exports a base URL:
```js
const API = import.meta.env.VITE_API_URL ?? ''
export default API
```
- **Production (Docker)**: `VITE_API_URL` is not set → defaults to `''` → all API calls go to `/analyze`, `/evaluate`, etc. on the same host
- **Local dev**: Vite proxies those paths to `http://localhost:8001` (configured in `vite.config.js`)

Never hardcode `localhost` in API calls. Never use `VITE_API_URL` in production.

### Vite dev proxy
`vite.config.js` proxies every backend route to the local uvicorn server so dev feels identical to prod:
```js
proxy: {
  '/my-endpoint': { target: 'http://localhost:8001', changeOrigin: true },
}
```
Add a new entry here whenever you add a new backend route.

### FastAPI serves the SPA
At the bottom of `backend/main.py`, after all API routes:
```python
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "frontend_dist")

if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        file = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file):
            return FileResponse(file)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
```
The `frontend_dist/` directory is populated by the Docker build, so locally this block is skipped and Vite handles the frontend.

### CORS
In production (same-origin), CORS is irrelevant. For local dev, allow all:
```python
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
```

## Directory Structure

```
project/
├── Dockerfile          # multi-stage: node build → python serve
├── render.yaml         # runtime: docker
├── frontend/
│   ├── src/
│   │   └── api.js      # base URL — '' in prod, proxied in dev
│   └── vite.config.js  # dev server + proxy config
└── backend/
    ├── main.py         # FastAPI app + static file catch-all at bottom
    └── requirements.txt
```

## Render Setup

One service, Docker runtime:
- **Dockerfile Path**: `./Dockerfile`
- **Docker Build Context**: `.`
- No environment variables needed for the frontend URL

## Local Dev

```bash
# Terminal 1 — backend
cd backend && source venv/bin/activate
uvicorn main:app --port 8001 --reload

# Terminal 2 — frontend
cd frontend && npm run dev
# App at http://localhost:5174 — API calls proxied to :8001
```
