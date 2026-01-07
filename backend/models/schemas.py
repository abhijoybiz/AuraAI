from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class ConceptNode(BaseModel):
    """A concept extracted from the transcript."""
    id: str
    label: str
    description: Optional[str] = None


class ConceptEdge(BaseModel):
    """A relationship between two concepts."""
    source: str
    target: str
    label: Optional[str] = None


class ConceptGraph(BaseModel):
    """Graph of concepts and their relationships."""
    nodes: List[ConceptNode] = Field(default_factory=list)
    edges: List[ConceptEdge] = Field(default_factory=list)


class TldrawShape(BaseModel):
    """A shape in the tldraw canvas."""
    id: str
    type: str
    x: float
    y: float
    props: dict = Field(default_factory=dict)


class WhiteboardInitRequest(BaseModel):
    """Request to initialize a whiteboard from transcript."""
    lecture_id: str
    text: str  # transcript or summary
    user_id: Optional[str] = "default"


class WhiteboardInitResponse(BaseModel):
    """Response containing generated whiteboard data."""
    lecture_id: str
    tldraw_snapshot: dict
    concept_graph: ConceptGraph
    created_at: datetime = Field(default_factory=datetime.utcnow)


class WhiteboardSaveRequest(BaseModel):
    """Request to save whiteboard edits."""
    lecture_id: str
    tldraw_snapshot: dict
    user_id: Optional[str] = "default"


class WhiteboardSaveResponse(BaseModel):
    """Response after saving whiteboard."""
    lecture_id: str
    saved_at: datetime = Field(default_factory=datetime.utcnow)
    success: bool = True


class WhiteboardGetResponse(BaseModel):
    """Response containing whiteboard data."""
    lecture_id: str
    tldraw_snapshot: Optional[dict] = None
    concept_graph: Optional[ConceptGraph] = None
    updated_at: Optional[datetime] = None
    exists: bool = True

