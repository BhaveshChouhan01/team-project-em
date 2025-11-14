// =====================
// Chunk A (TOP SECTION)
// =====================
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Send,
  Mic,
  Image as ImageIcon,
  Settings,
  Plus,
  BookOpen,
  Globe,
  Brain,
  Users,
  Bookmark,
  Download,
  Moon,
  Sun,
  MoreVertical,
  Pin,
  Archive,
  Edit3,
  Trash2,
  Copy,
  Share,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  RefreshCw,
  Zap,
  MessageSquare,
  User,
  Bot,
  Clock,
  Star,
  Filter,
  Layers,
  TrendingUp,
  FileText,
  Camera,
  Video,
  Code,
  Map,
  Shield,
  Heart,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  AlertCircle,
  Info,
  Lightbulb,
} from "lucide-react";

/**
 * ✅ UPDATED: Helper to create a conversation in the DB.
 * We now send "firstMessage" → backend auto-generates title.
 */
async function createConversationInDB(firstMessage) {
  try {
    const res = await fetch("/api/conversations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstMessage }), // ✅ updated
    });

    const json = await res.json();

    if (!json?.success) {
      console.error("Conversation creation failed:", json?.error);
      throw new Error(json?.error || "Failed to create conversation");
    }

    return json.data?._id; // MongoDB ObjectId
  } catch (err) {
    console.error("createConversationInDB error:", err.message);
    return null;
  }
}

async function saveMessageToDB({ conversationId, role, content }) {
  try {
    if (!conversationId) throw new Error("Missing conversationId when saving message");
    const res = await fetch("/api/messages", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, role, content }),
    });
    const json = await res.json();
    if (!json?.success) console.warn("saveMessageToDB failed:", json?.error);
    return json?.success ? json.data : null;
  } catch (err) {
    console.error("saveMessageToDB error:", err);
    return null;
  }
}

const mapDBMessageToUI = (msg) => ({
  id: msg?._id?.toString?.() || `${msg?._id}`,
  type: msg?.role === "user" ? "user" : "assistant",
  content: msg?.content || "",
  timestamp: msg?.createdAt ? new Date(msg.createdAt) : new Date(),
});

