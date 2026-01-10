# Journey Map / Mind Map Feature - Implementation Plan

## Overview

This document describes the implementation of the AI-powered Journey Map feature, which automatically generates visual mind maps from lecture transcriptions using a tldraw-based whiteboard embedded in a WebView.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React Native)                   │
├─────────────────────────────────────────────────────────────────┤
│  JourneymapScreen.js                                             │
│  ├── Receives: lectureId, transcript (from navigation params)   │
│  ├── State Management: status, syncStatus, conceptGraph         │
│  ├── WebView: Embeds tldraw editor (whiteboard-web)             │
│  └── Communication: postMessage bridge with WebView             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (FastAPI)                            │
├─────────────────────────────────────────────────────────────────┤
│  /whiteboard/generate-mindmap                                    │
│  ├── Input: { text: string, session_id: string }                │
│  ├── LLM: Extracts concepts from transcription                  │
│  ├── Output: { tldraw_snapshot, concept_graph, session_id }     │
│                                                                  │
│  /whiteboard/init                                                │
│  ├── Input: { lecture_id, text, user_id }                       │
│  ├── Returns existing or generates new whiteboard               │
│                                                                  │
│  /whiteboard/save                                                │
│  ├── Input: { lecture_id, tldraw_snapshot, user_id }            │
│  ├── Persists user edits to MongoDB                             │
│                                                                  │
│  /whiteboard/get/{lecture_id}                                    │
│  ├── Retrieves stored whiteboard data                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MongoDB                                      │
│  ├── Stores tldraw snapshots                                    │
│  ├── Stores concept graphs                                      │
│  └── Supports versioning and sync status                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Modified/Created

### 1. `screens/JourneymapScreen.js` (NEW)

Full implementation of the Journey Map screen with:

- **Automatic mind map generation** from lecture transcription
- **tldraw WebView integration** for visualization
- **Backend API integration** for persistence
- **Loading/error/success states** with animations
- **Sync status tracking** (synced/pending/error)
- **Regeneration capability**

### 2. `App.js` (MODIFIED)

Added navigation route:
```javascript
import JourneymapScreen from './screens/JourneymapScreen';
// ...
<Stack.Screen name="Journeymap" component={JourneymapScreen} />
```

### 3. `screens/ResultsScreen.js` (MODIFIED)

Updated materials grid to navigate to JourneymapScreen:
```javascript
{
    id: 'journey',
    label: 'Journey Map',
    icon: <Route size={32} color={colors.text} strokeWidth={1.5} />,
    screen: 'Journeymap'  // Added this
}
```

---

## Data Flow

### Initial Load

```
1. User taps "Journey Map" in Materials section
2. Navigation passes: { transcript, id: lectureId }
3. JourneymapScreen checks:
   a. Local storage (AsyncStorage) for existing journeyMapSnapshot
   b. Backend API for persisted whiteboard
   c. If none exists, auto-generates from transcript
4. Generated snapshot loads into tldraw WebView
```

### Mind Map Generation

```
1. Transcript text sent to /whiteboard/generate-mindmap
2. Backend LLM extracts:
   - Central topic (main theme of lecture)
   - 4-7 branch concepts (key ideas)
   - Relationships between concepts
3. Returns tldraw snapshot with radial layout:
   - Central ellipse node
   - Branch rectangle nodes
   - Arrow connections
4. Snapshot saved to local storage + backend
5. Loaded into WebView for display
```

### Saving Changes

```
1. User edits shapes in tldraw
2. WebView sends SNAPSHOT_CHANGED message
3. Frontend debounces saves (2 second delay)
4. Saves to local storage immediately
5. Attempts backend sync
6. Updates sync status indicator
```

---

## API Endpoints Used

### POST `/whiteboard/generate-mindmap`

**Purpose:** Generate a new mind map from text

**Request:**
```json
{
  "text": "Lecture transcription text...",
  "session_id": "rec_1234567890"
}
```

**Response:**
```json
{
  "tldraw_snapshot": { /* tldraw store snapshot */ },
  "concept_graph": {
    "nodes": [
      { "id": "central", "label": "Main Topic", "description": "" },
      { "id": "b1", "label": "Concept 1", "description": "" }
    ],
    "edges": [
      { "source": "central", "target": "b1", "label": "" }
    ]
  },
  "session_id": "rec_1234567890"
}
```

### POST `/whiteboard/save`

**Purpose:** Save user edits

**Request:**
```json
{
  "lecture_id": "rec_1234567890",
  "tldraw_snapshot": { /* current snapshot */ },
  "user_id": "default"
}
```

### GET `/whiteboard/get/{lecture_id}`

**Purpose:** Retrieve existing whiteboard

**Response:**
```json
{
  "lecture_id": "rec_1234567890",
  "tldraw_snapshot": { /* saved snapshot */ },
  "concept_graph": { /* concept graph */ },
  "updated_at": "2026-01-10T12:00:00Z",
  "exists": true
}
```

---

## Local Storage Schema

Data stored in `@memry_cards` AsyncStorage:

```json
{
  "id": "rec_1234567890",
  "title": "Lecture 1",
  "transcript": [...],
  "summary": "...",
  
  // Journey Map specific fields
  "journeyMapSnapshot": { /* tldraw snapshot */ },
  "journeyMapConceptGraph": { /* concept graph */ },
  "journeyMapSyncStatus": "synced" | "pending" | "error",
  "journeyMapUpdatedAt": "2026-01-10T12:00:00Z"
}
```

