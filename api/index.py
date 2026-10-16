import os
import sys

# Ensure repository root is on sys.path for importing backend package
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

from backend.app.main import app

# Vercel Serverless Function entry point
# Exports the FastAPI ASGI application
