from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

from models.schemas import (
    WhiteboardInitRequest,
    WhiteboardInitResponse,
    WhiteboardSaveRequest,
    WhiteboardSaveResponse,
    WhiteboardGetResponse,
    ConceptGraph,
)
from store.mongodb import MongoDBStore, get_store
from services.whiteboard_graph import WhiteboardGraphService, get_whiteboard_service


router = APIRouter(prefix="/whiteboard", tags=["whiteboard"])


# ============================================
# MIND MAP GENERATION ENDPOINT
# ============================================

class MindMapRequest(BaseModel):
    """Request to generate a mind map from user text."""
    text: str  # User's input text
    session_id: Optional[str] = None  # Optional session ID for persistence


class MindMapResponse(BaseModel):
    """Response containing generated mind map."""
    tldraw_snapshot: dict
    concept_graph: ConceptGraph
    session_id: str


@router.post("/generate-mindmap", response_model=MindMapResponse)
async def generate_mindmap(
    request: MindMapRequest,
    service: WhiteboardGraphService = Depends(get_whiteboard_service),
    store: MongoDBStore = Depends(get_store),
):
    """
    Generate a mind map from user input text.
    
    Flow:
    1. User inputs text (notes, topic, ideas, etc.)
    2. AI extracts concepts and creates a central topic with branches
    3. Returns tldraw snapshot ready to display on canvas
    
    This is the main endpoint for: User writes something → AI creates mind map
    """
    try:
        # Generate session ID if not provided
        session_id = request.session_id or f"mindmap_{datetime.utcnow().timestamp()}"
        
        # Run the AI pipeline to generate mind map
        result = await service.run_pipeline(
            lecture_id=session_id,
            text=request.text,
        )
        
        # Optionally persist for later retrieval
        if request.session_id:
            await store.put(
                user_id="default",
                lecture_id=session_id,
                tldraw_snapshot=result["tldraw_snapshot"],
                concept_graph=result["concept_graph"],
            )
        
        return MindMapResponse(
            tldraw_snapshot=result["tldraw_snapshot"],
            concept_graph=ConceptGraph(**result["concept_graph"]),
            session_id=session_id,
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/init", response_model=WhiteboardInitResponse)
async def init_whiteboard(
    request: WhiteboardInitRequest,
    store: MongoDBStore = Depends(get_store),
    service: WhiteboardGraphService = Depends(get_whiteboard_service),
):
    """
    Initialize a whiteboard from transcript/summary text.
    
    This endpoint:
    1. Extracts concepts from the text using LLM
    2. Builds an initial tldraw snapshot with shapes and arrows
    3. Persists the result to MongoDB
    4. Returns the snapshot and concept graph
    """
    try:
        # Check if whiteboard already exists
        existing = await store.get(request.user_id, request.lecture_id)
        if existing:
            return WhiteboardInitResponse(
                lecture_id=request.lecture_id,
                tldraw_snapshot=existing["tldraw_snapshot"],
                concept_graph=ConceptGraph(**existing["concept_graph"]) if existing.get("concept_graph") else ConceptGraph(),
                created_at=datetime.fromisoformat(existing.get("updated_at", datetime.utcnow().isoformat())),
            )
        
        # Run the LangGraph pipeline
        result = await service.run_pipeline(
            lecture_id=request.lecture_id,
            text=request.text,
        )
        
        # Persist to store
        await store.put(
            user_id=request.user_id,
            lecture_id=request.lecture_id,
            tldraw_snapshot=result["tldraw_snapshot"],
            concept_graph=result["concept_graph"],
        )
        
        return WhiteboardInitResponse(
            lecture_id=request.lecture_id,
            tldraw_snapshot=result["tldraw_snapshot"],
            concept_graph=ConceptGraph(**result["concept_graph"]),
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save", response_model=WhiteboardSaveResponse)
async def save_whiteboard(
    request: WhiteboardSaveRequest,
    store: MongoDBStore = Depends(get_store),
):
    """
    Save whiteboard edits.
    
    This endpoint persists user edits to the whiteboard snapshot.
    The concept graph is preserved from the initial generation.
    """
    try:
        # Get existing data to preserve concept graph
        existing = await store.get(request.user_id, request.lecture_id)
        concept_graph = existing.get("concept_graph") if existing else None
        
        # Save updated snapshot
        await store.put(
            user_id=request.user_id,
            lecture_id=request.lecture_id,
            tldraw_snapshot=request.tldraw_snapshot,
            concept_graph=concept_graph,
        )
        
        return WhiteboardSaveResponse(
            lecture_id=request.lecture_id,
            saved_at=datetime.utcnow(),
            success=True,
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/get/{lecture_id}", response_model=WhiteboardGetResponse)
async def get_whiteboard(
    lecture_id: str,
    user_id: str = "default",
    store: MongoDBStore = Depends(get_store),
):
    """
    Retrieve whiteboard data for a lecture.
    """
    try:
        data = await store.get(user_id, lecture_id)
        
        if not data:
            return WhiteboardGetResponse(
                lecture_id=lecture_id,
                exists=False,
            )
        
        return WhiteboardGetResponse(
            lecture_id=lecture_id,
            tldraw_snapshot=data.get("tldraw_snapshot"),
            concept_graph=ConceptGraph(**data["concept_graph"]) if data.get("concept_graph") else None,
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None,
            exists=True,
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

