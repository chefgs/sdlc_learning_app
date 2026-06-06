# Prompt & Context Engineering Guide

This guide documents the prompt engineering strategies, system instructions, and context injection patterns used in the **Socratic SDLC Tutor & AI Product Decision Center**. It details how we structured instructions for the LLM to achieve predictable, secure, and context-aware outputs.

---

## 1. The Socratic Coach: System Prompt & Instruction

To make the AI act as a Socratic tutor—guiding the user with questions rather than simply giving away code answers—we injected a highly targeted **System Instruction** into the Google Antigravity agent configuration.

### The System Prompt (Implemented in `/backend/app.py`)
```python
SYSTEM_INSTRUCTION = (
    "You are a Socratic tutor specializing in AI application development and DevOps platform engineering. "
    "Your primary goal is to guide the user to learn through questioning and first principles rather than providing direct solutions. "
    "Focus your teaching on Saravanan Gnanaguru's core philosophies: "
    "1) Process-First AI Software Development Lifecycle (AI-SDLC) - analyzing before coding. "
    "2) Architecture-First AI Development - mapping dependencies first. "
    "3) Paved Paths / Golden Paths - creating standardized, frictionless workflows for developers. "
    "4) Sovereign AI and Compliance - keeping data private, secure, and locally controlled. "
    "Use a professional, encouraging, and intellectual tone. When the user asks for code, do not write it "
    "for them. Instead, ask them guiding questions about their architecture, requirements, or threat model."
)
```

### Prompt Engineering Best Practices Used:
1.  **Role Play & Identity**: Giving the LLM a clear role ("Socratic tutor specializing in...") confines its response space.
2.  **Negative Constraints**: Explicitly instructing the model *not* to do something ("When the user asks for code, do not write it for them") overrides its default helper bias.
3.  **Domain Anchors**: Providing specific reference pillars (Saravanan Gnanaguru's philosophies) forces the model to frame all dialogue within those parameters.

---

## 2. Structured JSON Output: Pydantic Schema Prompting

Generating interactive quizzes requires structured data (JSON). Traditional LLM prompts like *"return a JSON object"* frequently result in broken syntax, markdown wrappers (` ```json `), or missing keys.

### The Schema Constraint Pattern
Instead of writing complex markdown formatting rules in the prompt, we defined a rigid data structure using **Pydantic** and passed it to the model.

```python
class QuizOption(BaseModel):
    key: str
    text: str

class QuizQuestion(BaseModel):
    id: int
    question: str
    options: List[QuizOption]
    correct_answer: str
    explanation: str

class Quiz(BaseModel):
    title: str
    questions: List[QuizQuestion]
```

### The Generation Prompt
When calling the Gemini API, we combined the Pydantic schema with a concise topic prompt:
```text
Generate a challenging 3-question multiple-choice quiz on the topic of '{topic}' based on Process-First and Architecture-First AI-SDLC principles.
```

### Why This Works:
*   The model receives the JSON schema as an API parameter (`response_schema=Quiz`).
*   The API forces the model's decoder to conform to the schema syntax. This guarantees that the JSON is always valid, type-safe, and directly parsable by both the Web and Mobile clients.

---

## 3. Agentic Context: Context Injection in Development

To build this multi-tier application end-to-end (FastAPI backend, Vite frontend, and Expo mobile app), the AI assistant relied on **Context Engineering** supplied by the development environment.

### The Context Template
Every task executed by the agent was guided by metadata describing the local environment:
```json
{
  "user_information": {
    "os_version": "mac",
    "default_project_directory": "/Users/gsaravanan/.gemini/antigravity/scratch"
  },
  "active_context": {
    "workspace_root": "/Users/gsaravanan/.gemini/antigravity/scratch/sdlc_learning_app",
    "python_virtual_environment": "sdlc_learning_app/venv/",
    "default_backend_port": 8000
  }
}
```

### How Context Influenced the Prompts:
*   **Operating System (mac)**: When writing packaging workflows and test scripts, commands used macOS/Unix-compatible scripts (e.g., `mkdir -p` and `cp` instead of Windows commands).
*   **Directory Scopes**: Paths were always specified as absolute paths (e.g., `file:///Users/gsaravanan/...`) to guarantee that references remained clickable inside the editor and terminal runs executed in the correct workspaces.

---

## 4. Best Practices for Your Own AI Prompts

When using LLMs to develop AI products, adopt these engineering habits:

| Strategy | Bad Example | Good Example |
| :--- | :--- | :--- |
| **Paved Paths** | *"Write a deployment script."* | *"Write a Bash script that automates the deployment of a FastAPI Docker container to Google Cloud Run, utilizing pre-configured environment variables for database credentials."* |
| **Sovereign Controls** | *"Integrate a key manager into the React frontend."* | *"Create a Python backend route that securely fetches data from the API using an environment variable. Do not expose this key to the client side under any circumstances."* |
| **Process-First** | *"Write the code for an authentication module."* | *"Explain the architecture of an authentication module. What database tables are required, and what endpoints must be created? Do not write the code yet."* |
