# Latest Features of Google Antigravity SDK

The Google Antigravity SDK is a powerful framework for building autonomous AI agents and multi-agent systems. It provides robust abstractions for agent orchestration, safety, lifecycle management, and tool execution.

---

## 1. Core Pillars of the SDK

Before exploring the features, it is important to understand the three architectural pillars of the SDK:
*   **`Agent`**: The main entry point. It manages session lifecycles, configuration (models, capabilities, tools, policies), and orchestrates hooks/triggers.
*   **`Conversation`**: A stateful session wrapper. It stores turn-by-turn history, handles message trajectories, manages context compaction, and provides streaming text/thoughts.
*   **`Connection`**: The underlying abstract transport layer interfacing with the backend (local execution, cloud services, etc.).

---

## 2. Detailed Feature List & Examples

### A. Model Context Protocol (MCP) Integration
Agents can connect directly to external MCP servers to consume resources, prompts, and tools.
*   **Stdio Transport**: Launches and manages local server processes.
*   **SSE Transport**: Connects to remote services via Server-Sent Events (SSE).

**Example (SSE MCP Server):**
```python
from google.antigravity import Agent, LocalAgentConfig, types

mcp_servers = [
    types.McpSseServer(
        url="https://example.com/mcp/sse",
        headers={"Authorization": "Bearer token"}
    )
]
config = LocalAgentConfig(mcp_servers=mcp_servers)

async with Agent(config) as agent:
    response = await agent.chat("Analyze data using the remote MCP server.")
```

### B. Background Triggers & Periodic Checks
Allows agents to execute background tasks, monitor states, and push messages to the active conversation context asynchronously.
*   **`every(seconds, callback)`**: Runs a callback periodically.
*   **`on_file_change(path, callback)`**: Monitors directory or file changes (requires `watchfiles`).

**Example:**
```python
import asyncio
from google.antigravity import Agent, LocalAgentConfig
from google.antigravity.triggers import every, TriggerContext

async def health_check(ctx: TriggerContext):
    # Asynchronously alert the agent
    await ctx.send("Background check: Database latency is high.")

timer_trigger = every(60, health_check)
config = LocalAgentConfig(triggers=[timer_trigger])
```

### C. Rich Lifecycle Hooks
Hooks let developers intercept, inspect, and modify data at multiple stages of execution.
*   **Session Hooks**: `on_session_start`, `on_session_end`.
*   **Turn Hooks**: `pre_turn` (inspect/reject user prompt), `post_turn` (access final response).
*   **Tool Hooks**: `pre_tool_call_decide` (approval workflow), `post_tool_call`, `on_tool_error` (error fallback/self-correction).
*   **Interaction Hooks**: `on_interaction` (asking user questions via UI).
*   **Compaction Hooks**: `on_compaction` (notified when context is optimized).

**Example (Tool Error Fallback):**
```python
from google.antigravity.hooks import hooks

@hooks.on_tool_error
async def on_error(data: Exception):
    # Feed alternative instructions to the model on failure
    return "[Database connection lost. Proceed using cached data.]"
```

### D. Declarative Safety Policies
A priority-based access control policy engine evaluating tool execution safety.
*   **Default Behavior**: Conservative by default. Denies `run_command` (shell tool) and allows all others.
*   **Workspace Constraints**: `policy.workspace_only()` limits file manipulation tools (`view_file`, `edit_file`, `create_file`) to specific folders.
*   **Predicates**: Conditional execution limits based on tool arguments.

**Example (Argument-Based Policy):**
```python
from google.antigravity.hooks import policy

# Deny shell command execution if it attempts to delete files
rm_policy = policy.deny(
    "run_command",
    when=lambda args: "rm" in args.get("CommandLine", ""),
    name="block_rm"
)
```

### E. Stateful Custom Tools (`ToolContext`)
Developers can equip agents with Python functions as custom tools. By declaring `ctx: ToolContext` in the function arguments, the SDK automatically injects a stateful context to persist variables across turns.

**Example:**
```python
from google.antigravity import ToolContext

def increment_counter(ctx: ToolContext) -> str:
    """Increments a persistent user interaction counter."""
    val = ctx.get_state("counter", 0) + 1
    ctx.set_state("counter", val)
    return f"Counter is now {val}."
```

### F. Multi-Agent Delegation (Subagents)
Agents can spawn subagents to delegate complex subtasks. This is enabled using `CapabilitiesConfig(enable_subagents=True)`.

### G. Conversation Persistence
Allows saving the conversation history to disk and resuming it across python processes using a unique `conversation_id`.

**Example:**
```python
# Save session
config = LocalAgentConfig(save_dir="./sessions")
async with Agent(config) as agent:
    await agent.chat("My key is 12345")
    conv_id = agent.conversation_id

# Resume session later
config_resume = LocalAgentConfig(conversation_id=conv_id, save_dir="./sessions")
async with Agent(config_resume) as agent:
    res = await agent.chat("What is my key?")  # Agent remembers it
```

### H. Structured Output Integration
Enforces constraints on response generation to guarantee it parses as a structured object (Pydantic schema).

**Example:**
```python
import pydantic
from google.antigravity import Agent, LocalAgentConfig

class TaskSchema(pydantic.BaseModel):
    title: str
    priority: int

config = LocalAgentConfig(response_schema=TaskSchema)
async with Agent(config) as agent:
    response = await agent.chat("Plan a task to write tests.")
    data = await response.structured_output()  # Returns TaskSchema dict
```

### I. Observability & Token Usage
Exposes exact token usage details via `agent.conversation.total_usage`. Importantly, it categorizes **thinking/reasoning tokens** (`thoughts_token_count`) separately from candidates and prompts, giving developers deep insight into the costs of reasoning models.

### J. Filesystem-Based Skill Loading
Dynamically load reusable domain workflows (based on the Agent Skills standard) from folders containing a `SKILL.md` file.

### K. Multimodal Inputs and Outputs
*   **Input**: Send images (`Image.from_file`) and documents/PDFs (`Document.from_file`) in a list prompt.
*   **Output**: Enable the `GENERATE_IMAGE` tool to generate custom images in response to user requests.
