import os
import json
import logging
from typing import List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pydantic

# Antigravity SDK imports
try:
    from google.antigravity import Agent, LocalAgentConfig
    from google.antigravity.hooks import hooks
    from google.antigravity.types import HookResult, UsageMetadata
    ANTIGRAVITY_AVAILABLE = True
except ImportError:
    ANTIGRAVITY_AVAILABLE = False

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sdlc_learning_app")

app = FastAPI(
    title="SDLC Learning App Backend",
    description="FastAPI service hosting the Socratic SDLC Antigravity Agent.",
    version="1.0.0"
)

# Enable CORS for frontend local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# 1. Pydantic Schemas for Structured AI Quiz Output
# -----------------------------------------------------------------------------
class QuizQuestion(BaseModel):
    id: int
    question: str
    options: List[str]
    correct_answer: str
    explanation: str

class SDLCQuiz(BaseModel):
    topic: str
    questions: List[QuizQuestion]

class AskRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

# Custom system instructions embodying Saravanan Gnanaguru's first principles
SOCRATIC_TUTOR_INSTRUCTIONS = """
You are a Socratic tutor representing Saravanan Gnanaguru's SDLC First Principles.
Your goal is to guide beginners in AI and DevOps engineering to think from first principles.

We are dogfooding by using THIS actual codebase (chefgs/sdlc_learning_app) as our primary teaching subject.
Use the repository's architecture and files as live examples:
1. Process-First AI-SDLC: Point to the backend/test_app.py (pytest unit tests) and frontend/tests/e2e.js (Puppeteer browser E2E tests) as the quality gates that verify AI-generated files before deployment.
2. Architecture-First AI Development: Explain how the multi-tier structure (FastAPI backend, Vite web client, Expo mobile client) was mapped out, ensuring the clients communicate only via HTTP/WebSocket APIs, with no direct access to the Gemini API Key.
3. Paved Paths / Golden Paths: Point to backend/Dockerfile (a clean, multi-stage runner build) and .github/workflows/ (ci.yml and build.yml workflows) as templates that developer platforms offer to make compliance friction-free.
4. Sovereign AI & Compliance: Explain how the python backend acts as a secure proxy, isolating the Gemini API key inside server-side environments instead of client bundles. Also, highlight the package.json overrides that remediated vulnerability risks.

Pedagogical guidelines:
- Never give direct answers initially. Answer a question with another guiding question.
- Reference the actual files and directories of the sdlc_learning_app repository to ground your Socratic questions in the live codebase.
- Use simple analogies (e.g. comparing container builds to shipping packages, or E2E tests to checking a car's dashboard controls).
- Encourage the beginner to consider the security and cost implications of their choices.
"""

# Default static quiz to use as an instant fallback if API key or SDK is missing
DEFAULT_MOCK_QUIZ = {
    "topic": "Codebase Dogfooding: chefgs/sdlc_learning_app",
    "questions": [
        {
            "id": 1,
            "question": "How does this application's architecture enforce the 'Sovereign AI' key-protection model?",
            "options": [
                "By writing the GEMINI_API_KEY directly into mobile/App.tsx.",
                "By having both Web and Mobile frontends send requests to a secure FastAPI backend, which acts as the sole credential holder.",
                "By storing the API key in a public frontend config file.",
                "By not using any API keys at all."
            ],
            "correct_answer": "By having both Web and Mobile frontends send requests to a secure FastAPI backend, which acts as the sole credential holder.",
            "explanation": "To maintain security and sovereignty, the frontend and mobile apps never access credentials directly. The FastAPI backend is the proxy that connects securely to the Gemini model."
        },
        {
            "id": 2,
            "question": "Why does the backend/Dockerfile utilize a 'multi-stage' container compilation process?",
            "options": [
                "To increase build times and compile debug logs.",
                "To run the frontend and mobile codes in the same container.",
                "To separate build-time packages from the final runtime runner, minimizing the container size and security vulnerability footprint.",
                "To run both Python and Node.js servers in parallel."
            ],
            "correct_answer": "To separate build-time packages from the final runtime runner, minimizing the container size and security vulnerability footprint.",
            "explanation": "Multi-stage builds allow us to compile libraries in the builder stage but copy only the runtime artifacts into the runner stage, keeping the container image light and secure."
        },
        {
            "id": 3,
            "question": "Which file in this project represents the automated 'Quality Gate' for the web frontend interface?",
            "options": [
                "backend/requirements.txt",
                "frontend/tests/e2e.js (using Puppeteer for automated browser checks)",
                "mobile/app.json",
                "docs/learning_app_roadmap.md"
            ],
            "correct_answer": "frontend/tests/e2e.js (using Puppeteer for automated browser checks)",
            "explanation": "Automated E2E tests check user interactions in a real browser context. Staging this in our CI workflow (ci.yml) ensures we dogfood our quality checks before shipping code."
        }
    ]
}

# -----------------------------------------------------------------------------
# 2. HTTP Endpoints
# -----------------------------------------------------------------------------
@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Welcome to the Socratic SDLC Tutor backend.",
        "antigravity_sdk_loaded": ANTIGRAVITY_AVAILABLE,
        "gemini_api_key_configured": "GEMINI_API_KEY" in os.environ
    }