const ConversationalAIPlatform = () => {
  // ===== App State =====
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [wsConnection, setWsConnection] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);

  const [userProfile] = useState({
    name: "Team B",
    preferences: { tone: "professional", language: "english", expertise: "technology" },
    memory: {
      facts: ["Prefers detailed explanations", "AI enthusiast"],
      preferences: ["Professional tone"],
      context: ["Developer"],
    },
  });

  const [agents, setAgents] = useState([
    { id: "general", name: "General Assistant", icon: Bot, active: true, specialty: "General queries and conversations" },
    { id: "research", name: "Research Analyst", icon: Search, active: false, specialty: "Deep research and fact-checking" },
    { id: "code", name: "Code Assistant", icon: Code, active: false, specialty: "Programming and development" },
    { id: "travel", name: "Travel Planner", icon: Map, active: false, specialty: "Travel planning and recommendations" },
    { id: "tutor", name: "Learning Tutor", icon: BookOpen, active: false, specialty: "Educational content and tutoring" },
  ]);

  const agentPrompts = {
    general: "You are a helpful assistant providing clear and professional responses.",
    research: "You are a research analyst. Focus on detailed, evidence-based, and fact-checked answers.",
    code: "You are a code assistant. Provide clean, efficient, and well-commented code solutions.",
    travel: "You are a travel planner. Give practical travel advice, itineraries, and tips.",
    tutor: "You are a learning tutor. Explain concepts clearly with examples and step-by-step guidance.",
  };

  const [liveFeatures, setLiveFeatures] = useState({
    factCheck: true,
    webSearch: true,
    trending: true,
    citations: true,
    biasDetection: true,
  });

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // ===============================
  // Load Conversations (unchanged)
  // ===============================

  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "GET",
        credentials: "include",
      });

      const json = await res.json();

      if (!json?.success) {
        throw new Error(json?.error || "Failed to fetch conversations");
      }

      const defaultAgentId =
        agents.find((agent) => agent.id === "general")?.id ||
        agents[0]?.id ||
        "general";

      const conversationsFromDB = await Promise.all(
        (json.data || []).map(async (conv) => {
          try {
            const messagesRes = await fetch(`/api/messages?conversationId=${conv._id}`, {
              method: "GET",
              credentials: "include",
            });

            const messagesJson = await messagesRes.json();
            const messages =
              messagesJson?.success && Array.isArray(messagesJson.data)
                ? messagesJson.data.map(mapDBMessageToUI)
                : [];

            const lastActiveSource =
              conv.lastMessageAt ||
              conv.updatedAt ||
              (messages.length
                ? messages[messages.length - 1].timestamp
                : null);

            return {
              id: conv._id,
              title: conv.title || "New Conversation",
              agent: conv.agent || defaultAgentId,
              messages,
              lastActive: lastActiveSource
                ? new Date(lastActiveSource)
                : new Date(),
              pinned: false,
              tags: [],
            };
          } catch (error) {
            const fallbackLastActive = conv.updatedAt
              ? new Date(conv.updatedAt)
              : new Date();
            return {
              id: conv._id,
              title: conv.title || "New Conversation",
              agent: conv.agent || defaultAgentId,
              messages: [],
              lastActive: fallbackLastActive,
              pinned: false,
              tags: [],
            };
          }
        })
      );

      const sortedConversations = conversationsFromDB.sort(
        (a, b) =>
          new Date(b.lastActive).getTime() -
          new Date(a.lastActive).getTime()
      );

      setConversations(sortedConversations);
      setActiveConversation((prev) => {
        if (prev) {
          const existing = sortedConversations.find(
            (conv) => conv.id === prev.id
          );
          if (existing) return existing;
        }
        return sortedConversations[0] || null;
      });
    } catch (error) {
      console.error("loadConversations error:", error);
      setConversations([]);
      setActiveConversation(null);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [agents]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // ====================
  // WebSocket (unchanged)
  // ====================

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket("ws://localhost:8765");

        ws.onopen = () => {
          setConnectionStatus("connected");
          setWsConnection(ws);
        };

        ws.onmessage = (event) => {
          try {
            const response = JSON.parse(event.data);
            handleWebSocketResponse(response);
          } catch (error) {}
        };

        ws.onclose = () => {
          setConnectionStatus("disconnected");
          setWsConnection(null);
          setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          setConnectionStatus("error");
        };
      } catch {
        setConnectionStatus("error");
        setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      if (wsConnection) wsConnection.close();
    };
  }, []);

  // =====================
  // AI Response Handler
  // =====================
  const handleWebSocketResponse = useCallback(
    (response) => {
      const aiResponse = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: response.content,
        timestamp: new Date(),
        agent: agents.find((a) => a.active)?.id || "general",
        sources: response.sources || [],
        factCheck: {
          verified: true,
          confidence: response.confidence || 0.5,
        },
        method: response.method,
      };

      if (activeConversation?.id && response?.content) {
        saveMessageToDB({
          conversationId: activeConversation.id,
          role: "assistant",
          content: response.content,
        });
      }

      setActiveConversation((prev) => {
        if (!prev) return null;

        const updated = {
          ...prev,
          messages: [...prev.messages, aiResponse],
          lastActive: new Date(),
        };

        setConversations((convs) =>
          convs.map((c) => (c.id === updated.id ? updated : c))
        );

        return updated;
      });

      setIsSearching(false);
    },
    [agents, activeConversation?.id]
  );

  // ======================
  // Switch Agent
  // ======================
  const switchAgent = useCallback((agentId) => {
    setAgents((prev) =>
      prev.map((agent) => ({
        ...agent,
        active: agent.id === agentId,
      }))
    );
  }, []);

  // ================================================
  // Create New Conversation (UNCHANGED)
  // ================================================
