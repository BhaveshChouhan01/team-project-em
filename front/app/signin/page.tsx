"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";

const SignInPage = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Invalid credentials");
      }

      console.log("✅ Sign-in successful:", data);
      // Store username in localStorage
      if (data.user && data.user.username) {
        localStorage.setItem("username", data.user.username);
      }
      router.push("/dashboard"); // or "/"
    } catch (err: any) {
      console.error("❌ Sign-in error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background circles */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-blue-400 rounded-full opacity-30 animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-40 h-40 bg-purple-400 rounded-full opacity-30 animate-pulse" style={{ animationDelay: "1s" }}></div>
      <div className="absolute top-1/2 right-20 w-24 h-24 bg-blue-300 rounded-full opacity-30 animate-pulse" style={{ animationDelay: "2s" }}></div>
      <div className="absolute bottom-20 left-10 w-36 h-36 bg-purple-300 rounded-full opacity-30 animate-pulse" style={{ animationDelay: "1.5s" }}></div>

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative z-10 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8 animate-slide-down">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4 shadow-lg transform hover:scale-110 transition-transform duration-300">
            <LogIn className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Welcome Back</h1>
          <p className="text-gray-500">Sign in to your account to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <label className="block text-gray-700 font-semibold mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                placeholder="Enter your email address"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-blue-300 text-gray-700 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Password */}
          <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <label className="block text-gray-700 font-semibold mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="w-full pl-12 pr-12 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-blue-300 text-gray-700 placeholder-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Forgot Password */}
          <div className="text-right animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <a href="#" className="text-blue-600 font-medium hover:underline transition-all duration-300 hover:text-blue-700">
              Forgot your password?
            </a>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-red-600 text-sm text-center animate-slide-up" style={{ animationDelay: "0.35s" }}>
              {error}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3.5 rounded-xl font-semibold shadow-lg hover:shadow-xl transform transition-all duration-300 flex items-center justify-center gap-2 animate-slide-up ${
              loading ? "opacity-75 cursor-not-allowed" : "hover:scale-105"
            }`}
            style={{ animationDelay: "0.4s" }}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing In...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Sign In
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          {/* Divider */}
          <div className="animate-slide-up" style={{ animationDelay: "0.5s" }}>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">New to our platform?</span>
              </div>
            </div>
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-gray-600 animate-slide-up" style={{ animationDelay: "0.6s" }}>
            Don't have an account?{" "}
            <a href="/signup" className="text-blue-600 font-semibold hover:underline transition-all duration-300 hover:text-blue-700">
              Create one now
            </a>
          </p>
        </form>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-fade-in { animation: fade-in 0.6s ease-out; }
        .animate-slide-down { animation: slide-down 0.6s ease-out; }
        .animate-slide-up { animation: slide-up 0.6s ease-out; animation-fill-mode: both; }
      `}</style>
    </div>
  );
};

export default SignInPage;
