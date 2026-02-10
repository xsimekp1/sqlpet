"""
Entry point for Railway deployment.
Railway's Railpack looks for main.py in the root directory.
"""

from src.app.main import app

if __name__ == "__main__":
    import uvicorn
    import os

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
