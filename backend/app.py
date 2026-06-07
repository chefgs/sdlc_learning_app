import os
import json
import logging
from typing import List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pydantic

# Load .env automatically for local development
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))
except ImportError:
    pass

# Antigravity SDK imports
try:
    from google.antigravity import Agent, LocalAgentConfig
    from google.antigravity.hooks import hooks
    from google.antigravity.types import UsageMetadata
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
You are a Socratic tutor specialising in AI product development and DevOps platform engineering.
You teach Saravanan Gnanaguru's SDLC First Principles to absolute beginners.

## Your Core Curriculum
1. **Process-First AI-SDLC** — Engineering processes (tests, code reviews, quality gates) must exist before AI is layered in. See: backend/test_app.py and frontend/tests/e2e.js in this project.
2. **Architecture-First AI Development** — Map system boundaries, data flows, and security layers before writing a single line of code. See: the multi-tier FastAPI/Vite/Expo structure where clients never hold API keys.
3. **Paved Paths / Golden Paths** — Templates and automation (CI/CD workflows, Dockerfiles) make the secure, compliant route the easiest route. See: backend/Dockerfile and .github/workflows/.
4. **Sovereign AI & Compliance** — Keep data and credentials private and locally controlled. See: backend/app.py acting as a secure Gemini proxy.
5. **DevOps-OS** — Platform tooling that automates scaffolding and CI/CD from a single prompt or config.

## Strict Output Rules
- NEVER reveal your internal reasoning, strategy, or meta-commentary in your reply. Keep all internal thinking private.
- NEVER prefix replies with labels like "Socratic Guidance:", "Formulated Response:", or any bracketed notes.
- NEVER write raw code blocks unless the user has already answered 2 guiding questions and is clearly ready.
- ALWAYS respond using clean, well-formatted Markdown: use **bold** for key terms, bullet lists for options, and `code` for file names.
- ALWAYS answer a user's question with one concise guiding question in return, keeping your response under 150 words unless a deeper explanation is explicitly requested.
- Reference actual files in the sdlc_learning_app codebase to ground abstract concepts in real examples.
"""

# Default static quiz to use as an instant fallback if API key or SDK is missing
DEFAULT_MOCK_QUIZ = {
    "topic": "Saravanan's AI-SDLC & Architecture First Principles",
    "questions": [
        {
            "id": 1,
            "question": "What is the primary risk of adopting 'Prompt-First' instead of 'Process-First' AI-SDLC?",
            "options": [
                "It results in slower model inference.",
                "It creates fragile, unstructured pipelines that bypass code reviews, quality gates, and automated testing.",
                "It increases local storage consumption.",
                "It limits the use of open-source frameworks."
            ],
            "correct_answer": "It creates fragile, unstructured pipelines that bypass code reviews, quality gates, and automated testing.",
            "explanation": "Prompt-First approaches result in fragile pipelines. Process-First ensures AI is gated behind standard SDLC verification tests. (For example, see the automated Puppeteer E2E test in frontend/tests/e2e.js and pytest in backend/test_app.py)."
        },
        {
            "id": 2,
            "question": "What does the 'Architecture-First' AI Development principle advocate for?",
            "options": [
                "Writing the largest prompts possible to get perfect code output.",
                "Selecting the most expensive LLMs before looking at model size.",
                "Establishing system components, data flows, and security boundaries before generating code or invoking LLMs.",
                "Developing native mobile UIs before writing any backend infrastructure."
            ],
            "correct_answer": "Establishing system components, data flows, and security boundaries before generating code or invoking LLMs.",
            "explanation": "Establishing system boundaries ensures AI code builds inside secure, structured rails. (For example, see how Vite Web and Expo Mobile frontends in this project communicate strictly via backend-proxied API gates to protect the Gemini API Key)."
        },
        {
            "id": 3,
            "question": "Why are 'Paved Paths' (Golden Paths) crucial for developer platforms like DevOps-OS?",
            "options": [
                "They mandate manual SSH access to production containers.",
                "They let developers design custom build paths for each deployment.",
                "They template and automate secure configurations (CI/CD, Terraform) so the secure route is the easiest route.",
                "They require code bases to be completely public."
            ],
            "correct_answer": "They template and automate secure configurations (CI/CD, Terraform) so the secure route is the easiest route.",
            "explanation": "Golden Paths template complex configurations so developers can deploy safely without cognitive load. (For example, see the multi-stage backend/Dockerfile and the pre-configured GitHub workflows in this repository)."
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
                    "You are an exam generator creating an SDLC quiz based on Saravanan's principles. "
                    "In the explanations of the quiz answers, weave in examples from this repository's codebase "
                    "(e.g., backend/Dockerfile, frontend/tests/e2e.js, backend/app.py API proxying)."
                ),
                response_schema=SDLCQuiz
            )
            async with Agent(config) as agent:
                prompt = (
                    "Generate a 3-question quiz covering Process-First, Architecture-First, "
                    "and Sovereign AI / compliance principles. In the explanation of each answer, "
                    "reference specific code patterns or files in the active repository (sdlc_learning_app) as concrete examples."
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
            # ----------------------------------------------------------------
            # FIX: response.thoughts and async-for-token are MUTUALLY EXCLUSIVE
            # iterators on the same underlying stream. Consuming response.thoughts
            # first exhausts the stream so the token iterator yields nothing.
            # Solution: use a single token iterator and capture thoughts via a
            # per-session hook that pushes thought frames over the WebSocket.
            # ----------------------------------------------------------------
            ws_ref = websocket  # captured in closure below

            class ThoughtRelayHook(hooks.OnThoughtHook):
                """Relay each thought chunk to the WebSocket as a 'thought' frame."""
                async def run(self, context, data):
                    try:
                        await ws_ref.send_json({"type": "thought", "data": str(data)})
                    except Exception:
                        pass  # WebSocket may have disconnected

            config = LocalAgentConfig(
                system_instructions=SOCRATIC_TUTOR_INSTRUCTIONS,
                hooks=[ThoughtRelayHook()],
            )
            agent_instance = Agent(config)
            await agent_instance.__aenter__()
            logger.info("Antigravity Agent initialised for WebSocket stream.")
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

                    # Stream response tokens — thoughts arrive via ThoughtRelayHook
                    async for token in response:
                        await websocket.send_json({
                            "type": "token",
                            "data": token
                        })

                    # Send token usage audit frame
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
