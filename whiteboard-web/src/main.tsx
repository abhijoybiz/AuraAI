import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Tldraw, Editor, TLStoreSnapshot } from 'tldraw'
import 'tldraw/tldraw.css'

/**
 * Message types for React Native <-> Web communication
 */
type MessageType = 
  | 'LOAD_SNAPSHOT'
  | 'GET_SNAPSHOT'
  | 'SNAPSHOT_READY'
  | 'SNAPSHOT_CHANGED'
  | 'EDITOR_READY'

interface BridgeMessage {
  type: MessageType
  payload?: unknown
}

/**
 * Declare window extensions for React Native WebView
 */
declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void
    }
  }
}

/**
 * Send message to React Native
 */
function postToRN(type: MessageType, payload?: unknown) {
  const message: BridgeMessage = { type, payload }
  const messageStr = JSON.stringify(message)
  
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(messageStr)
  } else {
    // Development fallback - log to console
    console.log('[WebView -> RN]', type, payload)
  }
}

/**
 * Main whiteboard component with message bridge
 */
function WhiteboardApp() {
  const editorRef = useRef<Editor | null>(null)
  const [isReady, setIsReady] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  /**
   * Handle editor mount
   */
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor
    setIsReady(true)
    
    // Notify RN that editor is ready
    postToRN('EDITOR_READY')
    
    // Set up change listener for auto-save
    const unsubscribe = editor.store.listen(
      () => {
        // Debounce save notifications
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
        }
        saveTimeoutRef.current = setTimeout(() => {
          const snapshot = editor.store.getSnapshot()
          postToRN('SNAPSHOT_CHANGED', { snapshot })
        }, 1000) // 1 second debounce
      },
      { scope: 'document', source: 'user' }
    )
    
    // Return cleanup function
    return () => {
      unsubscribe()
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])
  
  /**
   * Handle incoming messages from React Native
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        // Handle both string and object messages
        const data = typeof event.data === 'string' 
          ? JSON.parse(event.data) 
          : event.data
          
        const { type, payload } = data as BridgeMessage
        const editor = editorRef.current
        
        console.log('[RN -> WebView]', type)
        
        switch (type) {
          case 'LOAD_SNAPSHOT':
            if (editor && payload) {
              const snapshot = (payload as { snapshot: TLStoreSnapshot }).snapshot
              editor.store.loadSnapshot(snapshot)
            }
            break
            
          case 'GET_SNAPSHOT':
            if (editor) {
              const snapshot = editor.store.getSnapshot()
              postToRN('SNAPSHOT_READY', { snapshot })
            }
            break
            
          default:
            console.warn('Unknown message type:', type)
        }
      } catch (error) {
        console.error('Error handling message:', error)
      }
    }
    
    // Listen for messages from both window and document
    window.addEventListener('message', handleMessage)
    document.addEventListener('message', handleMessage as EventListener)
    
    return () => {
      window.removeEventListener('message', handleMessage)
      document.removeEventListener('message', handleMessage as EventListener)
    }
  }, [])
  
  /**
   * Handle immediate snapshot request (for testing in browser)
   */
  useEffect(() => {
    // Expose helper for debugging
    (window as unknown as { getSnapshot: () => unknown }).getSnapshot = () => {
      return editorRef.current?.store.getSnapshot()
    }
  }, [])
  
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Tldraw
        onMount={handleMount}
        // Hide UI elements that don't work well on mobile
        hideUi={false}
        // Enable auto-focus for immediate interaction
        autoFocus
      />
    </div>
  )
}

// Mount the app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WhiteboardApp />
  </React.StrictMode>
)

