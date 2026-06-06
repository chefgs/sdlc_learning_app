# Mobile UI Integration Specification

To hook a native mobile client (iOS/Android) or cross-platform framework (React Native/Flutter) into the Antigravity Socratic tutor backend, use the specifications below.

---

## 1. Connection Architecture

```
Mobile App (iOS/Android) ──[WebSocket / ws://]──► API Gateway (FastAPI) ──► Antigravity Agent
```

1.  **Transport Channel**: Use WebSockets (`ws://` or `wss://`) to allow full-duplex communication.
2.  **Streaming Frames**: The backend streams three main types of events:
    *   `thought`: Reasoning output (to be buffered separately).
    *   `token`: Final response text (to be rendered to the user).
    *   `usage`: Session cost and token audit metrics.

---

## 2. React Native (TypeScript) Connection Hook

This hook handles connecting, receiving real-time token events, parsing JSON frames, and updating states.

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseSocraticTutorOptions {
  backendUrl: string; // e.g. 'ws://your-backend.com/ws/tutor'
  conversationId?: string;
}

export function useSocraticTutor({ backendUrl, conversationId }: UseSocraticTutorOptions) {
  const [thoughts, setThoughts] = useState<string>('');
  const [response, setResponse] = useState<string>('');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const wsUrl = conversationId 
      ? `${backendUrl}?conversation_id=${conversationId}`
      : backendUrl;
      
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      setThoughts('');
      setResponse('');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        switch (payload.type) {
          case 'thought':
            setThoughts((prev) => prev + payload.data);
            break;
          case 'token':
            setResponse((prev) => prev + payload.data);
            break;
          case 'tool_start':
            setActiveTool(payload.data);
            break;
          case 'tool_end':
            setActiveTool(null);
            break;
          case 'usage':
            console.log('Token usage stats:', payload.data);
            break;
        }
      } catch (err) {
        console.error('Failed to parse frame:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Exponential backoff reconnect could be implemented here
    };

    socketRef.current = ws;
  }, [backendUrl, conversationId]);

  const sendMessage = useCallback((message: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      // Clear states for new response cycle
      setThoughts('');
      setResponse('');
      socketRef.current.send(JSON.stringify({ message }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, [connect]);

  return { thoughts, response, activeTool, isConnected, sendMessage };
}
```

---

## 3. iOS Swift (SwiftUI) ObservableObject

An implementation template using Apple's native `URLSessionWebSocketTask` to stream tokens directly into SwiftUI elements.

```swift
import SwiftUI
import Combine

class SocraticTutorViewModel: ObservableObject {
    @Published var thoughts: String = ""
    @Published var responseText: String = ""
    @Published var activeTool: String? = nil
    @Published var isConnected: Bool = false
    
    private var webSocketTask: URLSessionWebSocketTask?
    private let urlSession = URLSession(configuration: .default)
    
    func connect(to urlString: String) {
        guard let url = URL(string: urlString) else { return }
        webSocketTask = urlSession.webSocketTask(with: url)
        webSocketTask?.resume()
        self.isConnected = true
        self.listen()
    }
    
    func sendMessage(_ text: String) {
        let messageDict: [String: String] = ["message": text]
        guard let jsonData = try? JSONSerialization.data(withJSONObject: messageDict, options: []),
              let jsonString = String(data: jsonData, encoding: .utf8) else { return }
        
        let message = URLSessionWebSocketMessage.string(jsonString)
        
        // Reset buffers
        DispatchQueue.main.async {
            self.thoughts = ""
            self.responseText = ""
        }
        
        webSocketTask?.send(message) { error in
            if let error = error {
                print("Send error: \(error)")
            }
        }
    }
    
    private func listen() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .failure(let error):
                print("Receive failed: \(error)")
                DispatchQueue.main.async { self.isConnected = false }
            case .success(let message):
                switch message {
                case .string(let text):
                    self.parseMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.parseMessage(text)
                    }
                @unknown default:
                    break
                }
                self.listen() // Loop to continue listening
            }
        }
    }
    
    private func parseMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any],
              let type = json["type"] as? String else { return }
        
        DispatchQueue.main.async {
            switch type {
            case "thought":
                if let content = json["data"] as? String {
                    self.thoughts += content
                }
            case "token":
                if let content = json["data"] as? String {
                    self.responseText += content
                }
            case "tool_start":
                self.activeTool = json["data"] as? String
            case "tool_end":
                self.activeTool = nil
            default:
                break
            }
        }
    }
    
    func disconnect() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        self.isConnected = false
    }
}
```

---

## 4. UI Best Practices for Mobile Chat Clients

1.  **Thoughts Collapsing Accordion**: Keep the reasoning thought blocks collapsed by default in a small, stylized chip (e.g., `"Tutor Thinking Process..."`) with a glowing badge. Let users expand it to see reasoning.
2.  **Smooth Typography Transitions**: Real-time token streams cause text views to layout frequently. Ensure text containers have flexible heights and compile without jitter using smooth scaling/padding values.
3.  **Active Tool Spinner**: If the agent triggers a file scan or calls an MCP utility, render a subtle glowing card showing: `[⚙️ Scanning DevOps-OS templates...]`. This keeps beginners engaged while the model works.
