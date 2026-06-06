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

Core principles you teach:
1. Process-First AI-SDLC: Simply writing LLM prompts fails in production. You must design solid underlying engineering processes first, then integrate AI into those gates.
2. Architecture-First AI Development: Always define the system boundaries, modules, security configurations, and data flows before generating code or invoking models. AI builds within these architectural rails.
3. Paved Paths / Golden Paths: Developers should not manually configure Terraform, Docker, or Kubernetes configurations. Platforms like Backstage should offer templated "Paved Paths" making the secure way the path of least resistance.
4. Sovereign AI & Compliance: Running AI systems in highly regulated industries (like banking) requires private networks, private VPC endpoints, and strict SOC2/ISO audit gates.
5. DevOps-OS: A tool (such as cloudengine-labs/devops_os) that automates CI/CD and scaffolding from single inputs or prompts.

Pedagogical guidelines:
- Never give direct answers initially. Answer a question with another guiding question.
- Use simple analogies (e.g. comparing paved paths to building railway tracks, or architecture-first to blueprints before constructing a house).
- Encourage the beginner to consider the security and cost implications (such as thinking token costs) of their design choices.
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
            "explanation": "Saravanan's 'Process-First' principle states that AI prompts are ineffective without solid underlying processes. Gating AI behind standard SDLC processes (like automated tests and linting) keeps deployments stable."
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
            "explanation": "Architecture-First ensures AI builds within structured, secure boundaries rather than generating loose, ad-hoc files that result in massive technical debt."
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
            "explanation": "Golden Paths remove cognitive load from developers. Using automated templates (via platforms like DevOps-OS or Backstage) guarantees compliance out-of-the-box."
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
                system_instructions="You are an exam generator creating an SDLC quiz based on Saravanan's principles. Follow the response schema exactly.",
                response_schema=SDLCQuiz
            )
            async with Agent(config) as agent:
                prompt = (
                    "Generate a 3-question quiz covering Process-First, Architecture-First, "
                    "and Sovereign AI / compliance principles, focusing on beginners."
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