---

## WebView Communication

### Messages FROM React Native TO WebView

| Type | Payload | Purpose |
|------|---------|---------|
| `LOAD_SNAPSHOT` | `{ snapshot: TldrawSnapshot }` | Load snapshot into editor |
| `GET_SNAPSHOT` | - | Request current snapshot |

### Messages FROM WebView TO React Native

| Type | Payload | Purpose |
|------|---------|---------|
| `EDITOR_READY` | - | Editor initialized |
| `SNAPSHOT_READY` | `{ snapshot }` | Response to GET_SNAPSHOT |
| `SNAPSHOT_CHANGED` | `{ snapshot }` | Auto-save triggered |

---

## UI States

### 1. Loading State
- Shows animated spinner
- "Loading Journey Map" text
- Back button available

### 2. Generating State
- Shows spinning Sparkles icon
- "Generating Journey Map" text
- Progress bar (indeterminate)
- "AI is analyzing your lecture..."

### 3. Ready State
- Header with back, regenerate, save buttons
- Sync status indicator
- Full-screen tldraw WebView

### 4. Error State
- Error icon
- Error message
- "Try Again" button (if transcript available)
- "Go Back" link

---

## Dependencies Required

### NPM Packages

```bash
# Required for WebView
npm install react-native-webview

# Already included in project
# - @react-native-async-storage/async-storage
# - lucide-react-native
# - expo-constants
```

### Whiteboard Server

The tldraw whiteboard must be running:

```bash
cd whiteboard-web
npm install
npm run dev  # Runs on http://localhost:3001
```

### Backend Server

The FastAPI backend must be running:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload  # Runs on http://localhost:8000
```

---

## Testing Instructions

### Prerequisites

1. **Backend running:** `cd backend && uvicorn main:app --reload`
2. **Whiteboard server running:** `cd whiteboard-web && npm run dev`
3. **Expo app running:** `npm start`

### Test Cases

#### 1. First-Time Mind Map Generation

1. Record or upload a lecture
2. Wait for transcription to complete
3. Go to Materials tab
4. Tap "Journey Map"
5. **Expected:** Loading animation → Generation animation → Mind map displayed
6. **Verify:** Central topic + branch concepts visible

#### 2. Persistence (Close & Reopen)

1. Generate a mind map (test case 1)
2. Close the app completely
3. Reopen the app
4. Navigate to the same lecture
5. Tap "Journey Map"
6. **Expected:** Previously generated map loads instantly (no regeneration)

#### 3. User Edits & Save

1. Open an existing journey map
2. Drag a shape or add a new shape
3. Wait 2 seconds for auto-save
4. **Expected:** Sync status changes to "Pending" then back to "Synced"
5. Close and reopen to verify changes persisted

#### 4. Regeneration

1. Open an existing journey map
2. Tap the regenerate button (↻)
3. Confirm in the alert
4. **Expected:** New mind map generated, replaces old one

#### 5. Empty Transcript Handling

1. Create a lecture without transcript (if possible)
2. Tap "Journey Map"
3. **Expected:** Error state with helpful message

#### 6. Offline Mode

1. Turn off network connection
2. Open a journey map
3. Make edits
4. **Expected:** Sync status shows "Pending"
5. Restore network
6. **Expected:** Auto-syncs, status changes to "Synced"

#### 7. Backend Unavailable

1. Stop the backend server
2. Try to generate a new journey map
3. **Expected:** Error message about backend unavailability

---

## Edge Cases Handled

| Edge Case | Handling |
|-----------|----------|
| Empty/missing transcript | Shows error with helpful message |
| No lecture ID | Shows "No Lecture Selected" state |
| Network failure during generation | Shows error with retry button |
| WebView fails to load | Shows alert, logs error |
| Backend timeout | Graceful error handling |
| Duplicate saves | Debounced (2 second delay) |
| Unsaved changes on back | Alert prompting to save |

---

## Known Limitations

1. **WebView Server Required:** The tldraw whiteboard requires a local development server (localhost:3001) in development mode
2. **Android Emulator:** Uses `10.0.2.2:3001` for localhost access
3. **Production Deployment:** Requires hosting the whiteboard-web build or bundling as static assets

---

## Future Enhancements

1. **Offline Generation:** Use local LLM for offline mind map generation
2. **Export:** Export mind map as image or PDF
3. **Collaboration:** Real-time multi-user editing
4. **Templates:** Different mind map layout styles
5. **Sub-branches:** Support for deeper hierarchies
6. **Search:** Find concepts within the mind map

---

## Troubleshooting

### "Backend not available" error
- Ensure backend is running: `cd backend && uvicorn main:app --reload`
- Check API_BASE_URL in `utils/api.js`

### WebView shows blank/error
- Ensure whiteboard server is running: `cd whiteboard-web && npm run dev`
- For Android emulator, verify it uses `10.0.2.2:3001`

### Mind map not generating
- Check Groq API key is configured in backend
- Verify transcript is not empty
- Check backend logs for errors

### Changes not syncing
- Check network connection
- Verify backend /whiteboard/save endpoint is working
- Check sync status indicator for current state
