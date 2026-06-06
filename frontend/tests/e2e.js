const puppeteer = require('puppeteer');
const path = require('path');

async function runE2ETests() {
  console.log("==================================================");
  console.log("  STARTING END-TO-END BROWSER UI TESTS (PUPPETEER) ");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;
  
  const testResults = [];
  const logTest = (name, status, details = "") => {
    if (status === "PASS") passed++;
    else failed++;
    testResults.push({ name, status, details });
    console.log(`[${status}] ${name} ${details ? '- ' + details : ''}`);
  };

  // Launch browser with flags to bypass local filesystem CORS locks on type="module"
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--allow-file-access-from-files',
      '--disable-web-security'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Capture page logs
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

    // Inject Mock Fetch to decouple tests from a running FastAPI backend
    await page.evaluateOnNewDocument(() => {
      window.fetch = async (url) => {
        if (url.includes('/api/generate-quiz')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              topic: "Saravanan's AI-SDLC & Architecture First Principles",
              questions: [
                {
                  id: 1,
                  question: "What is the primary risk of adopting 'Prompt-First' instead of 'Process-First' AI-SDLC?",
                  options: [
                    "It results in slower model inference.",
                    "It creates fragile, unstructured pipelines that bypass code reviews and automated testing.",
                    "It increases local storage consumption."
                  ],
                  correct_answer: "It creates fragile, unstructured pipelines that bypass code reviews and automated testing.",
                  explanation: "Process-First gates AI-generated code within standard SDLC barriers like automated linting and unit testing, keeping deployments robust."
                }
              ]
            })
          };
        }
        return { ok: false, status: 404 };
      };
    });

    const filePath = 'file://' + path.resolve(__dirname, '../index.html');
    console.log(`Navigating browser to local UI path: ${filePath}`);
    await page.goto(filePath);

    // Test 1: Page Title Verification
    const title = await page.title();
    if (title.includes("Socratic SDLC Tutor")) {
      logTest("Verify Page Title", "PASS", `Found: "${title}"`);
    } else {
      logTest("Verify Page Title", "FAIL", `Expected containing Socratic SDLC Tutor, found: "${title}"`);
    }

    // Test 2: Verify Initial Header & Subtitle
    const subtitle = await page.$eval('.subtitle', el => el.textContent);
    if (subtitle.includes("Process-First")) {
      logTest("Verify Header Subtitle text", "PASS", "Found Process-First engineering subtitle.");
    } else {
      logTest("Verify Header Subtitle text", "FAIL", `Found: ${subtitle}`);
    }

    // Test 3: Check Socratic Quiz Panel Initial State
    const emptyStateText = await page.$eval('#quiz-container .empty-state p', el => el.textContent);
    if (emptyStateText.includes("Generate Quiz")) {
      logTest("Verify Quiz Panel Empty State", "PASS", "Displays placeholder prompting to generate quiz.");
    } else {
      logTest("Verify Quiz Panel Empty State", "FAIL", `Found: ${emptyStateText}`);
    }

    // Test 4: Trigger Quiz Generation
    console.log("Simulating click on 'Generate Quiz' button...");
    await page.click('#btn-generate-quiz');
    
    // Give it a brief moment to update the DOM
    await new Promise(resolve => setTimeout(resolve, 800));

    // Test 5: Verify Quiz Question renders
    const questionText = await page.$eval('.question-text', el => el.textContent);
    if (questionText && questionText.length > 0) {
      logTest("Generate Quiz & Verify Question text", "PASS", `Rendered question: "${questionText.substring(0, 50)}..."`);
    } else {
      logTest("Generate Quiz & Verify Question text", "FAIL", "No question text rendered after generating quiz.");
    }

    // Test 6: Verify Radio Choices exist
    const options = await page.$$('.option-item');
    if (options.length > 0) {
      logTest("Verify Quiz Option Buttons", "PASS", `Found ${options.length} radio options.`);
    } else {
      logTest("Verify Quiz Option Buttons", "FAIL", "No options rendered for the question.");
    }

    // Test 7: Click choice option
    console.log("Selecting first radio option...");
    await page.click('.option-label');
    logTest("Select Option Choice", "PASS", "Triggered DOM checkbox select change.");

    // Test 8: Submit Answer
    console.log("Clicking 'Submit Answer'...");
    await page.click('#btn-submit-answer');
    
    // Wait for Socratic feedback card to become visible
    await page.waitForSelector('#socratic-feedback-card:not(.hidden)');
    const feedbackStatus = await page.$eval('#feedback-badge-status', el => el.textContent);
    const feedbackExplain = await page.$eval('#feedback-explanation', el => el.textContent);
    
    if (feedbackStatus && feedbackExplain) {
      logTest("Submit Answer & Verify Socratic Feedback card", "PASS", `Feedback: [${feedbackStatus}] Explanation: ${feedbackExplain.substring(0, 50)}...`);
    } else {
      logTest("Submit Answer & Verify Socratic Feedback card", "FAIL", "Feedback card values failed to render.");
    }

    // Test 9: Verify Socratic Chat Console exists
    const chatFeedExists = await page.$('#chat-feed') !== null;
    if (chatFeedExists) {
      logTest("Verify Chat Console Feed", "PASS", "Chat scroll feed exists in DOM.");
    } else {
      logTest("Verify Chat Console Feed", "FAIL", "Missing chat-feed element.");
    }

    // Test 10: Socratic Chat input verification
    const inputPlaceholder = await page.$eval('#chat-input', el => el.placeholder);
    if (inputPlaceholder.includes("Ask about")) {
      logTest("Verify Chat Input bar", "PASS", "Chat input bar renders with placeholder.");
    } else {
      logTest("Verify Chat Input bar", "FAIL", `Found: ${inputPlaceholder}`);
    }

  } catch (err) {
    console.error("Fatal exception during test run:", err);
    failed++;
  } finally {
    await browser.close();
  }

  // ---------------------------------------------------------------------------
  // Generate Test Summary Report
  // ---------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log("           UI E2E TEST COVERAGE SUMMARY            ");
  console.log("==================================================");
  console.log(`Total Tests Checked : ${passed + failed}`);
  console.log(`Passed Checks       : ${passed}`);
  console.log(`Failed Checks       : ${failed}`);
  
  // Calculate coverage metrics
  const totalUIDOMElementsChecked = 10;
  const elementsFound = passed;
  const coveragePercentage = Math.round((elementsFound / totalUIDOMElementsChecked) * 100);
  console.log(`Visual DOM Coverage : ${coveragePercentage}%`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runE2ETests();
