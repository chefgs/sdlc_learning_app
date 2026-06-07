/**
 * E2E UI Test Suite — Socratic SDLC Tutor Chat (Live Backend)
 * 
 * Tests the full stack: Vite frontend @ localhost:5173 <-> FastAPI backend @ localhost:8000
 * Puppeteer drives the real browser. WebSocket connections are NOT mocked.
 * 
 * Run: node frontend/tests/e2e_chat.js
 */

const puppeteer = require('puppeteer');

const FRONTEND_URL = 'http://localhost:5173';
const CHAT_TIMEOUT_MS = 30000;  // max wait for a real AI reply to stream in

// ─── Helpers ───────────────────────────────────────────────────────────────

async function waitForText(page, selector, expectedSubstring, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const text = await page.$eval(selector, el => el.textContent || el.innerText);
      if (text.includes(expectedSubstring)) return text;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`Timeout: "${expectedSubstring}" not found in ${selector} after ${timeoutMs}ms`);
}

async function waitForSelector(page, selector, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = await page.$(selector);
    if (el) return el;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Timeout: selector "${selector}" not found after ${timeoutMs}ms`);
}

// ─── Test Runner ───────────────────────────────────────────────────────────

async function runChatE2ETests() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║      SOCRATIC TUTOR CHAT — END-TO-END UI TEST SUITE          ║');
  console.log('║  Frontend: http://localhost:5173   Backend: localhost:8000    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  let passed = 0;
  let failed = 0;
  const results = [];

  const log = (name, status, detail = '') => {
    const icon = status === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon} [${status}] ${name}${detail ? ' — ' + detail : ''}`);
    if (status === 'PASS') passed++;
    else failed++;
    results.push({ name, status, detail });
  };

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 900 }
  });

  try {
    const page = await browser.newPage();

    // Capture browser console and errors for debugging
    const browserLogs = [];
    const browserErrors = [];
    page.on('console', msg => {
      const text = msg.text();
      browserLogs.push(text);
      if (msg.type() === 'error') console.log('  [BROWSER ERR]', text);
    });
    page.on('pageerror', err => {
      browserErrors.push(err.toString());
      console.log('  [PAGE ERROR]', err.toString());
    });

    // ── Track WebSocket frames ──────────────────────────────────────────────
    const wsFrames = { thought: [], token: [], usage: [], error: [] };
    let wsConnected = false;

    await page.exposeFunction('__recordWsFrame', (type, data) => {
      if (wsFrames[type]) wsFrames[type].push(data);
    });

    // ── Navigate to the app ────────────────────────────────────────────────
    console.log('\n━━━ Phase 1: Page Load ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0', timeout: 15000 });

    // TEST 1: Page Title
    const title = await page.title();
    title.includes('Socratic SDLC Tutor')
      ? log('Page title correct', 'PASS', title)
      : log('Page title correct', 'FAIL', `Got: "${title}"`);

    // TEST 2: Header renders
    const h1 = await page.$eval('#main-title', el => el.textContent);
    h1.includes('Socratic')
      ? log('Main header renders', 'PASS', h1.trim())
      : log('Main header renders', 'FAIL', `Got: "${h1}"`);

    // TEST 3: Chat feed exists and has welcome message
    const initialMsg = await page.$eval('#chat-feed .message-bubble', el => el.textContent);
    initialMsg.length > 10
      ? log('Welcome message present in chat feed', 'PASS', initialMsg.substring(0, 60) + '…')
      : log('Welcome message present in chat feed', 'FAIL', 'No initial message found');

    // TEST 4: Chat input is interactive
    const inputEnabled = await page.$eval('#chat-input', el => !el.disabled);
    inputEnabled
      ? log('Chat input field is enabled', 'PASS')
      : log('Chat input field is enabled', 'FAIL', 'Input is disabled');

    // ── Wait for WebSocket connection ─────────────────────────────────────
    console.log('\n━━━ Phase 2: WebSocket Connection ━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  ⏳ Waiting for backend WebSocket handshake (up to 10s)…');

    try {
      await waitForText(page, '#connection-text', 'Connected', 10000);
      wsConnected = true;
      log('WebSocket connects to backend', 'PASS', 'Status indicator shows "Connected"');
    } catch (e) {
      const connText = await page.$eval('#connection-text', el => el.textContent).catch(() => 'unknown');
      log('WebSocket connects to backend', 'FAIL', `Connection text: "${connText}"`);
    }

    // TEST 5: Connection indicator is green (online)
    const indicatorClass = await page.$eval('#connection-indicator', el => el.className);
    indicatorClass.includes('status-online')
      ? log('Connection indicator is green (online)', 'PASS')
      : log('Connection indicator is green (online)', 'FAIL', `Classes: ${indicatorClass}`);

    // ── Send a chat message and verify streaming response ─────────────────
    console.log('\n━━━ Phase 3: Socratic Tutor Chat — Live AI Response ━━━━━━━━━');
    const testQuestion = 'What is Process-First AI development?';
    console.log(`  📤 Sending question: "${testQuestion}"`);

    await page.click('#chat-input');
    await page.type('#chat-input', testQuestion, { delay: 30 });

    // TEST 6: Input received the typed text
    const inputValue = await page.$eval('#chat-input', el => el.value);
    inputValue === testQuestion
      ? log('Chat input accepts typed text', 'PASS')
      : log('Chat input accepts typed text', 'FAIL', `Got: "${inputValue}"`);

    // Count messages before sending
    const msgsBefore = await page.$$('.message');
    const countBefore = msgsBefore.length;

    // Click Send
    await page.click('#btn-send-message');
    console.log('  📨 Send button clicked — waiting for streamed reply…');

    // TEST 7: User message bubble appears immediately
    await new Promise(r => setTimeout(r, 500));
    const userBubble = await page.$('.user-message .message-bubble');
    const userBubbleText = userBubble ? await page.$eval('.user-message .message-bubble', el => el.textContent) : '';
    userBubbleText.includes('Process-First')
      ? log('User message bubble rendered', 'PASS', `"${userBubbleText.substring(0, 50)}…"`)
      : log('User message bubble rendered', 'FAIL', `Got: "${userBubbleText}"`);

    // TEST 8: Input cleared after send
    const inputAfterSend = await page.$eval('#chat-input', el => el.value);
    inputAfterSend === ''
      ? log('Chat input cleared after send', 'PASS')
      : log('Chat input cleared after send', 'FAIL', `Still shows: "${inputAfterSend}"`);

    // TEST 9: Thinking panel activates (reasoning tokens)
    console.log(`  ⏳ Waiting up to ${CHAT_TIMEOUT_MS/1000}s for AI to respond…`);
    let thinkingActivated = false;
    try {
      const start = Date.now();
      while (Date.now() - start < 20000) {
        const thinkingClass = await page.$eval('#thinking-panel', el => el.className);
        if (thinkingClass.includes('expanded') || thinkingClass.includes('active-glowing')) {
          thinkingActivated = true;
          break;
        }
        await new Promise(r => setTimeout(r, 400));
      }
    } catch (_) {}
    thinkingActivated
      ? log('Thinking panel activated during AI reasoning', 'PASS', 'Panel expanded with thought tokens')
      : log('Thinking panel activated during AI reasoning', 'FAIL', 'Panel never expanded — no thought tokens received');

    // TEST 10: Assistant reply bubble appears with streamed content
    let assistantReplyText = '';
    let replyRendered = false;
    try {
      const start = Date.now();
      while (Date.now() - start < CHAT_TIMEOUT_MS) {
        const allBubbles = await page.$$('.assistant-message .message-bubble');
        // Skip the first welcome bubble — we want the new response
        if (allBubbles.length > 1) {
          assistantReplyText = await page.$eval(
            '.assistant-message:last-child .message-bubble',
            el => el.textContent || el.innerText
          );
          if (assistantReplyText && assistantReplyText.trim().length > 20) {
            replyRendered = true;
            break;
          }
        }
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (e) {
      console.log('  ⚠️  Error checking reply:', e.message);
    }

    replyRendered
      ? log('AI reply streams into chat bubble', 'PASS', `"${assistantReplyText.substring(0, 80)}…"`)
      : log('AI reply streams into chat bubble', 'FAIL', 'No assistant reply appeared within timeout');

    // TEST 11: Reply contains Markdown (rendered as HTML, not raw **text**)
    if (replyRendered) {
      const bubbleHTML = await page.$eval(
        '.assistant-message:last-child .message-bubble',
        el => el.innerHTML
      );
      const hasMarkdownHTML = /<(strong|em|ul|ol|li|p|h[1-6]|code|pre|blockquote)/.test(bubbleHTML);
      hasMarkdownHTML
        ? log('Markdown rendered as HTML (not raw text)', 'PASS', 'Found HTML tags: bold/lists/code/paragraphs')
        : log('Markdown rendered as HTML (not raw text)', 'FAIL', 'Only plain text found — marked.js may not be running');
    } else {
      log('Markdown rendered as HTML (not raw text)', 'SKIP', 'No reply to inspect');
    }

    // TEST 12: Token usage counters update
    let usageUpdated = false;
    try {
      const start = Date.now();
      while (Date.now() - start < CHAT_TIMEOUT_MS) {
        const promptTokens = await page.$eval('#metric-prompt', el => el.textContent);
        const outputTokens = await page.$eval('#metric-output', el => el.textContent);
        if (parseInt(promptTokens) > 0 && parseInt(outputTokens) > 0) {
          usageUpdated = true;
          const thoughts = await page.$eval('#metric-thoughts', el => el.textContent);
          log('Token usage counters update', 'PASS',
            `Prompt: ${promptTokens} | Output: ${outputTokens} | Thoughts: ${thoughts}`);
          break;
        }
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (_) {}
    if (!usageUpdated) {
      log('Token usage counters update', 'FAIL', 'Counters stayed at 0 — usage frame not received');
    }

    // TEST 13: No error frames appear
    const errorMsgEl = await page.$('.message[data-type="error"]');
    !errorMsgEl
      ? log('No error messages in chat', 'PASS')
      : log('No error messages in chat', 'FAIL', 'Error message element found in DOM');

    // ── Second message to verify conversation continuity ─────────────────
    console.log('\n━━━ Phase 4: Conversation Continuity ━━━━━━━━━━━━━━━━━━━━━━━');
    const followUpQ = 'Can you give me an example from this codebase?';
    console.log(`  📤 Sending follow-up: "${followUpQ}"`);

    await page.click('#chat-input');
    await page.type('#chat-input', followUpQ, { delay: 30 });
    await page.click('#btn-send-message');

    let followUpRendered = false;
    try {
      const start = Date.now();
      const bubblesBeforeFollowUp = await page.$$('.assistant-message .message-bubble');
      const countBeforeFollowUp = bubblesBeforeFollowUp.length;

      while (Date.now() - start < CHAT_TIMEOUT_MS) {
        const allAssistantBubbles = await page.$$('.assistant-message .message-bubble');
        if (allAssistantBubbles.length > countBeforeFollowUp) {
          const newBubbleText = await page.$eval(
            '.assistant-message:last-child .message-bubble',
            el => el.textContent
          );
          if (newBubbleText && newBubbleText.trim().length > 20) {
            followUpRendered = true;
            log('Follow-up response renders (conversation continuity)', 'PASS',
              `"${newBubbleText.substring(0, 80)}…"`);
            break;
          }
        }
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (e) {
      console.log('  ⚠️  Follow-up check error:', e.message);
    }
    if (!followUpRendered) {
      log('Follow-up response renders (conversation continuity)', 'FAIL', 'No second reply appeared');
    }

    // ── Summary ────────────────────────────────────────────────────────────
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    TEST RESULTS SUMMARY                      ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Total Tests  : ${String(passed + failed).padEnd(43)}║`);
    console.log(`║  ✅ Passed    : ${String(passed).padEnd(43)}║`);
    console.log(`║  ❌ Failed    : ${String(failed).padEnd(43)}║`);
    const pct = Math.round((passed / (passed + failed)) * 100);
    console.log(`║  Coverage     : ${String(pct + '%').padEnd(43)}║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    results.forEach(r => {
      const icon = r.status === 'PASS' ? '✅' : '❌';
      const line = `  ${icon} ${r.name}`;
      console.log(`║  ${line.substring(0, 60).padEnd(60)}║`);
    });
    console.log('╚══════════════════════════════════════════════════════════════╝');

    if (browserErrors.length > 0) {
      console.log('\n⚠️  Browser errors encountered during test:');
      browserErrors.forEach(e => console.log('   -', e));
    }

  } catch (fatalErr) {
    console.error('\n💥 Fatal error during test run:', fatalErr);
    failed++;
  } finally {
    await browser.close();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runChatE2ETests().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
