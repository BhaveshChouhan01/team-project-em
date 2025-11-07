"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Send, Mic, Image, Settings, Plus, BookOpen, Globe, Brain, Users, Bookmark, Download, Moon, Sun, MoreVertical, Pin, Archive, Edit3, Trash2, Copy, Share, Volume2, VolumeX, Eye, EyeOff, RefreshCw, Zap, MessageSquare, User, Bot, Clock, Star, Filter, Layers, TrendingUp, FileText, Camera, Video, Code, Map, Shield, Heart, ChevronDown, ChevronRight, X, Check, AlertCircle, Info, Lightbulb } from 'lucide-react';

const ConversationalAIPlatform = () => {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [wsConnection, setWsConnection] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  const [userProfile] = useState({
    name: 'Team B',
    preferences: { tone: 'professional', language: 'english', expertise: 'technology' },
    memory: { facts: ['Prefers detailed explanations', 'AI enthusiast'], preferences: ['Professional tone'], context: ['Developer'] }
  });

  const [agents, setAgents] = useState([
    { id: 'general', name: 'General Assistant', icon: Bot, active: true, specialty: 'General queries and conversations' },
    { id: 'research', name: 'Research Analyst', icon: Search, active: false, specialty: 'Deep research and fact-checking' },
    { id: 'code', name: 'Code Assistant', icon: Code, active: false, specialty: 'Programming and development' },
    { id: 'travel', name: 'Travel Planner', icon: Map, active: false, specialty: 'Travel planning and recommendations' },
    { id: 'tutor', name: 'Learning Tutor', icon: BookOpen, active: false, specialty: 'Educational content and tutoring' }
  ]);

  const agentPrompts = {
  general: "You are a helpful assistant providing clear and professional responses.",
  research: "You are a research analyst. Focus on detailed, evidence-based, and fact-checked answers.",
  code: "You are a code assistant. Provide clean, efficient, and well-commented code solutions.",
  travel: "You are a travel planner. Give practical travel advice, itineraries, and tips.",
  tutor: "You are a learning tutor. Explain concepts clearly with examples and step-by-step guidance."
};


  const [liveFeatures, setLiveFeatures] = useState({
    factCheck: true,
    webSearch: true,
    trending: true,
    citations: true,
    biasDetection: true
  });
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const demoConversations = [
      {
        id: '1',
        title: 'AI Research Discussion',
        agent: 'research',
        messages: [
          {
            id: '1',
            type: 'user',
            content: 'Could you provide an overview of EmerGexians Pvt Ltd?',
            timestamp: new Date(Date.now() - 3600000)
          },
          {
            id: '2',
            type: 'assistant',
            content: 'Certainly. EmerGexians Pvt Ltd is a professional technology and consulting firm specializing in delivering tailored IT solutions, software development, and digital transformation services. The company focuses on leveraging emerging technologies such as artificial intelligence, automation, and enterprise-grade software to support organizations in enhancing efficiency, scalability, and innovation.',
            timestamp: new Date(Date.now() - 3500000),
            sources: [
              { title: 'Emergexians pvt ltd', url: 'https://emergexians.com/', confidence: 0.95 },
              { title: 'Emergexians Linkedin', url: 'https://www.linkedin.com/company/emergexians/?originalSubdomain=in', confidence: 0.88 }
            ],
            factCheck: { verified: true, confidence: 0.92 }
          }
        ],
        lastActive: new Date(Date.now() - 3400000),
        pinned: true,
        tags: ['AI Safety', 'Research']
      }
    ];
    
    setConversations(demoConversations);
    setActiveConversation(demoConversations[0]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket('ws://localhost:8765');
        
        ws.onopen = () => {
          console.log('WebSocket connected');
          setConnectionStatus('connected');
          setWsConnection(ws);
        };
        
        ws.onmessage = (event) => {
          try {
            const response = JSON.parse(event.data);
            handleWebSocketResponse(response);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setConnectionStatus('disconnected');
          setWsConnection(null);
          // Attempt to reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000);
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionStatus('error');
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        setConnectionStatus('error');
        setTimeout(connectWebSocket, 3000);
      }
    };
    
    connectWebSocket();
    
    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, []);

  const handleWebSocketResponse = useCallback((response) => {
    const aiResponse = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: response.content,
      timestamp: new Date(),
      agent: agents.find(a => a.active)?.id || 'general',
      sources: response.sources || [],
      factCheck: { verified: true, confidence: response.confidence || 0.5 },
      method: response.method
    };

    setActiveConversation(prev => {
      if (!prev) return null;
      const updated = {
        ...prev,
        messages: [...prev.messages, aiResponse],
        lastActive: new Date()
      };
      
      setConversations(convs => convs.map(c => c.id === updated.id ? updated : c));
      return updated;
    });
    
    setIsSearching(false);
  }, [agents]);

  const createNewConversation = useCallback(() => {
    const newConv = {
      id: Date.now().toString(),
      title: 'New Conversation',
      agent: agents.find(a => a.active)?.id || 'general',
      messages: [],
      lastActive: new Date(),
      pinned: false,
      tags: []
    };
    
    setConversations(prev => [newConv, ...prev]);
    setActiveConversation(newConv);
    setCurrentMessage('');
  }, [agents]);

  const switchAgent = useCallback((agentId) => {
    setAgents(prev => prev.map(agent => ({
      ...agent,
      active: agent.id === agentId
    })));
  }, []);

  const generateAIResponse = (query, agent) => {
    const responses = {
      general: `I understand your question about "${query}". Based on current information and best practices:\n\n• Industry standards and approaches\n• Expert recommendations\n• Practical implementation strategies\n• Potential challenges and solutions\n\nWould you like me to elaborate on any specific aspect?`,
      research: `I've conducted thorough research on "${query}". Based on peer-reviewed sources:\n\n**Research Summary:**\n• Current state of research\n• Recent study findings\n• Expert consensus and debates\n• Future research implications\n\n**Evidence Quality:** High confidence from authoritative sources.`,
      code: `I'll help you with "${query}". Here's a comprehensive solution:\n\n\`\`\`javascript\n// Example implementation\nfunction solution() {\n  // Clean, efficient code\n  return 'Working solution';\n}\n\`\`\`\n\n**Features:**\n• Error handling\n• Performance optimization\n• Security considerations\n• Testing strategies`,
      travel: `I'd be happy to help with "${query}". Based on current travel data:\n\n**Recommendations:**\n• Best times to visit\n• Must-see attractions\n• Local customs and tips\n• Practical travel advice\n\n**Current Conditions:**\n• Weather considerations\n• Local events\n• Transportation options\n• Safety guidelines`,
      tutor: `Let me help you learn about "${query}" with a structured approach:\n\n**Learning Objectives:**\n• Core concepts and principles\n• Step-by-step explanations\n• Practical examples\n• Common misconceptions to avoid\n\n**Study Guide:**\n• Key terms and definitions\n• Practice exercises\n• Additional resources`
    };
    
    return responses[agent.id] || responses.general;
  };

  const generateSources = (query) => {
    const sources = [
      { title: `Research on ${query}`, url: 'https://example.com/research', confidence: 0.95 },
      { title: `Expert Analysis: ${query}`, url: 'https://example.com/analysis', confidence: 0.88 },
      { title: `Latest ${query} Developments`, url: 'https://news.example.com', confidence: 0.92 }
    ];
    return sources.slice(0, Math.floor(Math.random() * 3) + 1);
  };

  const sendMessage = useCallback(async () => {
    if (!currentMessage.trim() || !wsConnection || connectionStatus !== 'connected') {
      if (connectionStatus !== 'connected') {
        console.warn('WebSocket not connected. Status:', connectionStatus);
      }
      return;
    }

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: currentMessage.trim(),
      timestamp: new Date(),
      files: selectedFiles
    };

    let updatedConv;
    if (activeConversation) {
      updatedConv = {
        ...activeConversation,
        messages: [...activeConversation.messages, userMessage],
        lastActive: new Date()
      };

      if (activeConversation.messages.length === 0) {
        updatedConv.title = currentMessage.slice(0, 50) + (currentMessage.length > 50 ? '...' : '');
      }
    } else {
      updatedConv = {
        id: Date.now().toString(),
        title: currentMessage.slice(0, 50) + (currentMessage.length > 50 ? '...' : ''),
        agent: agents.find(a => a.active)?.id || 'general',
        messages: [userMessage],
        lastActive: new Date(),
        pinned: false,
        tags: []
      };
      setConversations(prev => [updatedConv, ...prev]);
    }

    setActiveConversation(updatedConv);
    setConversations(prev => prev.map(c => c.id === updatedConv.id ? updatedConv : c));
    
    const query = currentMessage.trim();
    setCurrentMessage('');
    setSelectedFiles([]);
    setIsSearching(true);

    try {
      const activeAgent = agents.find(a => a.active) || { id: 'general' };
      
      // Send query to WebSocket server
      const message = {
        query: query,
        agentId: activeAgent.id
      };
      
      wsConnection.send(JSON.stringify(message));
    } catch (err) {
      console.error('Error sending message:', err);
      setIsSearching(false);
    }
  }, [currentMessage, activeConversation, agents, selectedFiles, wsConnection, connectionStatus]);





  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(prev => [...prev, ...files.map(file => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      type: file.type
    }))]);
  };

  const toggleVoiceInput = () => {
    setIsListening(!isListening);
    if (!isListening) {
      setTimeout(() => {
        setCurrentMessage('This is a simulated voice input message');
        setIsListening(false);
      }, 2000);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const togglePin = (convId) => {
    setConversations(prev => prev.map(c => 
      c.id === convId ? { ...c, pinned: !c.pinned } : c
    ));
  };

  return (
    <div className={`flex h-screen ${darkMode ? 'dark' : ''}`}>
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-16'} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">AI Platform</h1>
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
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">AI Agents</h3>
            <div className="space-y-1">
              {agents.map(agent => {
                const IconComponent = agent.icon;
                return (
                  <button
                    key={agent.id}
                    onClick={() => switchAgent(agent.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      agent.active 
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
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
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recent Conversations</h3>
              <div className="space-y-2">
                {conversations.map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConversation(conv)}
                    className={`group p-3 rounded-lg cursor-pointer transition-colors ${
                      activeConversation?.id === conv.id
                        ? 'bg-blue-100 dark:bg-blue-900'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {conv.pinned && <Pin className="w-3 h-3 text-blue-600" />}
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {conv.title}
                          </h4>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {conv.messages.length} messages • {conv.lastActive.toLocaleDateString()}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          {agents.find(a => a.id === conv.agent)?.icon && (
                            React.createElement(agents.find(a => a.id === conv.agent).icon, {
                              className: "w-3 h-3 text-gray-400"
                            })
                          )}
                          <span className="text-xs text-gray-400">
                            {agents.find(a => a.id === conv.agent)?.name}
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
                          <Pin className={`w-3 h-3 ${conv.pinned ? 'text-blue-600' : 'text-gray-400'}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{userProfile.name}</span>
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
                  {agents.find(a => a.id === activeConversation.agent)?.icon && (
                    React.createElement(agents.find(a => a.id === activeConversation.agent).icon, {
                      className: "w-6 h-6 text-blue-600"
                    })
                  )}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {activeConversation.title}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {agents.find(a => a.id === activeConversation.agent)?.name} • 
                      {activeConversation.messages.length} messages
                    </p>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                connectionStatus === 'connected' 
                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                  : connectionStatus === 'error'
                  ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                  : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500' : 
                  connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                {connectionStatus === 'connected' ? 'Connected' : 
                 connectionStatus === 'error' ? 'Error' : 'Connecting...'}
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
          {activeConversation?.messages.map(message => (
            <div key={message.id} className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.type === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              
              <div className={`max-w-3xl ${message.type === 'user' ? 'order-first' : ''}`}>
                <div className={`p-4 rounded-2xl ${
                  message.type === 'user' 
                    ? 'bg-blue-600 text-white ml-auto' 
                    : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                }`}>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  
                  {message.files && message.files.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.files.map(file => (
                        <div key={file.id} className="flex items-center gap-2 text-sm opacity-80">
                          <FileText className="w-4 h-4" />
                          {file.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {message.type === 'assistant' && (message.sources?.length > 0 || message.factCheck || message.method) && (
                  <div className="mt-2 space-y-2">
                    {message.method && (
                      <div className="flex items-center gap-2 text-xs">
                        {message.method === 'search' ? (
                          <><Globe className="w-3 h-3 text-blue-500" /><span className="text-blue-500">Web Search</span></>
                        ) : message.method === 'model' ? (
                          <><Brain className="w-3 h-3 text-purple-500" /><span className="text-purple-500">AI Model</span></>
                        ) : null}
                      </div>
                    )}
                    {message.sources && message.sources.length > 0 && (
                      <div className="text-sm">
                        <div className="text-gray-600 dark:text-gray-400 mb-1">Sources:</div>
                        <div className="space-y-1">
                          {message.sources.map((source, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                              <Globe className="w-3 h-3" />
                              <a href={source.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-sm">
                                {source.title}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {message.factCheck && (
                      <div className="flex items-center gap-2 text-sm">
                        <Shield className={`w-4 h-4 ${
                          message.factCheck.verified ? 'text-green-600' : 'text-yellow-600'
                        }`} />
                        <span className={message.factCheck.verified ? 'text-green-600' : 'text-yellow-600'}>
                          Confidence: {Math.round(message.factCheck.confidence * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
              
              {message.type === 'user' && (
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
                  <span className="text-gray-600 dark:text-gray-400">Searching and analyzing...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4">
          {selectedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedFiles.map(file => (
                <div key={file.id} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full text-sm">
                  <FileText className="w-4 h-4" />
                  <span>{file.name}</span>
                  <button
                    onClick={() => setSelectedFiles(prev => prev.filter(f => f.id !== file.id))}
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
                <Image className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={toggleVoiceInput}
                className={`p-2 rounded-lg transition-colors ${
                  isListening 
                    ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
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
                placeholder={`Message ${agents.find(a => a.active)?.name || 'AI Assistant'}...`}
                className="w-full p-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={1}
                style={{ minHeight: '44px', maxHeight: '120px' }}
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
            {['Explain this concept', 'Write code for', 'Research latest trends', 'Plan a trip to', 'Help me learn'].map(suggestion => (
              <button
                key={suggestion}
                onClick={() => setCurrentMessage(suggestion + ' ')}
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Real-time Features</h4>
                <div className="space-y-2">
                  {Object.entries(liveFeatures).map(([key, value]) => (
                    <label key={key} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      </span>
                      <button
                        onClick={() => setLiveFeatures(prev => ({ ...prev, [key]: !value }))}
                        className={`w-10 h-6 rounded-full transition-colors ${
                          value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                          value ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </button>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">User Preferences</h4>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div>Name: {userProfile.name}</div>
                  <div>Tone: {userProfile.preferences.tone}</div>
                  <div>Language: {userProfile.preferences.language}</div>
                  <div>Expertise: {userProfile.preferences.expertise}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Memory Context</h4>
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  {userProfile.memory.facts.map((fact, idx) => (
                    <div key={idx}>• {fact}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationalAIPlatform;