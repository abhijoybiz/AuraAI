"""
LangGraph pipeline for whiteboard generation.

This service:
1. Extracts concepts from transcript/summary using LLM
2. Builds an initial tldraw snapshot with shapes and arrows
3. Returns the result for persistence
"""

import json
import uuid
import httpx
from typing import TypedDict, Optional, List
from functools import lru_cache

from config import get_settings


class ConceptNode(TypedDict):
    id: str
    label: str
    description: Optional[str]


class ConceptEdge(TypedDict):
    source: str
    target: str
    label: Optional[str]


class WhiteboardState(TypedDict):
    """State schema for the whiteboard pipeline."""
    lecture_id: str
    input_text: str
    concept_graph: Optional[dict]
    tldraw_snapshot: Optional[dict]


class WhiteboardGraphService:
    """Service for generating whiteboard content from text using LangGraph-style pipeline."""
    
    def __init__(self):
        self.settings = get_settings()
        
    async def run_pipeline(self, lecture_id: str, text: str) -> dict:
        """
        Run the full whiteboard generation pipeline.
        
        Args:
            lecture_id: Unique identifier for the lecture
            text: Transcript or summary text to extract concepts from
            
        Returns:
            Dictionary with tldraw_snapshot and concept_graph
        """
        # Initialize state
        state: WhiteboardState = {
            "lecture_id": lecture_id,
            "input_text": text,
            "concept_graph": None,
            "tldraw_snapshot": None,
        }
        
        # Run pipeline nodes sequentially
        state = await self._extract_concepts_node(state)
        state = await self._build_initial_board_node(state)
        
        return {
            "tldraw_snapshot": state["tldraw_snapshot"],
            "concept_graph": state["concept_graph"],
        }
    
    async def _extract_concepts_node(self, state: WhiteboardState) -> WhiteboardState:
        """
        Extract concepts and relationships from text using LLM.
        
        Uses OpenRouter API to analyze the text and identify:
        - A central/main topic (first node)
        - Key concepts branching from it
        - Relationships between concepts
        """
        prompt = f"""You are a mind map generator. Create a mind map from this text.

Return EXACTLY this JSON format with 5-8 nodes total:

{{
    "nodes": [
        {{"id": "central", "label": "MAIN TOPIC", "description": ""}},
        {{"id": "b1", "label": "Concept 1", "description": ""}},
        {{"id": "b2", "label": "Concept 2", "description": ""}},
        {{"id": "b3", "label": "Concept 3", "description": ""}},
        {{"id": "b4", "label": "Concept 4", "description": ""}}
    ],
    "edges": [
        {{"source": "central", "target": "b1", "label": ""}},
        {{"source": "central", "target": "b2", "label": ""}},
        {{"source": "central", "target": "b3", "label": ""}},
        {{"source": "central", "target": "b4", "label": ""}}
    ]
}}

RULES:
- First node id MUST be "central" with the main topic
- Branch node ids: b1, b2, b3, b4, b5, etc.
- Labels: 2-4 words MAX
- Include 4-7 branch nodes
- Every edge must connect "central" to a branch

TEXT:
{state["input_text"][:2000]}

JSON:"""

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.settings.openrouter_base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.settings.openrouter_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.settings.openrouter_model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3,
                    },
                    timeout=60.0,
                )
                
                data = response.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                
                # Parse JSON from response
                concept_graph = self._parse_json_response(content)
                state["concept_graph"] = concept_graph
                
        except Exception as e:
            print(f"Error extracting concepts: {e}")
            # Fallback to a simple concept graph
            state["concept_graph"] = self._generate_fallback_graph(state["input_text"])
            
        return state
    
    def _parse_json_response(self, content: str) -> dict:
        """Parse JSON from LLM response, handling markdown code blocks."""
        # Remove markdown code blocks if present
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        try:
            # Find JSON object
            start = content.find("{")
            end = content.rfind("}") + 1
            if start != -1 and end > start:
                json_str = content[start:end]
                result = json.loads(json_str)
                
                # Ensure we have nodes and edges
                nodes = result.get("nodes", [])
                edges = result.get("edges", [])
                
                # Auto-create missing nodes referenced in edges
                node_ids = {n["id"] for n in nodes}
                for edge in edges:
                    for key in ["source", "target"]:
                        if edge.get(key) and edge[key] not in node_ids:
                            # Create missing node
                            nodes.append({
                                "id": edge[key],
                                "label": edge[key].replace("_", " ").title(),
                                "description": ""
                            })
                            node_ids.add(edge[key])
                
                return {"nodes": nodes, "edges": edges}
        except json.JSONDecodeError as e:
            print(f"JSON parse error: {e}")
            print(f"Content: {content[:500]}")
            
        return {"nodes": [], "edges": []}
    
    def _generate_fallback_graph(self, text: str) -> dict:
        """Generate a simple fallback mind map from text."""
        # Extract simple keywords as fallback
        words = text.split()[:100]
        important_words = [w for w in words if len(w) > 4 and w.isalpha()][:6]
        
        # First node is central topic
        nodes = [{"id": "central", "label": "Main Topic", "description": ""}]
        edges = []
        
        # Add branch nodes
        for i, word in enumerate(important_words):
            node_id = f"branch_{i}"
            nodes.append({
                "id": node_id,
                "label": word.capitalize(),
                "description": ""
            })
            edges.append({
                "source": "central",
                "target": node_id,
                "label": ""
            })
        
        return {"nodes": nodes, "edges": edges}
    
    def _create_empty_snapshot(self) -> dict:
        """Create an empty tldraw snapshot."""
        return {
            "store": {
                "document:document": {
                    "id": "document:document",
                    "gridSize": 10,
                    "name": "",
                    "meta": {},
                    "typeName": "document",
                },
                "page:page": {
                    "id": "page:page",
                    "name": "Page 1",
                    "index": "a1",
                    "meta": {},
                    "typeName": "page",
                },
            },
            "schema": {
                "schemaVersion": 1,
                "storeVersion": 4,
                "recordVersions": {
                    "asset": {"version": 1, "subTypeKey": "type", "subTypeVersions": {}},
                    "camera": {"version": 1},
                    "document": {"version": 2},
                    "instance": {"version": 22},
                    "instance_page_state": {"version": 5},
                    "page": {"version": 1},
                    "shape": {"version": 3, "subTypeKey": "type", "subTypeVersions": {}},
                    "instance_presence": {"version": 5},
                    "pointer": {"version": 1},
                },
            },
        }
    
    async def _build_initial_board_node(self, state: WhiteboardState) -> WhiteboardState:
        """
        Convert concept graph into a tldraw snapshot with RADIAL MIND MAP layout.
        
        Creates:
        - Central node (ellipse) for the main topic
        - Branch nodes (rectangles) radiating outward
        - Arrows connecting central node to branches
        """
        import math
        
        concept_graph = state.get("concept_graph", {"nodes": [], "edges": []})
        nodes = concept_graph.get("nodes", [])
        edges = concept_graph.get("edges", [])
        
        shapes = {}
        node_positions = {}
        
        if not nodes:
            state["tldraw_snapshot"] = self._create_empty_snapshot()
            return state
        
        # Layout parameters for radial mind map
        center_x = 600
        center_y = 400
        radius = 300  # Distance from center to branch nodes
        
        # Colors for visual hierarchy
        colors = ["light-blue", "light-green", "yellow", "light-red", "orange", "violet"]
        
        # CENTRAL NODE - First node or create "Main Topic"
        central_node = nodes[0] if nodes else {"id": "central", "label": "Main Topic"}
        central_id = f"shape:{central_node['id']}"
        
        # Central node is larger and uses ellipse
        shapes[central_id] = {
            "id": central_id,
            "type": "geo",
            "x": center_x - 100,
            "y": center_y - 50,
            "rotation": 0,
            "isLocked": False,
            "opacity": 1,
            "props": {
                "w": 200,
                "h": 100,
                "geo": "ellipse",
                "color": "blue",
                "labelColor": "black",
                "fill": "solid",
                "dash": "draw",
                "size": "l",
                "font": "sans",
                "text": central_node.get("label", "Main Topic"),
                "align": "middle",
                "verticalAlign": "middle",
                "growY": 0,
                "url": "",
            },
            "parentId": "page:page",
            "index": "a0",
            "typeName": "shape",
        }
        node_positions[central_node["id"]] = {"x": center_x, "y": center_y}
        
        # BRANCH NODES - Arrange in a circle around center
        branch_nodes = nodes[1:] if len(nodes) > 1 else []
        num_branches = len(branch_nodes)
        
        for i, node in enumerate(branch_nodes):
            # Calculate position on circle
            angle = (2 * math.pi * i) / max(num_branches, 1) - math.pi / 2  # Start from top
            x = center_x + radius * math.cos(angle) - 90  # Offset for shape width
            y = center_y + radius * math.sin(angle) - 35  # Offset for shape height
            
            shape_id = f"shape:{node['id']}"
            node_positions[node["id"]] = {
                "x": center_x + radius * math.cos(angle),
                "y": center_y + radius * math.sin(angle)
            }
            
            # Alternate colors for visual variety
            color = colors[i % len(colors)]
            
            shapes[shape_id] = {
                "id": shape_id,
                "type": "geo",
                "x": x,
                "y": y,
                "rotation": 0,
                "isLocked": False,
                "opacity": 1,
                "props": {
                    "w": 180,
                    "h": 70,
                    "geo": "rectangle",
                    "color": color,
                    "labelColor": "black",
                    "fill": "solid",
                    "dash": "draw",
                    "size": "m",
                    "font": "sans",
                    "text": node.get("label", ""),
                    "align": "middle",
                    "verticalAlign": "middle",
                    "growY": 0,
                    "url": "",
                },
                "parentId": "page:page",
                "index": f"a{i + 1}",
                "typeName": "shape",
            }
            
            # Create arrow from central node to this branch
            arrow_id = f"shape:arrow_{i}"
            shapes[arrow_id] = {
                "id": arrow_id,
                "type": "arrow",
                "x": center_x,
                "y": center_y,
                "rotation": 0,
                "isLocked": False,
                "opacity": 1,
                "props": {
                    "dash": "draw",
                    "size": "m",
                    "fill": "none",
                    "color": "grey",
                    "labelColor": "black",
                    "bend": 0,
                    "start": {
                        "type": "binding",
                        "boundShapeId": central_id,
                        "normalizedAnchor": {"x": 0.5, "y": 0.5},
                        "isExact": False,
                        "isPrecise": False,
                    },
                    "end": {
                        "type": "binding",
                        "boundShapeId": shape_id,
                        "normalizedAnchor": {"x": 0.5, "y": 0.5},
                        "isExact": False,
                        "isPrecise": False,
                    },
                    "arrowheadStart": "none",
                    "arrowheadEnd": "arrow",
                    "text": "",
                    "font": "draw",
                },
                "parentId": "page:page",
                "index": f"b{i}",
                "typeName": "shape",
            }
        
        # Add any additional edges from the concept graph (for sub-relationships)
        arrow_offset = len(branch_nodes)
        for i, edge in enumerate(edges):
            source_pos = node_positions.get(edge["source"])
            target_pos = node_positions.get(edge["target"])
            
            if not source_pos or not target_pos:
                continue
            
            # Skip if this edge is already covered by central->branch arrows
            if edge["source"] == central_node["id"]:
                continue
                
            arrow_id = f"shape:arrow_{arrow_offset + i}"
            shapes[arrow_id] = {
                "id": arrow_id,
                "type": "arrow",
                "x": source_pos["x"],
                "y": source_pos["y"],
                "rotation": 0,
                "isLocked": False,
                "opacity": 1,
                "props": {
                    "dash": "dashed",
                    "size": "s",
                    "fill": "none",
                    "color": "grey",
                    "labelColor": "black",
                    "bend": 20,
                    "start": {
                        "type": "binding",
                        "boundShapeId": f"shape:{edge['source']}",
                        "normalizedAnchor": {"x": 0.5, "y": 0.5},
                        "isExact": False,
                        "isPrecise": False,
                    },
                    "end": {
                        "type": "binding",
                        "boundShapeId": f"shape:{edge['target']}",
                        "normalizedAnchor": {"x": 0.5, "y": 0.5},
                        "isExact": False,
                        "isPrecise": False,
                    },
                    "arrowheadStart": "none",
                    "arrowheadEnd": "arrow",
                    "text": edge.get("label", ""),
                    "font": "draw",
                },
                "parentId": "page:page",
                "index": f"c{i}",
                "typeName": "shape",
            }
        
        # Build tldraw snapshot structure
        snapshot = {
            "store": {
                "document:document": {
                    "id": "document:document",
                    "gridSize": 10,
                    "name": "",
                    "meta": {},
                    "typeName": "document",
                },
                "page:page": {
                    "id": "page:page",
                    "name": "Page 1",
                    "index": "a1",
                    "meta": {},
                    "typeName": "page",
                },
                **shapes,
            },
            "schema": {
                "schemaVersion": 1,
                "storeVersion": 4,
                "recordVersions": {
                    "asset": {"version": 1, "subTypeKey": "type", "subTypeVersions": {}},
                    "camera": {"version": 1},
                    "document": {"version": 2},
                    "instance": {"version": 22},
                    "instance_page_state": {"version": 5},
                    "page": {"version": 1},
                    "shape": {"version": 3, "subTypeKey": "type", "subTypeVersions": {}},
                    "instance_presence": {"version": 5},
                    "pointer": {"version": 1},
                },
            },
        }
        
        state["tldraw_snapshot"] = snapshot
        return state


# Singleton instance
_whiteboard_service: Optional[WhiteboardGraphService] = None


@lru_cache()
def get_whiteboard_service() -> WhiteboardGraphService:
    """Get the whiteboard service instance."""
    global _whiteboard_service
    if _whiteboard_service is None:
        _whiteboard_service = WhiteboardGraphService()
    return _whiteboard_service

