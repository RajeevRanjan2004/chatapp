import React, { useContext, useEffect, useState } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import { AuthContext } from "./context/AuthContext";
import Auth from "./pages/Auth";
import Chat from "./pages/Chat";
import "./index.css";
import { applyPlatformClasses } from "./utils/platform";
import { initializeNativeShell, installViewportMetrics } from "./services/nativeShell";

export default function App() {
  const { token } = useContext(AuthContext);
  const [shellHint, setShellHint] = useState("");

  useEffect(() => {
    applyPlatformClasses();
    const cleanupViewport = installViewportMetrics();
    void initializeNativeShell();

    const handleBackHint = (event) => {
      const message = event.detail?.message || "";
      setShellHint(message);
      window.clearTimeout(handleBackHint.timeoutId);
      handleBackHint.timeoutId = window.setTimeout(() => {
        setShellHint("");
      }, 1800);
    };

    window.addEventListener("native-shell:back-hint", handleBackHint);

    return () => {
      cleanupViewport?.();
      window.removeEventListener("native-shell:back-hint", handleBackHint);
      window.clearTimeout(handleBackHint.timeoutId);
    };
  }, []);

  return (
    <Router>
      <>
        <Routes>
          <Route path="/" element={!token ? <Auth /> : <Navigate to="/chat" replace />} />
          <Route path="/chat" element={token ? <Chat /> : <Navigate to="/" replace />} />
        </Routes>

        {shellHint ? (
          <div className="pointer-events-none fixed inset-x-4 bottom-6 z-[70] flex justify-center">
            <div className="rounded-full border border-white/10 bg-slate-950/88 px-4 py-2 text-sm font-medium text-white shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              {shellHint}
            </div>
          </div>
        ) : null}
      </>
    </Router>
  );
}
