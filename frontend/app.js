// Configuration & Connection URL
const BACKEND_URL_ENV = import.meta.env && import.meta.env.VITE_BACKEND_URL;

const BACKEND_HOST = BACKEND_URL_ENV 
    ? BACKEND_URL_ENV.replace(/^(https?:\/\/|wss?:\/\/)/, '') // Strip protocols if present
    : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'localhost:8000' 
        : window.location.host);

const HTTP_PROTOCOL = BACKEND_URL_ENV
    ? (BACKEND_URL_ENV.startsWith('https') ? 'https:' : 'http:')
    : window.location.protocol;

const WS_PROTOCOL = HTTP_PROTOCOL === 'https:' ? 'wss:' : 'ws:';

const API_QUIZ_URL = `${HTTP_PROTOCOL}//${BACKEND_HOST}/api/generate-quiz`;
const WS_TUTOR_URL = `${WS_PROTOCOL}//${BACKEND_HOST}/ws/tutor`;

// DOM Elements
const connectionIndicator = document.getElementById('connection-indicator');
const connectionText = document.getElementById('connection-text');
const btnGenerateQuiz = document.getElementById('btn-generate-quiz');
const quizContainer = document.getElementById('quiz-container');
const quizProgressText = document.getElementById('quiz-progress-text');
const quizProgressFill = document.getElementById('quiz-progress-fill');
const socraticFeedbackCard = document.getElementById('socratic-feedback-card');
const feedbackBadgeStatus = document.getElementById('feedback-badge-status');
const feedbackExplanation = document.getElementById('feedback-explanation');

const chatFeed = document.getElementById('chat-feed');
const chatInput = document.getElementById('chat-input');
const btnSendMessage = document.getElementById('btn-send-message');
const thinkingPanel = document.getElementById('thinking-panel');
const thinkingContent = document.getElementById('thinking-content');
const thoughtsPlaceholder = document.getElementById('thoughts-placeholder');
const btnToggleThinking = document.getElementById('btn-toggle-thinking');

const metricPrompt = document.getElementById('metric-prompt');
const metricOutput = document.getElementById('metric-output');
const metricThoughts = document.getElementById('metric-thoughts');

// App States
let socket = null;
let reconnectInterval = 1000;
let activeQuizQuestions = [];
let answeredCount = 0;
let currentQuestionIndex = 0;

// -----------------------------------------------------------------------------
// 1. WebSocket Connection Manager
// -----------------------------------------------------------------------------
function connectWebSocket() {
    connectionText.textContent = "Connecting to Backend...";
    connectionIndicator.className = "status-indicator status-offline";
    
    socket = new WebSocket(WS_TUTOR_URL);

    socket.onopen = () => {
        logger("WebSocket connection established.");
        connectionIndicator.className = "status-indicator status-online";
        connectionText.textContent = "Connected to Tutor";
        reconnectInterval = 1000; // Reset backoff
    };

    let activeAssistantMessageBubble = null;

    socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);

        if (payload.type === 'thought') {
            // Append incoming reasoning thoughts
            if (thoughtsPlaceholder) {
                thoughtsPlaceholder.remove();
            }
            
            // Expand thoughts panel on first thought block
            if (!thinkingPanel.classList.contains('expanded')) {
                thinkingPanel.classList.add('expanded');
                thinkingPanel.classList.add('active-glowing');
            }
            
            thinkingContent.textContent += payload.data;
            // Auto-scroll thoughts
            thinkingContent.scrollTop = thinkingContent.scrollHeight;

        } else if (payload.type === 'token') {
            // Remove glow on thoughts when token streaming starts
            thinkingPanel.classList.remove('active-glowing');

            // Set up a bubble if this is the start of a reply
            if (!activeAssistantMessageBubble) {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'message assistant-message';
                
                const bubble = document.createElement('div');
                bubble.className = 'message-bubble';
                msgDiv.appendChild(bubble);
                
                chatFeed.appendChild(msgDiv);
                activeAssistantMessageBubble = bubble;
            }
            
            // Append token text
            activeAssistantMessageBubble.textContent += payload.data;
            chatFeed.scrollTop = chatFeed.scrollHeight;

        } else if (payload.type === 'usage') {
            // Update token counters
            metricPrompt.textContent = payload.data.prompt_tokens || 0;
            metricOutput.textContent = payload.data.candidates_tokens || 0;
            metricThoughts.textContent = payload.data.thoughts_tokens || 0;
            
            // Reset active bubble state for next response
            activeAssistantMessageBubble = null;

        } else if (payload.type === 'error') {
            logger(`Tutor Error: ${payload.data}`);
            thinkingPanel.classList.remove('active-glowing');
            appendSystemMessage(`Error: ${payload.data}`);
            activeAssistantMessageBubble = null;
        }
    };

    socket.onclose = () => {
        logger("WebSocket closed. Reconnecting...");
        connectionIndicator.className = "status-indicator status-offline";
        connectionText.textContent = "Offline (Reconnecting...)";
        
        // Attempt reconnect with exponential backoff
        setTimeout(() => {
            reconnectInterval = Math.min(reconnectInterval * 2, 30000);
            connectWebSocket();
        }, reconnectInterval);
    };

    socket.onerror = (err) => {
        logger(`WebSocket Error: ${err}`);
        socket.close();
    };
}

// -----------------------------------------------------------------------------
// 2. Socratic Quiz Logic
// -----------------------------------------------------------------------------
async function fetchNewQuiz() {
    btnGenerateQuiz.disabled = true;
    btnGenerateQuiz.textContent = "Loading...";
    quizContainer.innerHTML = `<div class="empty-state"><p>Generating Socratic Quiz via Antigravity SDK...</p></div>`;
    socraticFeedbackCard.className = "socratic-feedback glass-card hidden";

    try {
        const response = await fetch(API_QUIZ_URL, { method: "POST" });
        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
        }
        const quizData = await response.json();
        
        activeQuizQuestions = quizData.questions || [];
        answeredCount = 0;
        currentQuestionIndex = 0;
        
        if (activeQuizQuestions.length > 0) {
            renderQuestion(0);
        } else {
            quizContainer.innerHTML = `<div class="empty-state"><p>No questions generated. Please try again.</p></div>`;
        }
    } catch (err) {
        logger(`Error loading quiz: ${err}`);
        quizContainer.innerHTML = `<div class="empty-state"><p>Failed to load quiz. Verify the backend service is running.</p></div>`;
    } finally {
        btnGenerateQuiz.disabled = false;
        btnGenerateQuiz.textContent = "Generate Quiz";
    }
}

function renderQuestion(index) {
    if (index >= activeQuizQuestions.length) {
        // Quiz completed state
        quizContainer.innerHTML = `
            <div class="quiz-card" style="text-align: center; padding: 2.5rem 1.5rem;">
                <h3 style="font-family: var(--font-outfit); font-size: 1.25rem; color: var(--accent-green); margin-bottom: 0.5rem;">Quiz Completed!</h3>
                <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.45;">
                    Excellent work reviewing these SDLC principles. You can ask follow-up questions to the Socratic Tutor on the right console.
                </p>
            </div>
        `;
        return;
    }

    const question = activeQuizQuestions[index];
    
    // Render question card
    quizContainer.innerHTML = `
        <div class="quiz-card" id="active-quiz-card">
            <p class="question-text">${question.question}</p>
            <div class="options-list">
                ${question.options.map((option, idx) => `
                    <div class="option-item">
                        <input type="radio" name="sdlc-option" id="opt-${idx}" value="${option}">
                        <label for="opt-${idx}" class="option-label">
                            <span class="radio-check"></span>
                            <span>${option}</span>
                        </label>
                    </div>
                `).join('')}
            </div>
            <button id="btn-submit-answer" class="btn btn-primary" style="margin-top: 0.5rem;">Submit Answer</button>
        </div>
    `;

    // Add event listener to submit button
    document.getElementById('btn-submit-answer').addEventListener('click', () => {
        const selected = document.querySelector('input[name="sdlc-option"]:checked');
        if (!selected) {
            alert("Please select an option first!");
            return;
        }
        submitAnswer(selected.value, question);
    });

    // Update progress tracker
    updateQuizProgress();
}

function submitAnswer(selectedValue, question) {
    const isCorrect = selectedValue === question.correct_answer;
    
    // Animate feedback card
    socraticFeedbackCard.className = `socratic-feedback glass-card ${isCorrect ? 'correct' : 'incorrect'}`;
    feedbackBadgeStatus.textContent = isCorrect ? "Correct" : "Incorrect";
    feedbackExplanation.textContent = question.explanation;
    
    // Smooth scroll to feedback card
    socraticFeedbackCard.scrollIntoView({ behavior: 'smooth' });

    // Lock options
    const inputs = document.querySelectorAll('input[name="sdlc-option"]');
    inputs.forEach(input => input.disabled = true);

    // Replace "Submit" with "Next Question" button
    const submitBtn = document.getElementById('btn-submit-answer');
    submitBtn.textContent = currentQuestionIndex === activeQuizQuestions.length - 1 ? "Finish" : "Next Question";
    
    // Clone and replace submit handler to go to next question
    const nextBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(nextBtn, submitBtn);

    nextBtn.addEventListener('click', () => {
        answeredCount++;
        currentQuestionIndex++;
        socraticFeedbackCard.className = "socratic-feedback glass-card hidden";
        renderQuestion(currentQuestionIndex);
        updateQuizProgress();
    });
}

function updateQuizProgress() {
    const total = activeQuizQuestions.length;
    quizProgressText.textContent = `${answeredCount} / ${total} Completed`;
    const percentage = total > 0 ? (answeredCount / total) * 100 : 0;
    quizProgressFill.style.width = `${percentage}%`;
}

// -----------------------------------------------------------------------------
// 3. Socratic Chat Assistant Logic
// -----------------------------------------------------------------------------
function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        appendSystemMessage("Tutor is offline. Attempting to reconnect, please wait...");
        return;
    }

    // Append User Message bubble
    appendMessage(message, 'user-message');
    
    // Reset thoughts board
    thinkingContent.innerHTML = "";
    
    // Send payload
    socket.send(JSON.stringify({ message: message }));
    
    chatInput.value = "";
}

function appendMessage(text, className) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${className}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;
    
    msgDiv.appendChild(bubble);
    chatFeed.appendChild(msgDiv);
    chatFeed.scrollTop = chatFeed.scrollHeight;
}

function appendSystemMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.style.background = 'rgba(239, 68, 68, 0.08)';
    bubble.style.color = 'var(--accent-red)';
    bubble.style.border = '1px solid rgba(239, 68, 68, 0.2)';
    bubble.style.alignSelf = 'center';
    bubble.textContent = text;
    
    msgDiv.appendChild(bubble);
    chatFeed.appendChild(msgDiv);
    chatFeed.scrollTop = chatFeed.scrollHeight;
}

// Toggle thoughts accordion
btnToggleThinking.addEventListener('click', () => {
    thinkingPanel.classList.toggle('expanded');
});

// Event Listeners
btnGenerateQuiz.addEventListener('click', fetchNewQuiz);
btnSendMessage.addEventListener('click', sendMessage);

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Utility Logger
function logger(msg) {
    console.log(`[SDLC_LEARNING_APP] ${msg}`);
}

// Initialize on page load
connectWebSocket();
logger("Application initialized.");
