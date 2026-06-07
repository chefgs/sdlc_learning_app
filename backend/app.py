import os
import json
import asyncio
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


def build_mock_tutor_reply(user_message: str) -> str:
    """Fallback Socratic reply used when the live model is unavailable."""
    reply = (
        "That is an interesting question about AI design. Before we look at coding it, "
        "what architecture blueprint do you think would minimize our dependency risks?"
    )
    lowered = user_message.lower()
    if "process" in lowered:
        return (
            "A **Process-First** approach means tests, reviews, and quality gates exist before AI-generated changes are trusted. "
            "Look at `backend/test_app.py` and `frontend/tests/e2e_chat.js`: what checkpoints should block unsafe code before deployment?"
        )
    if "architecture" in lowered:
        return (
            "**Architecture-First** gives you guardrails before implementation. In this repo, the Vite client talks to the FastAPI backend "
            "instead of holding API keys directly. Why does that boundary reduce risk?"
        )
    if "codebase" in lowered or "example" in lowered:
        return (
            "A concrete example is the split between `frontend/app.js` and `backend/app.py`: the browser handles UI streaming, "
            "while the backend owns model access and credentials. Why is that separation useful for compliance and debugging?"
        )
    if "paved" in lowered or "golden" in lowered:
        return (
            "**Paved paths** make the safe route the easy route. This project's `backend/Dockerfile` and automated tests are examples. "
            "What happens when teams skip those templates and improvise every release?"
        )
    return reply


async def stream_mock_tutor_turn(websocket: WebSocket, user_message: str):
    """Emit a deterministic fallback turn so the UI never receives a blank response."""
    await websocket.send_json({
        "type": "thought",
        "data": "[Fallback tutor mode: grounding the answer in repository examples while the live model is unavailable.]"
    })

    reply = build_mock_tutor_reply(user_message)
    for word in reply.split(" "):
        await websocket.send_json({
            "type": "token",
            "data": word + " "
        })
        await asyncio.sleep(0.02)

    await websocket.send_json({
        "type": "usage",
        "data": {
            "prompt_tokens": 12,
            "candidates_tokens": len(reply.split(" ")),
            "thoughts_tokens": 5,
            "total_tokens": 17 + len(reply.split(" "))
        }
    })

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
            config = LocalAgentConfig(
                system_instructions=SOCRATIC_TUTOR_INSTRUCTIONS,
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
                    saw_token = False
                    saw_thought = False

                    async def stream_thoughts():
                        nonlocal saw_thought
                        async for thought in response.thoughts:
                            saw_thought = True
                            await websocket.send_json({
                                "type": "thought",
                                "data": thought
                            })

                    async def stream_tokens():
                        nonlocal saw_token
                        async for token in response:
                            saw_token = True
                            await websocket.send_json({
                                "type": "token",
                                "data": token
                            })

                    await asyncio.gather(stream_thoughts(), stream_tokens())

                    if not saw_token:
                        fallback_reply = (
                            "I do not have a complete model answer for that turn, so let us ground it in this codebase instead. "
                            "Look at `backend/test_app.py` and `frontend/tests/e2e_chat.js`: what checks should exist before trusting an AI-generated SDLC workflow?"
                        )
                        await websocket.send_json({
                            "type": "token",
                            "data": fallback_reply
                        })
                        saw_token = True

                    # Prefer per-turn usage from the SDK, then fall back to accumulated totals.
                    usage: UsageMetadata | None = response.usage_metadata
                    if usage is None:
                        usage = agent_instance.conversation.total_usage

                    prompt_tokens = usage.prompt_token_count if usage and usage.prompt_token_count is not None else 0
                    candidate_tokens = usage.candidates_token_count if usage and usage.candidates_token_count is not None else 0
                    thought_tokens = usage.thoughts_token_count if usage and usage.thoughts_token_count is not None else 0
                    total_tokens = usage.total_token_count if usage and usage.total_token_count is not None else 0

                    if total_tokens == 0 and saw_token:
                        candidate_tokens = max(candidate_tokens, 1)
                        total_tokens = max(total_tokens, prompt_tokens + candidate_tokens + thought_tokens)

                    await websocket.send_json({
                        "type": "usage",
                        "data": {
                            "prompt_tokens": prompt_tokens,
                            "candidates_tokens": candidate_tokens,
                            "thoughts_tokens": thought_tokens,
                            "total_tokens": total_tokens
                        }
                    })
                except Exception as e:
                    logger.error(f"Error during agent turn: {e}")
                    await stream_mock_tutor_turn(websocket, user_message)
            else:
                await stream_mock_tutor_turn(websocket, user_message)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected.")
    finally:
        if agent_instance:
            await agent_instance.__aexit__(None, None, None)
            logger.info("Antigravity Agent session exited.")
