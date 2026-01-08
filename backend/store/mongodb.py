from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
from datetime import datetime

from config import get_settings


class MongoDBStore:
    """MongoDB store for whiteboard data using LangGraph-style namespacing."""
    
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db = None
        self.connected = False
        
    async def connect(self):
        """Connect to MongoDB with timeout and error handling."""
        settings = get_settings()
        try:
            self.client = AsyncIOMotorClient(
                settings.mongodb_url,
                serverSelectionTimeoutMS=5000,  # 5 second timeout
            )
            self.db = self.client[settings.mongodb_database]
            
            # Test connection
            await self.client.admin.command('ping')
            
            # Create indexes
            await self.db.whiteboards.create_index(
                [("namespace", 1), ("key", 1)],
                unique=True
            )
            self.connected = True
            print("✅ MongoDB connected successfully")
        except Exception as e:
            print(f"⚠️ MongoDB connection failed: {e}")
            print("   Backend will run in offline mode (no persistence)")
            self.connected = False
        
    async def disconnect(self):
        """Disconnect from MongoDB."""
        if self.client:
            self.client.close()
            
    def _make_namespace(self, user_id: str) -> str:
        """Create namespace string: memry/{userId}/whiteboards"""
        return f"memry/{user_id}/whiteboards"
    
    async def get(self, user_id: str, lecture_id: str) -> Optional[dict]:
        """Get whiteboard data by lecture ID."""
        if not self.connected:
            return None
        namespace = self._make_namespace(user_id)
        doc = await self.db.whiteboards.find_one({
            "namespace": namespace,
            "key": lecture_id
        })
        return doc.get("value") if doc else None
    
    async def put(
        self,
        user_id: str,
        lecture_id: str,
        tldraw_snapshot: dict,
        concept_graph: Optional[dict] = None
    ) -> dict:
        """Save or update whiteboard data."""
        namespace = self._make_namespace(user_id)
        now = datetime.utcnow()
        
        value = {
            "tldraw_snapshot": tldraw_snapshot,
            "concept_graph": concept_graph,
            "updated_at": now.isoformat(),
        }
        
        if self.connected:
            await self.db.whiteboards.update_one(
                {"namespace": namespace, "key": lecture_id},
                {
                    "$set": {"value": value},
                    "$setOnInsert": {
                        "namespace": namespace,
                        "key": lecture_id,
                        "created_at": now.isoformat(),
                    }
                },
                upsert=True
            )
        
        return value
    
    async def delete(self, user_id: str, lecture_id: str) -> bool:
        """Delete whiteboard data."""
        if not self.connected:
            return False
        namespace = self._make_namespace(user_id)
        result = await self.db.whiteboards.delete_one({
            "namespace": namespace,
            "key": lecture_id
        })
        return result.deleted_count > 0
    
    async def list_by_user(self, user_id: str) -> list:
        """List all whiteboards for a user."""
        if not self.connected:
            return []
        namespace = self._make_namespace(user_id)
        cursor = self.db.whiteboards.find({"namespace": namespace})
        return [doc async for doc in cursor]


# Singleton instance
mongodb_store = MongoDBStore()


async def get_store() -> MongoDBStore:
    """Get the MongoDB store instance."""
    return mongodb_store

