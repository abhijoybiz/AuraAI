# Backend Setup

## Requirements
- Python 3.12+
- MongoDB running locally (or Docker)

## Install
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

## Configure
Create `backend/.env`:
MONGODB_URL=mongodb://localhost:27017
OPENROUTER_API_KEY=your_key_here

## Run
uvicorn main:app --port 8001

## API Endpoints
- POST /whiteboard/generate-mindmap - Generate mind map from text
- POST /whiteboard/init - Initialize whiteboard for a lecture
- POST /whiteboard/save - Save whiteboard edits
- GET /whiteboard/get/{id} - Get whiteboard data