const createNewConversation = useCallback(() => {
  // ❗ Do NOT create a DB entry here
  // We only create in DB when the FIRST MESSAGE is sent.

  const newConv = {
    id: "temp-" + Date.now(),              // temporary ID
    title: "New Conversation",
    agent: agents.find((a) => a.active)?.id || "general",
    messages: [],
    lastActive: new Date(),
    pinned: false,
    tags: [],
  };

  setConversations((prev) => [newConv, ...prev]);
  setActiveConversation(newConv);
  setCurrentMessage("");
}, [agents]);

  // ================================================
  // SEND MESSAGE (UPDATED FOR TITLE)
  // ================================================
  const sendMessage = useCallback(
    async () => {
      if (!currentMessage.trim()) return;

      if (!wsConnection || connectionStatus !== "connected") {
        return;
      }

      const text = currentMessage.trim();

      const userMessage = {
        id: Date.now().toString(),
        type: "user",
        content: text,
        timestamp: new Date(),
        files: selectedFiles,
      };

      let updatedConv = activeConversation ?? null;

      try {
        // Create conversation on first message
        if (
          !updatedConv ||
          (typeof updatedConv.id === "string" &&
            updatedConv.id.startsWith("temp-"))
        ) {
          const mongoConversationId = await createConversationInDB(text);

          if (!mongoConversationId) {
            return;
          }

          updatedConv = {
            ...(updatedConv || {}),
            id: mongoConversationId,

            // title auto-created by backend,
            // but frontend also adds preview
            title:
              text.length > 30
                ? text.slice(0, 30) + "..."
                : text,

            agent: agents.find((a) => a.active)?.id || "general",
            messages: updatedConv?.messages
              ? [...updatedConv.messages, userMessage]
              : [userMessage],
            lastActive: new Date(),
            pinned: false,
            tags: [],
          };

          setConversations((prev) => [updatedConv, ...prev]);
          setActiveConversation(updatedConv);
        } else {
          updatedConv = {
            ...updatedConv,
            messages: [...updatedConv.messages, userMessage],
            lastActive: new Date(),
          };

          setConversations((prev) =>
            prev.map((c) => (c.id === updatedConv.id ? updatedConv : c))
          );
          setActiveConversation(updatedConv);
        }

        // Save user message
        if (updatedConv?.id) {
          await saveMessageToDB({
            conversationId: updatedConv.id,
            role: "user",
            content: text,
          });
        }

        // Send to websocket
        setCurrentMessage("");
        setSelectedFiles([]);
        setIsSearching(true);

        const activeAgent = agents.find((a) => a.active) || {
          id: "general",
        };

        wsConnection.send(
          JSON.stringify({
            query: text,
            agentId: activeAgent.id,
          })
        );
      } catch (err) {
        setIsSearching(false);
      }
    },
    [
      currentMessage,
      activeConversation,
      agents,
      selectedFiles,
      wsConnection,
      connectionStatus,
    ]
  );

  // =====================
  // File Upload (unchanged)
  // =====================
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: Date.now() + Math.random(),
        name: file.name,
        size: file.size,
        type: file.type,
      })),
    ]);
  };

  const toggleVoiceInput = () => {
    setIsListening(!isListening);
    if (!isListening) {
      setTimeout(() => {
        setCurrentMessage("This is a simulated voice input message");
        setIsListening(false);
      }, 2000);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const togglePin = (convId) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId ? { ...c, pinned: !c.pinned } : c
      )
    );
  };

  // =====================
  // UI RENDER STARTS
  // =====================
  return (
    <div className={`flex h-screen ${darkMode ? "dark" : ""}`}>
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-80" : "w-16"
        } bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col`}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                AI Platform
              </h1>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <MessageSquare className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {sidebarOpen && (
            <button
              onClick={createNewConversation}
              className="w-full mt-3 flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Conversation
            </button>
          )}
        </div>

        {/* Agent Selector */}
        {sidebarOpen && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              AI Agents
            </h3>
            <div className="space-y-1">
              {agents.map((agent) => {
                const IconComponent = agent.icon;
                return (
                  <button
                    key={agent.id}
                    onClick={() => switchAgent(agent.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      agent.active
                        ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <div className="text-left">
                      <div className="text-sm font-medium">{agent.name}</div>
                      <div className="text-xs opacity-70">{agent.specialty}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {sidebarOpen && (
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Recent Conversations
              </h3>
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConversation(conv)}
                    className={`group p-3 rounded-lg cursor-pointer transition-colors ${
                      activeConversation?.id === conv.id
                        ? "bg-blue-100 dark:bg-blue-900"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {conv.pinned && (
                            <Pin className="w-3 h-3 text-blue-600" />
                          )}
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {conv.title}
                          </h4>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {conv.messages.length} messages •{" "}
                          {new Date(conv.lastActive).toLocaleDateString()}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          {agents.find((a) => a.id === conv.agent)?.icon &&
                            React.createElement(
                              agents.find((a) => a.id === conv.agent).icon,
                              {
                                className: "w-3 h-3 text-gray-400",
                              }
                            )}
                          <span className="text-xs text-gray-400">
                            {
                              agents.find((a) => a.id === conv.agent)
                                ?.name
                            }
                          </span>
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin(conv.id);
                          }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          <Pin
                            className={`w-3 h-3 ${
                              conv.pinned ? "text-blue-600" : "text-gray-400"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Settings footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {userProfile.name}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {darkMode ? (
                  <Sun className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                ) : (
                  <Moon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                )}
              </button>

              {sidebarOpen && (
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-800">
        {/* Chat Header */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {activeConversation && (
                <>
                  {agents.find((a) => a.id === activeConversation.agent)
                    ?.icon &&
                    React.createElement(
                      agents.find((a) => a.id === activeConversation.agent)
                        .icon,
                      {
                        className: "w-6 h-6 text-blue-600",
                      }
                    )}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {activeConversation.title}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {
                        agents.find(
                          (a) => a.id === activeConversation.agent
                        )?.name
                      }{" "}
                      • {activeConversation.messages.length} messages
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Header right side connection status */}
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                  connectionStatus === "connected"
                    ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                    : connectionStatus === "error"
                    ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                    : "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    connectionStatus === "connected"
                      ? "bg-green-500"
                      : connectionStatus === "error"
                      ? "bg-red-500"
                      : "bg-yellow-500"
                  }`}
                />
                {connectionStatus === "connected"
                  ? "Connected"
                  : connectionStatus === "error"
                  ? "Error"
                  : "Connecting..."}
              </div>

              {liveFeatures.webSearch && (
                <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-xs">
                  <Globe className="w-3 h-3" />
                  Live Search
                </div>
              )}

              {liveFeatures.factCheck && (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-xs">
                  <Shield className="w-3 h-3" />
                  Fact Check
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoadingConversations ? (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
              Loading conversations...
            </div>
          ) : activeConversation ? (
            <>
              {activeConversation.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.type === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  {message.type === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <div
                    className={`max-w-3xl ${
                      message.type === "user" ? "order-first" : ""
                    }`}
                  >
                    <div
                      className={`p-4 rounded-2xl ${
                        message.type === "user"
                          ? "bg-blue-600 text-white ml-auto"
                          : "bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">
                        {message.content}
                      </div>

                      {message.files && message.files.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {message.files.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center gap-2 text-sm opacity-80"
                            >
                              <FileText className="w-4 h-4" />
                              {file.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>

                  {message.type === "user" && (
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ))}

              {isSearching && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span className="text-gray-600 dark:text-gray-400">
                        Searching and analyzing...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
              Start a new conversation to begin chatting.
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4">
          {selectedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full text-sm"
                >
                  <FileText className="w-4 h-4" />
                  <span>{file.name}</span>
                  <button
                    onClick={() =>
                      setSelectedFiles((prev) =>
                        prev.filter((f) => f.id !== file.id)
                      )
                    }
                    className="text-gray-500 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Upload file"
              >
                <ImageIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>

              <button
                onClick={toggleVoiceInput}
                className={`p-2 rounded-lg transition-colors ${
                  isListening
                    ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                }`}
                title="Voice input"
              >
                <Mic className="w-5 h-5" />
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Camera"
              >
                <Camera className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Message ${
                  agents.find((a) => a.active)?.name || "AI Assistant"
                }...`}
                className="w-full p-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={1}
                style={{ minHeight: "44px", maxHeight: "120px" }}
              />
              <button
                onClick={sendMessage}
                disabled={!currentMessage.trim() || isSearching}
                className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "Explain this concept",
              "Write code for",
              "Research latest trends",
              "Plan a trip to",
              "Help me learn",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setCurrentMessage(suggestion + " ")}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileUpload}
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
      />

      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-96 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Settings
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* SETTINGS UI — unchanged */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationalAIPlatform;