@app.post("/api/generate-quiz")
async def generate_quiz():
    """Generates a structured SDLC quiz using Antigravity and Pydantic schemas."""
    # Check if we can run the real agent
    if ANTIGRAVITY_AVAILABLE and "GEMINI_API_KEY" in os.environ:
        try:
            config = LocalAgentConfig(
                system_instructions=(
                    "You are an exam generator creating an SDLC quiz. Your questions must dogfood the actual "
                    "chefgs/sdlc_learning_app repository code structure, Docker configurations, backend/test_app.py testing, "
                    "Puppeteer E2E tests, and secure proxy patterns."
                ),
                response_schema=SDLCQuiz
            )
            async with Agent(config) as agent:
                prompt = (
                    "Generate a 3-question multiple-choice quiz that dogfoods this repository's codebase. "
                    "Create questions about the FastAPI backend proxy, the multi-stage Dockerfile, "
                    "frontend E2E test gates, or package dependency vulnerability overrides."
                )
                response = await agent.chat(prompt)
                data = await response.structured_output()
                if data:
                    return data
        except Exception as e:
            logger.error(f"Failed to generate quiz with Antigravity: {e}. Falling back to default mock quiz.")
            
    # Failsafe fallback
    return DEFAULT_MOCK_QUIZ

# -----------------------------------------------------------------------------
# 3. WebSocket Real-Time Socratic Tutor Chat
# -----------------------------------------------------------------------------
@app.websocket("/ws/tutor")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("New WebSocket connection accepted.")

    agent_instance = None
    
    # Initialize the Antigravity agent if keys are present
    if ANTIGRAVITY_AVAILABLE and "GEMINI_API_KEY" in os.environ:
        try:
            config = LocalAgentConfig(
                system_instructions=SOCRATIC_TUTOR_INSTRUCTIONS
            )
            # We keep the agent open for the websocket session
            agent_instance = Agent(config)
            await agent_instance.__aenter__()
            logger.info("Antigravity Agent initialized for WebSocket stream.")
        except Exception as e:
            logger.error(f"Error starting Antigravity Agent: {e}")
            agent_instance = None

    try:
        while True:
            # Receive user message
            data = await websocket.receive_text()
            payload = json.loads(data)
            user_message = payload.get("message", "")
            
            if not user_message:
                continue
            
            # If the Antigravity agent is available, use it to stream response
            if agent_instance:
                try:
                    response = await agent_instance.chat(user_message)
                    
                    # 1. Stream Thoughts/Reasoning
                    async for thought in response.thoughts:
                        await websocket.send_json({
                            "type": "thought",
                            "data": thought
                        })
                        
                    # 2. Stream Response Tokens
                    async for token in response:
                        await websocket.send_json({
                            "type": "token",
                            "data": token
                        })
                        
                    # 3. Stream Token Usage Audit
                    usage: UsageMetadata = agent_instance.conversation.total_usage
                    await websocket.send_json({
                        "type": "usage",
                        "data": {
                            "prompt_tokens": usage.prompt_token_count,
                            "candidates_tokens": usage.candidates_token_count,
                            "thoughts_tokens": usage.thoughts_token_count,
                            "total_tokens": usage.total_token_count
                        }
                    })
                except Exception as e:
                    logger.error(f"Error during agent turn: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "data": f"Agent processing error: {str(e)}"
                    })
            else:
                # Failsafe mock Socratic replies to simulate the experience for testing
                await websocket.send_json({
                    "type": "thought",
                    "data": "[Simulating Socratic Thought Process: Analyzing beginner prompt on SDLC...]"
                })
                
                # Socratic reply logic based on query
                reply = "That is an interesting question about AI design. Before we look at coding it, what architecture blueprint do you think would minimize our dependency risks?"
                if "process" in user_message.lower():
                    reply = "A process-first approach is key. What checkpoints do you think we should establish to verify the safety of AI-generated pipelines before deployment?"
                elif "architecture" in user_message.lower():
                    reply = "Architecture-first gives us guardrails. Why might mapping out data flows first protect a fintech app from prompt injections?"
                elif "paved" in user_message.lower() or "golden" in user_message.lower():
                    reply = "Paved paths prevent ticket ops. How can developer templates make standard deployments secure by default?"
                
                # Simulate token streaming
                for word in reply.split(" "):
                    await websocket.send_json({
                        "type": "token",
                        "data": word + " "
                    })
                    import asyncio
                    await asyncio.sleep(0.05)
                
                await websocket.send_json({
                    "type": "usage",
                    "data": {
                        "prompt_tokens": 12,
                        "candidates_tokens": len(reply.split(" ")),
                        "thoughts_tokens": 5,
                        "total_tokens": 17 + len(reply.split(" "))
                    }
                })

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected.")
    finally:
        if agent_instance:
            await agent_instance.__aexit__(None, None, None)
            logger.info("Antigravity Agent session exited.")
