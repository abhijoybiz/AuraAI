from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import get_settings
from store.mongodb import mongodb_store
from routers.whiteboard import router as whiteboard_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup/shutdown."""
    # Startup
    print("Connecting to MongoDB...")
    await mongodb_store.connect()
    print("MongoDB connected!")
    
    yield
    
    # Shutdown
    print("Disconnecting from MongoDB...")
    await mongodb_store.disconnect()
    print("MongoDB disconnected!")


app = FastAPI(
    title="Memry Whiteboard API",
    description="Backend service for AI-powered whiteboard generation",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for mobile app access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(whiteboard_router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "memry-whiteboard"}


@app.get("/health")
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "mongodb": "connected",
        "version": "1.0.0",
    }


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )

