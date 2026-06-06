import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

// Custom Colors matching DevOps-OS dark style
const COLORS = {
  bgDark: '#090615',
  cardBg: '#15102a',
  border: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#f3f4f6',
  textSecondary: '#9ca3af',
  accentViolet: '#8b5cf6',
  accentBlue: '#3b82f6',
  accentGreen: '#10b981',
  accentRed: '#ef4444',
};

// -----------------------------------------------------------------------------
// 1. Types & Default Fallbacks
// -----------------------------------------------------------------------------
interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

const DEFAULT_QUIZ: QuizQuestion[] = [
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
  },
  {
    id: 2,
    question: "What does the 'Architecture-First' AI Development principle advocate for?",
    options: [
      "Writing the largest prompts possible to get perfect code output.",
      "Selecting the most expensive LLMs before looking at model size.",
      "Establishing system components, data flows, and security boundaries before generating code."
    ],
    correct_answer: "Establishing system components, data flows, and security boundaries before generating code.",
    explanation: "Architecture-First guarantees AI builds within secure, structured rails rather than producing ad-hoc technical debt."
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'quiz' | 'framework'>('chat');
  const [backendIp, setBackendIp] = useState<string>('192.168.1.100'); // Let user type their local computer IP
  
  // ---------------------------------------------------------------------------
  // A. WebSocket Chat State
  // ---------------------------------------------------------------------------
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([
    { text: "Welcome to Socratic SDLC Mobile Tutor! Ask me questions about AI App Development.", isUser: false }
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [thoughts, setThoughts] = useState<string>('');
  const [responseText, setResponseText] = useState<string>('');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState<boolean>(false);
  const [metrics, setMetrics] = useState({ prompt: 0, output: 0, thoughts: 0 });
  
  const wsRef = useRef<WebSocket | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `ws://${backendIp}:8000/ws/tutor`;
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setIsConnected(true);
        console.log("WebSocket connected.");
      };

      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);

        if (payload.type === 'thought') {
          setThoughts(prev => prev + payload.data);
        } else if (payload.type === 'token') {
          setResponseText(prev => prev + payload.data);
        } else if (payload.type === 'tool_start') {
          setActiveTool(payload.data);
        } else if (payload.type === 'tool_end') {
          setActiveTool(null);
        } else if (payload.type === 'usage') {
          setMetrics({
            prompt: payload.data.prompt_tokens || 0,
            output: payload.data.candidates_tokens || 0,
            thoughts: payload.data.thoughts_tokens || 0,
          });
          
          // Complete message streaming transition
          const completedText = responseText;
          setMessages(prev => [...prev, { text: completedText, isUser: false }]);
          setResponseText('');
          setThoughts('');
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log("WebSocket disconnected.");
      };

      ws.onerror = (e) => {
        console.log("WebSocket Error:", e);
      };

      wsRef.current = ws;
    } catch (err) {
      console.log("Connection failed", err);
    }
  }, [backendIp, responseText]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const sendChatMessage = () => {
    if (!inputText.trim()) return;
    if (!isConnected) {
      alert("Tutor is offline. Set correct backend IP and check connection.");
      return;
    }

    const text = inputText;
    setMessages(prev => [...prev, { text, isUser: true }]);
    setInputText('');
    setThoughts('');
    setResponseText('');

    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ message: text }));
    }
  };

  // ---------------------------------------------------------------------------
  // B. SDLC Quiz State
  // ---------------------------------------------------------------------------
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(DEFAULT_QUIZ);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [answeredCount, setAnsweredCount] = useState<number>(0);

  const fetchQuiz = async () => {
    try {
      const res = await fetch(`http://${backendIp}:8000/api/generate-quiz`, { method: 'POST' });
      const data = await res.json();
      if (data.questions) {
        setQuizQuestions(data.questions);
        setCurrentQuestionIdx(0);
        setSelectedOption(null);
        setShowFeedback(false);
        setAnsweredCount(0);
      }
    } catch (e) {
      alert("Failed fetching online quiz. Using offline default questions.");
    }
  };

  const submitAnswer = () => {
    if (!selectedOption) {
      alert("Select an option first.");
      return;
    }
    setShowFeedback(true);
  };

  const nextQuestion = () => {
    setAnsweredCount(prev => prev + 1);
    setCurrentQuestionIdx(prev => prev + 1);
    setSelectedOption(null);
    setShowFeedback(false);
  };

  // ---------------------------------------------------------------------------
  // C. AI Product Decision Framework Checklist State
  // ---------------------------------------------------------------------------
  const [frameworkSteps, setFrameworkSteps] = useState([
    { id: 1, text: "Feasibility: Checked if LLM is actually required vs a simple script.", checked: false },
    { id: 2, text: "Architecture: Mapped system components and dependencies.", checked: false },
    { id: 3, text: "Interface: Chose RAG, simple API, or full Agentic system.", checked: false },
    { id: 4, text: "Security: Checked data boundaries & compliant tunnels.", checked: false },
    { id: 5, text: "Cost: Tracked latency & reasoning token budgets.", checked: false },
  ]);

  const toggleCheck = (id: number) => {
    setFrameworkSteps(prev =>
      prev.map(step => (step.id === id ? { ...step, checked: !step.checked } : step))
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Socratic SDLC Tutor</Text>
        <View style={styles.connectionBadge}>
          <View style={[styles.indicatorCircle, isConnected ? styles.bgGreen : styles.bgRed]} />
          <Text style={styles.indicatorText}>{isConnected ? "Online" : "Offline"}</Text>
        </View>
      </View>

      {/* Backend IP Config (Beginner-friendly helper) */}
      <View style={styles.ipConfigBar}>
        <Text style={styles.ipLabel}>Backend IP:</Text>
        <TextInput
          style={styles.ipInput}
          value={backendIp}
          onChangeText={setBackendIp}
          placeholder="e.g. 192.168.1.100"
          placeholderTextColor="#9ca3af"
        />
        <TouchableOpacity style={styles.btnConnect} onPress={connectWebSocket}>
          <Text style={styles.btnConnectText}>Connect</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'chat' && styles.tabActive]}
          onPress={() => setActiveTab('chat')}
        >
          <Text style={[styles.tabText, activeTab === 'chat' && styles.textWhite]}>Socratic Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'quiz' && styles.tabActive]}
          onPress={() => setActiveTab('quiz')}
        >
          <Text style={[styles.tabText, activeTab === 'quiz' && styles.textWhite]}>SDLC Quiz</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'framework' && styles.tabActive]}
          onPress={() => setActiveTab('framework')}
        >
          <Text style={[styles.tabText, activeTab === 'framework' && styles.textWhite]}>AI Framework</Text>
        </TouchableOpacity>
      </View>

      {/* Workspace Panel */}
      <KeyboardAvoidingView
        style={styles.workspace}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {activeTab === 'chat' && (
          <View style={styles.tabContent}>
            {/* Metrics */}
            <View style={styles.metricsRow}>
              <Text style={styles.metricText}>Prompt: {metrics.prompt}</Text>
              <Text style={styles.metricText}>Output: {metrics.output}</Text>
              <Text style={styles.metricText}>Thoughts: {metrics.thoughts}</Text>
            </View>

            <ScrollView
              ref={scrollViewRef}
              style={styles.chatFeed}
              contentContainerStyle={{ paddingBottom: 20 }}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.map((msg, idx) => (
                <View key={idx} style={[styles.msgContainer, msg.isUser ? styles.msgAlignRight : styles.msgAlignLeft]}>
                  <View style={[styles.msgBubble, msg.isUser ? styles.msgUser : styles.msgAssistant]}>
                    <Text style={styles.msgText}>{msg.text}</Text>
                  </View>
                </View>
              ))}

              {/* Streaming responses */}
              {responseText ? (
                <View style={[styles.msgContainer, styles.msgAlignLeft]}>
                  <View style={[styles.msgBubble, styles.msgAssistant]}>
                    <Text style={styles.msgText}>{responseText}</Text>
                  </View>
                </View>
              ) : null}
            </ScrollView>

            {/* Active Tool Run */}
            {activeTool && (
              <View style={styles.toolBar}>
                <ActivityIndicator size="small" color={COLORS.accentBlue} />
                <Text style={styles.toolText}>Running Tool: {activeTool}...</Text>
              </View>
            )}

            {/* Collapsible Thoughts Accordion */}
            {thoughts ? (
              <View style={styles.thoughtsPanel}>
                <TouchableOpacity
                  style={styles.thoughtsHeader}
                  onPress={() => setIsThinkingExpanded(!isThinkingExpanded)}
                >
                  <Text style={styles.thoughtsTitle}>💡 Tutor Reasoning process ({isThinkingExpanded ? "Hide" : "Show"})</Text>
                </TouchableOpacity>
                {isThinkingExpanded && (
                  <ScrollView style={styles.thoughtsBody} nestedScrollEnabled>
                    <Text style={styles.thoughtsText}>{thoughts}</Text>
                  </ScrollView>
                )}
              </View>
            ) : null}

            {/* Chat Input */}
            <View style={styles.inputBar}>
              <TextInput
                style={styles.chatInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask your tutor about AI architecture..."
                placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity style={styles.btnSend} onPress={sendChatMessage}>
                <Text style={styles.btnSendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'quiz' && (
          <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingBottom: 30 }}>
            <View style={styles.quizHeader}>
              <Text style={styles.quizTitle}>SDLC Practice Quiz</Text>
              <TouchableOpacity style={styles.btnFetchQuiz} onPress={fetchQuiz}>
                <Text style={styles.btnFetchQuizText}>Generate New</Text>
              </TouchableOpacity>
            </View>

            {/* Progress Tracker */}
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Question {currentQuestionIdx + 1} of {quizQuestions.length}</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(answeredCount / quizQuestions.length) * 100}%` }]} />
              </View>
            </View>

            {currentQuestionIdx < quizQuestions.length ? (
              <View style={styles.quizCard}>
                <Text style={styles.quizQuestionText}>{quizQuestions[currentQuestionIdx].question}</Text>
                
                {/* Options */}
                {quizQuestions[currentQuestionIdx].options.map((opt, i) => {
                  const isSelected = selectedOption === opt;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.quizOptionBtn, isSelected && styles.quizOptionBtnActive]}
                      onPress={() => !showFeedback && setSelectedOption(opt)}
                      disabled={showFeedback}
                    >
                      <View style={[styles.quizRadio, isSelected && styles.quizRadioActive]} />
                      <Text style={styles.quizOptionText}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Socratic Feedback */}
                {showFeedback && (
                  <View style={[
                    styles.feedbackCard, 
                    selectedOption === quizQuestions[currentQuestionIdx].correct_answer ? styles.borderGreen : styles.borderRed
                  ]}>
                    <Text style={styles.feedbackTitle}>
                      {selectedOption === quizQuestions[currentQuestionIdx].correct_answer ? "✅ Correct choice!" : "❌ Incorrect"}
                    </Text>
                    <Text style={styles.feedbackExplain}>{quizQuestions[currentQuestionIdx].explanation}</Text>
                  </View>
                )}

                {/* Action Button */}
                {!showFeedback ? (
                  <TouchableOpacity style={styles.btnSubmitQuiz} onPress={submitAnswer}>
                    <Text style={styles.btnSubmitQuizText}>Submit Answer</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.btnSubmitQuiz} onPress={
                    currentQuestionIdx === quizQuestions.length - 1 ? fetchQuiz : nextQuestion
                  }>
                    <Text style={styles.btnSubmitQuizText}>
                      {currentQuestionIdx === quizQuestions.length - 1 ? "Start Over" : "Next Question"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.completedCard}>
                <Text style={styles.completedText}>Quiz complete! Click Generate New to fetch more.</Text>
              </View>
            )}
          </ScrollView>
        )}

        {activeTab === 'framework' && (
          <ScrollView style={styles.tabContent} contentContainerStyle={{ padding: 15 }}>
            <Text style={styles.frameworkTitle}>AI Product Decision Framework</Text>
            <Text style={styles.frameworkDesc}>
              A step-by-step checklist to ensure you execute correct design and analysis decisions for your AI projects.
            </Text>

            {frameworkSteps.map((step) => (
              <TouchableOpacity
                key={step.id}
                style={[styles.checkItem, step.checked && styles.checkItemChecked]}
                onPress={() => toggleCheck(step.id)}
              >
                <View style={[styles.checkBox, step.checked && styles.checkBoxActive]}>
                  {step.checked && <Text style={styles.checkIcon}>✓</Text>}
                </View>
                <Text style={[styles.checkText, step.checked && styles.textChecked]}>{step.text}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------------
// Stylesheet
// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  indicatorCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bgGreen: {
    backgroundColor: COLORS.accentGreen,
  },
  bgRed: {
    backgroundColor: COLORS.accentRed,
  },
  indicatorText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  ipConfigBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  ipLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  ipInput: {
    flex: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    color: COLORS.textPrimary,
    fontSize: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnConnect: {
    backgroundColor: COLORS.accentViolet,
    paddingHorizontal: 12,
    height: 32,
    justifyContent: 'center',
    borderRadius: 6,
  },
  btnConnectText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accentViolet,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  textWhite: {
    color: COLORS.textPrimary,
  },
  workspace: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  metricText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  chatFeed: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  msgContainer: {
    marginVertical: 6,
    width: '100%',
  },
  msgAlignLeft: {
    alignItems: 'flex-start',
  },
  msgAlignRight: {
    alignItems: 'flex-end',
  },
  msgBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 12,
  },
  msgUser: {
    backgroundColor: COLORS.accentViolet,
    borderBottomRightRadius: 2,
  },
  msgAssistant: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 2,
  },
  msgText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  toolBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(59, 130, 246, 0.2)',
    gap: 8,
  },
  toolText: {
    fontSize: 12,
    color: '#60a5fa',
  },
  thoughtsPanel: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: 'rgba(9, 6, 21, 0.85)',
  },
  thoughtsHeader: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  thoughtsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#a78bfa',
  },
  thoughtsBody: {
    maxHeight: 100,
    padding: 10,
  },
  thoughtsText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#c084fc',
    lineHeight: 15,
  },
  inputBar: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bgDark,
    gap: 8,
  },
  chatInput: {
    flex: 1,
    height: 40,
    backgroundColor: COLORS.cardBg,
    borderRadius: 8,
    color: COLORS.textPrimary,
    paddingHorizontal: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnSend: {
    backgroundColor: COLORS.accentViolet,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  btnSendText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  quizTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  btnFetchQuiz: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnFetchQuizText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  progressRow: {
    paddingHorizontal: 15,
    marginBottom: 15,
    gap: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accentViolet,
  },
  quizCard: {
    backgroundColor: COLORS.cardBg,
    marginHorizontal: 15,
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  quizQuestionText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  quizOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  quizOptionBtnActive: {
    borderColor: COLORS.accentViolet,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  quizRadio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
  },
  quizRadioActive: {
    borderColor: COLORS.accentViolet,
    backgroundColor: COLORS.accentViolet,
  },
  quizOptionText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
  },
  feedbackCard: {
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    marginVertical: 5,
  },
  borderGreen: {
    borderLeftColor: COLORS.accentGreen,
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  borderRed: {
    borderLeftColor: COLORS.accentRed,
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
  },
  feedbackTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  feedbackExplain: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  btnSubmitQuiz: {
    backgroundColor: COLORS.accentViolet,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  btnSubmitQuizText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  completedCard: {
    backgroundColor: COLORS.cardBg,
    marginHorizontal: 15,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  completedText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  frameworkTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  frameworkDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 20,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    gap: 12,
  },
  checkItemChecked: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.02)',
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBoxActive: {
    borderColor: COLORS.accentGreen,
    backgroundColor: COLORS.accentGreen,
  },
  checkIcon: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
    lineHeight: 17,
  },
  textChecked: {
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
  },
});
