import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { authService } from "../services/api";
import Icon from "../components/Icon";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;
const LAST_EMAIL_KEY = "rtc_last_email";

const featureCards = [
  {
    title: "Email OTP access",
    description: "Enter your email, receive a code, and login only after the OTP is verified.",
    icon: "chat",
  },
  {
    title: "Auto account detection",
    description: "Existing emails sign in directly, while new emails finish account setup in the same flow.",
    icon: "spark",
  },
  {
    title: "Inbox-first verify",
    description: "OTP aapke email inbox me aata hai, aur login verify hone ke baad hi complete hota hai.",
    icon: "shield",
  },
];

function getInitialEmail() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LAST_EMAIL_KEY) || "";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /\S+@\S+\.\S+/.test(normalizeEmail(value));
}

function formatTimer(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const remainingSeconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function createEmptyOtp() {
  return Array.from({ length: OTP_LENGTH }, () => "");
}

export default function Auth() {
  const [email, setEmail] = useState(getInitialEmail);
  const [name, setName] = useState("");
  const [otpDigits, setOtpDigits] = useState(createEmptyOtp);
  const [step, setStep] = useState("email");
  const [authMode, setAuthMode] = useState("auto");
  const [deliveryMode, setDeliveryMode] = useState("email");
  const [destinationHint, setDestinationHint] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const otpRefs = useRef([]);

  const otpValue = useMemo(() => otpDigits.join(""), [otpDigits]);
  const isNewUser = authMode === "signup";
  const canResend = resendCountdown === 0 && !loading;

  useEffect(() => {
    if (!resendCountdown) return undefined;

    const timer = window.setInterval(() => {
      setResendCountdown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCountdown]);

  useEffect(() => {
    if (step !== "otp") return undefined;

    const firstEmptyIndex = otpDigits.findIndex((digit) => !digit);
    const focusIndex = firstEmptyIndex === -1 ? OTP_LENGTH - 1 : firstEmptyIndex;
    otpRefs.current[focusIndex]?.focus();
    return undefined;
  }, [step, otpDigits]);

  const resetOtpStep = () => {
    setStep("email");
    setOtpDigits(createEmptyOtp());
    setAuthMode("auto");
    setDeliveryMode("email");
    setDestinationHint("");
    setNotice("");
    setError("");
    setLoading(false);
    setResendCountdown(0);
  };

  const handleRequestOtp = async ({ modeOverride } = {}) => {
    const normalizedTargetEmail = normalizeEmail(email);

    if (!normalizedTargetEmail) {
      setError("Email is required.");
      return;
    }

    if (!isValidEmail(normalizedTargetEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await authService.requestOtp({
        email: normalizedTargetEmail,
        mode: modeOverride || authMode || "auto",
        name: name.trim(),
      });

      const resolvedMode = response.data?.mode || "login";
      localStorage.setItem(LAST_EMAIL_KEY, normalizedTargetEmail);
      setOtpDigits(createEmptyOtp());
      setStep("otp");
      setAuthMode(resolvedMode);
      setDeliveryMode(response.data?.delivery || "email");
      setDestinationHint(response.data?.destinationHint || normalizedTargetEmail);
      setNotice(
        response.data?.msg ||
          (resolvedMode === "signup" ? "OTP sent. Finish your account setup." : "OTP sent successfully.")
      );
      setResendCountdown(Math.min(RESEND_SECONDS, Number(response.data?.expiresInSec) || RESEND_SECONDS));
    } catch (err) {
      setError(err.userMessage || err.response?.data?.msg || "OTP bhejne me problem aayi. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();

    const normalizedTargetEmail = normalizeEmail(email);
    const trimmedName = name.trim();

    if (otpValue.length !== OTP_LENGTH) {
      setError("Please enter the full 6-digit OTP.");
      return;
    }

    if (isNewUser && !trimmedName) {
      setError("New account ke liye name add karna zaroori hai.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await authService.verifyOtp({
        email: normalizedTargetEmail,
        otp: otpValue,
        mode: authMode,
        name: trimmedName,
      });

      login(response.data.user, response.data.token);
      navigate("/chat");
    } catch (err) {
      setError(err.userMessage || err.response?.data?.msg || "OTP verify nahi ho paya. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const digits = String(value || "").replace(/\D/g, "");

    if (!digits) {
      setOtpDigits((current) => {
        const next = [...current];
        next[index] = "";
        return next;
      });
      return;
    }

    setOtpDigits((current) => {
      const next = [...current];

      if (digits.length > 1) {
        const mergedDigits = digits.slice(0, OTP_LENGTH - index).split("");
        mergedDigits.forEach((digit, offset) => {
          next[index + offset] = digit;
        });
        return next;
      }

      next[index] = digits[0];
      return next;
    });

    const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
    window.requestAnimationFrame(() => {
      otpRefs.current[nextIndex]?.focus();
      otpRefs.current[nextIndex]?.select?.();
    });
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      otpRefs.current[index - 1]?.focus();
      return;
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();
    const pastedDigits = String(event.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pastedDigits) return;

    const nextDigits = createEmptyOtp();
    pastedDigits.split("").forEach((digit, index) => {
      nextDigits[index] = digit;
    });
    setOtpDigits(nextDigits);
  };

  const actionTitle = step === "email" ? "Enter your email" : "Verify your inbox";
  const actionSubtitle =
    step === "email"
      ? "We will send a one-time code to your email. Login only happens after OTP verification."
      : `Code sent to ${destinationHint || normalizeEmail(email) || "your email address"}.`;

  return (
    <div className="app-shell native-screen safe-top-pad safe-bottom-pad overflow-hidden px-4 py-6 lg:px-10 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[36px] border border-white/10 bg-slate-950/35 shadow-[0_40px_140px_rgba(0,0,0,0.48)]">
        <section className="hidden w-[46%] flex-col justify-between bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_38%),linear-gradient(160deg,#08111d_0%,#0f2035_55%,#16304c_100%)] p-10 text-white lg:flex">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-sky-100">
              <Icon name="spark" className="h-4 w-4" />
              Chatify
            </div>

            <h1 className="mt-8 max-w-md text-5xl font-semibold leading-[1.05]">
              Email OTP verify karo aur tabhi chat me login ho.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
              Direct OTP login with email-first onboarding, account auto-detect, and no password sign-in.
            </p>
          </div>

          <div className="grid gap-4">
            {featureCards.map((feature) => (
              <div
                key={feature.title}
                className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur-xl"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-white/10 text-sky-100">
                    <Icon name={feature.icon} className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{feature.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="soft-panel flex w-full items-center justify-center px-5 py-8 text-slate-900 lg:w-[54%] lg:px-10">
          <div className="w-full max-w-lg">
            <div className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.12)] lg:p-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
                    {step === "email" ? "Welcome" : isNewUser ? "New email" : "Welcome back"}
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold text-slate-900">{actionTitle}</h2>
                </div>
                <div className="hidden rounded-[22px] bg-slate-100 p-3 text-slate-700 sm:block">
                  <Icon name={step === "email" ? "user" : "lock"} className="h-6 w-6" />
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-500">{actionSubtitle}</p>

              <div className="mt-6 grid grid-cols-2 gap-3 rounded-[24px] bg-slate-50 p-2 text-sm font-semibold text-slate-500">
                <div
                  className={`rounded-[18px] px-4 py-3 text-center transition ${
                    step === "email" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                  }`}
                >
                  1. Email
                </div>
                <div
                  className={`rounded-[18px] px-4 py-3 text-center transition ${
                    step === "otp" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                  }`}
                >
                  2. Verify
                </div>
              </div>

              {step === "email" ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleRequestOtp({ modeOverride: "auto" });
                  }}
                  className="mt-8 space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Email address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
                      autoComplete="email"
                      required
                    />
                  </div>

                  {error ? (
                    <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex w-full items-center justify-center gap-3 rounded-[20px] bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon name="send" className="h-4 w-4" />
                    {loading ? "Sending OTP..." : "Continue with email OTP"}
                  </button>

                  <p className="rounded-[22px] bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                    Password login band hai. Account tabhi open hoga jab email OTP verify ho jayega.
                  </p>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="mt-8 space-y-5">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {isNewUser ? "New account setup" : "Existing account detected"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          {isNewUser
                            ? "OTP verify hone ke baad isi email se naya account ban jayega."
                            : "OTP verify hote hi aap chat me sign in ho jaoge."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={resetOtpStep}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        Change
                      </button>
                    </div>
                  </div>

                  {isNewUser ? (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Your name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="How should people see you?"
                        className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
                        autoComplete="name"
                        required
                      />
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700">Enter OTP</label>
                    <div className="grid grid-cols-6 gap-2 sm:gap-3">
                      {otpDigits.map((digit, index) => (
                        <input
                          key={index}
                          ref={(element) => {
                            otpRefs.current[index] = element;
                          }}
                          type="text"
                          inputMode="numeric"
                          value={digit}
                          onChange={(event) => handleOtpChange(index, event.target.value)}
                          onKeyDown={(event) => handleOtpKeyDown(index, event)}
                          onPaste={handleOtpPaste}
                          maxLength={1}
                          className="h-14 rounded-[18px] border border-slate-200 bg-slate-50 text-center text-xl font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
                          aria-label={`OTP digit ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>

                  {notice ? (
                    <div className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">OTP sent</p>
                          <p className="mt-1 leading-6">
                            {`OTP ${destinationHint ? `${destinationHint} par` : "aapke inbox me"} bhej di gayi hai. Inbox aur spam folder dono check kariye.`}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
                          {deliveryMode}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {error ? (
                    <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex w-full items-center justify-center gap-3 rounded-[20px] bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon name="lock" className="h-4 w-4" />
                    {loading ? "Verifying..." : "Verify OTP and login"}
                  </button>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void handleRequestOtp({ modeOverride: authMode })}
                      disabled={!canResend}
                      className="inline-flex items-center justify-center rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {canResend ? "Resend OTP" : `Resend in ${formatTimer(resendCountdown)}`}
                    </button>
                    <button
                      type="button"
                      onClick={resetOtpStep}
                      className="inline-flex items-center justify-center rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      Edit email
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
