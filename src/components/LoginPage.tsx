"use client";

import { useState } from "react";

interface LoginPageProps {
  sessionId: string;
  onLogin: () => void;
}

export default function LoginPage({ sessionId, onLogin }: LoginPageProps) {
  const [accessToken, setAccessToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken.trim()) {
      setError("Please enter your Upstox access token");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: accessToken.trim(), sessionId }),
      });

      const data = await res.json();

      if (data.success) {
        onLogin();
      } else {
        // Show detailed error message
        let errorMsg = data.error || "Failed to validate token";
        if (data.details) {
          errorMsg += `\n\nDetails: ${data.details}`;
        }
        if (data.hint) {
          errorMsg += `\n\n💡 ${data.hint}`;
        }
        setError(errorMsg);
      }
    } catch (err) {
      setError("Network error. Please check your internet connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "radial-gradient(ellipse at top, #1a2035 0%, #0a0e17 60%)",
      }}
    >
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-blue/10 border border-accent-blue/20 mb-4">
            <svg
              className="w-8 h-8 text-accent-blue"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            Institutional Momentum Scanner
          </h1>
          <p className="text-text-secondary mt-2">NSE F&O • Real-Time Analysis</p>
        </div>

        {/* Login Form */}
        <div className="bg-bg-card border border-border rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-text-primary mb-1">
            Connect to Upstox
          </h2>
          <p className="text-sm text-text-muted mb-6">
            Enter your Upstox API access token to start scanning live market
            data.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="accessToken"
                className="block text-sm font-medium text-text-secondary mb-2"
              >
                Access Token
              </label>
              <input
                id="accessToken"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Enter your Upstox access token"
                className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue transition-all"
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-accent-red/10 border border-accent-red/20 rounded-lg text-accent-red text-sm whitespace-pre-wrap">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-accent-blue/50 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Validating...
                </>
              ) : (
                "Connect & Start Scanning"
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-border">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              How to get your access token
            </h3>
            <ol className="text-sm text-text-secondary space-y-2">
              <li className="flex gap-2">
                <span className="text-accent-blue font-mono text-xs mt-0.5">1.</span>
                Log in to your Upstox Developer Console
              </li>
              <li className="flex gap-2">
                <span className="text-accent-blue font-mono text-xs mt-0.5">2.</span>
                Create or select your API app
              </li>
              <li className="flex gap-2">
                <span className="text-accent-blue font-mono text-xs mt-0.5">3.</span>
                Complete the OAuth flow to get your access token
              </li>
              <li className="flex gap-2">
                <span className="text-accent-blue font-mono text-xs mt-0.5">4.</span>
                Paste the access token above
              </li>
            </ol>
          </div>
        </div>

        <p className="text-center text-xs text-text-muted mt-4">
          Your token is stored securely and used only for market data access.
        </p>
      </div>
    </div>
  );
}
