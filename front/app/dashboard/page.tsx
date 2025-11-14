"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  TrendingUp,
  Clock,
  Plus,
  TrendingDown,
  User,
} from "lucide-react";

interface StatCard {
  id: string;
  icon: React.ElementType;
  label: string;
  value: string | number;
  change: number;
  changeType: "increase" | "decrease";
}

interface Chat {
  id: string;
  name: string;
  email: string;
  avatar: string;
  message: string;
  messageCount: number;
  duration: string;
  sentiment: "positive" | "neutral" | "negative";
  status: "resolved" | "active" | "pending";
}

interface ActivityData {
  day: string;
  value: number;
}

const ChatbotDashboard: React.FC = () => {
  const router = useRouter();

  // dynamic states
  const [stats, setStats] = useState<StatCard[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([
    { day: "Mon", value: 0 },
    { day: "Tue", value: 0 },
    { day: "Wed", value: 0 },
    { day: "Thu", value: 0 },
    { day: "Fri", value: 0 },
    { day: "Sat", value: 0 },
    { day: "Sun", value: 0 },
  ]);
  const [recentChats, setRecentChats] = useState<Chat[]>([]);

  const [username, setUsername] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // fetch user info (existing)
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const storedUsername = localStorage.getItem("username");
        if (storedUsername) {
          setUsername(storedUsername);
          setIsLoading(false);
          return;
        }

        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.username) {
            setUsername(data.data.username);
            localStorage.setItem("username", data.data.username);
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("#user-dropdown")) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.removeItem("username");
      router.push("/signin");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // fetch dashboard data from backend
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) {
          console.error("Failed to fetch dashboard data", res.status);
          return;
        }
        const payload = await res.json();
        if (!payload.success || !payload.stats) {
          console.error("Dashboard API returned error or missing stats");
          return;
        }

        const s = payload.stats;

        // update stats cards
        setStats([
          {
            id: "1",
            icon: MessageSquare,
            label: "Total Conversations",
            value: s.totalConversations ?? 0,
            change: 0,
            changeType: "increase",
          },
          {
            id: "2",
            icon: TrendingUp,
            label: "Total Messages",
            value: s.totalMessages ?? 0,
            change: 0,
            changeType: "increase",
          },
          {
            id: "4",
            icon: Clock,
            label: "Avg Response Time",
            value: `${s.avgResponseTime ?? 0}m`,
            change: 0,
            changeType: "decrease",
          },
        ]);

        // weeklyData can come in two shapes:
        // 1) [{ day: "Mon", value: number }, ...]  ← current API
        // 2) [{ _id: <1-7 dayOfWeek>, count: number }, ...]  ← legacy
        const apiWeekly = s.weeklyData || [];

        if (apiWeekly.length > 0 && apiWeekly[0]?.day !== undefined) {
          // Shape 1: already Mon..Sun with { day, value }
          const normalized: ActivityData[] = [
            "Mon",
            "Tue",
            "Wed",
            "Thu",
            "Fri",
            "Sat",
            "Sun",
          ].map((label: string) => {
            const match = apiWeekly.find((d: any) => d.day === label);
            return { day: label, value: match?.value ?? 0 };
          });
          setActivityData(normalized);
        } else {
          // Shape 2: convert from Mongo $dayOfWeek grouping
          // create lookup where key is dayOfWeek (1=Sun ... 7=Sat)
          const lookup = new Map<number, number>();
          apiWeekly.forEach((d: any) => {
            const key =
              typeof d._id === "object" && d._id?.dayOfWeek ? d._id.dayOfWeek : d._id;
            const dayNum = typeof key === "number" ? key : Number(key);
            lookup.set(dayNum, d.count ?? d?.value ?? 0);
          });

          // Mongo $dayOfWeek: 1=Sunday,2=Monday,...7=Saturday
          const orderMonToSun = [2, 3, 4, 5, 6, 7, 1];
          const daysLabel = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
          const weeklyArr: ActivityData[] = orderMonToSun.map((dayNum, idx) => ({
            day: daysLabel[idx],
            value: lookup.get(dayNum) ?? 0,
          }));
          setActivityData(weeklyArr);
        }

        // recentChats mapping
        const chatsFromApi = s.recentChats || [];
        const chats: Chat[] = chatsFromApi.map((c: any) => ({
          id: c._id ?? c.id,
          name: c.title || c.name || "Untitled Chat",
          email: c.userEmail || "",
          avatar:
            (c.title && c.title.charAt(0).toUpperCase()) ||
            (c.name && c.name.charAt(0).toUpperCase()) ||
            "C",
          message: c.lastMessage?.content || c.preview || "",
          messageCount: c.messageCount ?? 0,
          duration: c.duration || "",
          sentiment: "neutral",
          status: c.status || "active",
        }));
        setRecentChats(chats);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
    };

    fetchDashboardData();
  }, []);

  // helpers for colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case "resolved":
        return "bg-emerald-100 text-emerald-700";
      case "active":
        return "bg-blue-100 text-blue-700";
      case "pending":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-emerald-100 text-emerald-700";
      case "neutral":
        return "bg-gray-100 text-gray-700";
      case "negative":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // chart helpers
  const maxValue = Math.max(...activityData.map((d) => d.value), 1);
  const chartHeight = 150;
  const hasData = activityData.some((d) => d.value > 0);

  // Generate dynamic Y-axis labels based on maxValue
  const generateYAxisLabels = (max: number) => {
    const labels = [];
    for (let i = 4; i >= 0; i--) {
      labels.push(Math.round((max * i) / 4));
    }
    return labels;
  };
  const yAxisLabels = generateYAxisLabels(maxValue);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Chatbot Dashboard</h1>
              <p className="text-gray-600 mt-1">Monitor your chatbot performance and conversations</p>
            </div>
            <div className="flex items-center gap-3">
              <div id="user-dropdown" className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-3 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <User className="text-white" size={18} />
                  </div>
                  <span className="font-medium text-gray-900">
                    {isLoading ? "Loading..." : username || "User"}
                  </span>
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                    >
                      <User size={16} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => router.push("/chatbot")}
                className="flex items-center gap-2 px-4 py-2 text-white bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-colors"
              >
                <Plus size={20} />
                New Chat
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-blue-500 rounded-xl">
                    <Icon className="text-white" size={24} />
                  </div>
                  <div
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium ${
                      stat.changeType === "increase" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {stat.changeType === "increase" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {stat.changeType === "increase" ? "+" : "-"}
                    {stat.change}%
                  </div>
                </div>
                <div>
                  <p className="text-gray-600 text-sm mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Weekly Activity Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">Weekly Activity</h2>
              <p className="text-gray-600 text-sm mt-1">Conversation trends over the last 7 days</p>
            </div>

            {hasData ? (
              <div className="relative" style={{ height: chartHeight + 40 }}>
                <div className="flex items-end justify-between h-full gap-8 pb-8 pl-8">
                  {activityData.map((data, index) => {
                    const height = (data.value / maxValue) * chartHeight;
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center gap-3">
                        <div className="relative w-full flex items-end justify-center" style={{ height: chartHeight }}>
                          <div
                            className="w-3 bg-blue-500 rounded-full transition-all hover:bg-blue-600 cursor-pointer"
                            style={{ height: `${height}px` }}
                            title={`${data.day}: ${data.value}`}
                          />
                        </div>
                        <span className="text-sm text-gray-600 font-medium">{data.day}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 h-full pb-8 flex flex-col justify-between text-xs text-gray-400 pr-2">
                  {yAxisLabels.map((label, index) => (
                    <span key={index}>{label}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <TrendingUp className="mx-auto text-gray-300 mb-3" size={48} />
                <p className="text-gray-500 font-medium">No activity this week</p>
                <p className="text-gray-400 text-sm mt-1">Activity data will appear here once conversations start</p>
              </div>
            )}
          </div>

          {/* Recent Chats */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">Recent Chats</h2>
              <p className="text-gray-600 text-sm mt-1">Latest conversations</p>
            </div>

            <div className="space-y-4 overflow-y-auto max-h-96">
              {recentChats.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="mx-auto text-gray-300 mb-3" size={48} />
                  <p className="text-gray-500 font-medium">No recent chats</p>
                  <p className="text-gray-400 text-sm mt-1">Conversations will appear here</p>
                </div>
              ) : (
                recentChats.map((chat) => (
                  <div key={chat.id} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors cursor-pointer">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {chat.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">{chat.name}</h3>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(chat.status)}`}>
                            {chat.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{chat.email}</p>
                      </div>
                    </div>

                    <p className="text-sm text-gray-700 mb-3 line-clamp-2">{chat.message}</p>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <MessageSquare size={14} />
                          {chat.messageCount} messages
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {chat.duration}
                        </span>
                      </div>
                      <span className={`px-2 py-1 rounded-full font-medium ${getSentimentColor(chat.sentiment)}`}>
                        {chat.sentiment}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotDashboard;
