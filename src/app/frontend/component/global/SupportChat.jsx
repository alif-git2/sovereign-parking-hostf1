"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import axios from "@/app/frontend/utils/axios";

const QUICK_QUESTIONS = [
  "How can I cancel my booking?",
  "How does Pay on Arrival work?",
  "How do I edit my license plate?",
  "Do you provide shuttle service?",
];

function getStoredCustomer() {
  if (typeof window === "undefined") return null;

  try {
    const rawUser = localStorage.getItem("user");

    if (!rawUser) return null;

    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

function getAuthHeaders() {
  if (typeof window === "undefined") return {};

  const token = localStorage.getItem("token");

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function shouldHideChat(pathname = "") {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/set-password")
  );
}

function createMessage(sender, text, type = "text") {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sender,
    text,
    type,
    createdAt: new Date(),
  };
}

function formatTime(date) {
  try {
    return new Date(date).toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function playSupportSound(type = "open") {
  if (typeof window === "undefined") return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) return;

    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;

    const soundMap = {
      open: {
        frequency: 620,
        duration: 0.08,
        volume: 0.045,
      },
      send: {
        frequency: 520,
        duration: 0.06,
        volume: 0.035,
      },
      reply: {
        frequency: 760,
        duration: 0.09,
        volume: 0.04,
      },
      success: {
        frequency: 880,
        duration: 0.12,
        volume: 0.045,
      },
    };

    const sound = soundMap[type] || soundMap.open;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(sound.frequency, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(sound.volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + sound.duration);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + sound.duration + 0.02);

    setTimeout(() => {
      audioContext.close().catch(() => {});
    }, 300);
  } catch {
    // Sound is optional. Ignore browser/audio permission issues.
  }
}

export default function SupportChat() {
  const pathname = usePathname();
  const messagesEndRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const inputRef = useRef(null);

  const hidden = useMemo(() => shouldHideChat(pathname), [pathname]);

  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ticketMode, setTicketMode] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState("");
  const [canSubmitTicket, setCanSubmitTicket] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const [messages, setMessages] = useState([
    createMessage(
      "bot",
      "Hello! Welcome to Sovereign Parking support. Ask me about bookings, cancellation, wallet, Pay on Arrival, shuttle options, or license plate changes."
    ),
  ]);

  const [ticketForm, setTicketForm] = useState({
    name: "",
    email: "",
    phone: "",
    booking_id: "",
    message: "",
  });

  function updateScrollToBottomVisibility() {
    const container = messagesScrollRef.current;

    if (!container) {
      setShowScrollToBottom(false);
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    setShowScrollToBottom(distanceFromBottom > 48);
  }

  function scrollMessagesToBottom(behavior = "smooth") {
    const container = messagesScrollRef.current;

    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });

    window.setTimeout(updateScrollToBottomVisibility, 250);
  }

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      scrollMessagesToBottom("smooth");
    }, 120);

    return () => window.clearTimeout(timer);
  }, [messages.length, asking, ticketMode, ticketSuccess, error, open]);

  useEffect(() => {
    if (!open || !canSubmitTicket || ticketMode) return;

    // The ticket prompt is intentionally added below the answer.
    // Keep the answer visible and show the down-arrow when more content exists.
    const timer = window.setTimeout(() => {
      updateScrollToBottomVisibility();
    }, 180);

    return () => window.clearTimeout(timer);
  }, [canSubmitTicket, ticketMode, open]);

  useEffect(() => {
    if (!open) return;

    const customer = getStoredCustomer();

    if (customer) {
      setTicketForm((prev) => ({
        ...prev,
        name: prev.name || customer.name || "",
        email: prev.email || customer.email || "",
        phone: prev.phone || customer.phone || "",
      }));
    }

    setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
  }, [open]);

  if (hidden) {
    return null;
  }

  function updateTicketField(name, value) {
    setTicketForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
    setTicketSuccess("");
  }

  function openTicketForm(defaultMessage = "") {
    const customer = getStoredCustomer();

    setTicketMode(true);
    setCanSubmitTicket(true);
    setTicketSuccess("");
    setError("");

    setTicketForm((prev) => ({
      ...prev,
      name: prev.name || customer?.name || "",
      email: prev.email || customer?.email || "",
      phone: prev.phone || customer?.phone || "",
      message: prev.message || defaultMessage || "",
    }));
  }

  async function askQuestion(text) {
    const cleanQuestion = String(text || "").trim();

    if (!cleanQuestion) {
      setError("Please write your question.");
      return;
    }

    try {
      setAsking(true);
      setError("");
      setTicketSuccess("");
      setQuestion("");

      setMessages((prev) => [...prev, createMessage("user", cleanQuestion)]);
      playSupportSound("send");

      const res = await axios.post(
        "/chat/ask",
        {
          question: cleanQuestion,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message || res.data?.error || "Failed to get answer."
        );
      }

      const answer =
        res.data.data?.answer ||
        "I could not find an exact answer. Please submit a support ticket and our admin team will review it.";

      setTimeout(() => {
        setMessages((prev) => [...prev, createMessage("bot", answer)]);
        playSupportSound("reply");

        const customer = getStoredCustomer();

        setTicketForm((prev) => ({
          ...prev,
          name: prev.name || customer?.name || "",
          email: prev.email || customer?.email || "",
          phone: prev.phone || customer?.phone || "",
          message:
            prev.message || (!res.data.matched ? cleanQuestion : ""),
        }));

        // Add the ticket prompt shortly after the answer. This keeps the answer
        // visible and allows the down-arrow to indicate more content below.
        window.setTimeout(() => {
          setCanSubmitTicket(true);
        }, 220);
      }, 250);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to get answer."
      );
    } finally {
      setAsking(false);
    }
  }

  async function submitQuestion(event) {
    event.preventDefault();
    await askQuestion(question);
  }

  async function submitTicket(event) {
    event.preventDefault();

    try {
      const name = String(ticketForm.name || "").trim();
      const email = String(ticketForm.email || "").trim();
      const phone = String(ticketForm.phone || "").trim();
      const message = String(ticketForm.message || "").trim();

      if (!name) {
        throw new Error("Name is required.");
      }

      if (!email) {
        throw new Error("Email is required.");
      }

      if (!phone) {
        throw new Error("Phone is required.");
      }

      if (message.length < 5) {
        throw new Error("Message is required.");
      }

      setTicketSubmitting(true);
      setError("");
      setTicketSuccess("");

      const res = await axios.post(
        "/support/tickets",
        {
          name,
          email,
          phone,
          booking_id: ticketForm.booking_id,
          message,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      if (!res.data?.success) {
        throw new Error(
          res.data?.message ||
            res.data?.error ||
            "Failed to submit support ticket."
        );
      }

      const ticketId = res.data.data?.ticket?.ticket_id || "";

      const successText = ticketId
        ? `Support ticket submitted successfully. Ticket ID: ${ticketId}`
        : "Support ticket submitted successfully.";

      setTicketSuccess(successText);
      playSupportSound("success");

      setMessages((prev) => [
        ...prev,
        createMessage(
          "bot",
          ticketId
            ? `Your support ticket has been submitted. Ticket ID: ${ticketId}. Admin will contact you soon.`
            : "Your support ticket has been submitted. Admin will contact you soon."
        ),
      ]);

      setTicketMode(false);
      setCanSubmitTicket(false);
      setTicketForm((prev) => ({
        ...prev,
        booking_id: "",
        message: "",
      }));
    } catch (error) {
      setError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to submit support ticket."
      );
    } finally {
      setTicketSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[9997] flex items-center gap-2 sm:bottom-5 sm:right-5">
        {!open && (
          <button
            type="button"
            onClick={() => {
              playSupportSound("open");
              setOpen(true);
            }}
            className="group rounded-full border border-blue-100 bg-white px-3.5 py-2.5 text-xs font-extrabold text-blue-700 shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50"
          >
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500 shadow-[0_0_0_4px_rgba(34,197,94,0.18)]" />
            Need Help?
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            playSupportSound(open ? "send" : "open");
            setOpen((prev) => !prev);
          }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-[0_16px_38px_rgba(37,99,235,0.34)] transition hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(37,99,235,0.42)]"
          aria-label="Open support chat"
        >
          {open ? (
            <span className="text-3xl leading-none">×</span>
          ) : (
            <span className="text-2xl">💬</span>
          )}
        </button>
      </div>

      {open && (
        <div className="fixed right-3 top-[84px] z-[9997] flex h-[calc(100dvh-158px)] max-h-[590px] w-[calc(100vw-1.5rem)] max-w-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] sm:right-5 lg:top-[136px] lg:h-[calc(100dvh-218px)]">
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-4 py-3.5 text-white">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
            <div className="absolute bottom-0 right-16 h-20 w-20 rounded-full bg-white/10" />

            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-xl shadow-inner">
                  🤖
                </div>

                <div>
                  <h3 className="truncate text-base font-extrabold tracking-tight">
                    Sovereign Assistant
                  </h3>
                  <p className="mt-0.5 text-[11px] font-medium text-blue-100">
                    Replies instantly
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-lg font-bold text-white hover:bg-white/20"
                aria-label="Close support chat"
              >
                ×
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            <div
              ref={messagesScrollRef}
              onScroll={updateScrollToBottomVisibility}
              className="h-full scroll-py-4 overscroll-contain overflow-y-auto bg-slate-50 px-3 py-4"
            >
              <div className="">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex max-w-[88%] gap-1.5 ${
                      message.sender === "user"
                        ? "flex-row-reverse"
                        : "flex-row"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                        message.sender === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-blue-700 shadow-sm"
                      }`}
                    >
                      {message.sender === "user" ? "Y" : "🤖"}
                    </div>

                    <div>
                      <div
                        className={`rounded-2xl px-3 py-2.5 text-[13px] leading-5 shadow-sm ${
                          message.sender === "user"
                            ? "rounded-tr-sm bg-blue-600 text-white"
                            : "rounded-tl-sm bg-white text-gray-800"
                        }`}
                      >
                        {message.text}
                      </div>

                      <p
                        className={`mt-1 text-[10px] text-gray-400 ${
                          message.sender === "user"
                            ? "text-right"
                            : "text-left"
                        }`}
                      >
                        {formatTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {asking && (
                <div className="flex justify-start">
                  <div className="flex max-w-[80%] gap-1.5">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs text-blue-700 shadow-sm">
                      🤖
                    </div>

                    <div className="rounded-2xl rounded-tl-sm bg-white px-3 py-2.5 shadow-sm">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:120ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:240ms]" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!ticketMode && messages.length === 1 && (
                <div className="flex flex-col items-start gap-2 pt-3">
                  <p className="pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">
                    Quick questions
                  </p>

                  <div className="flex w-full flex-col items-start gap-2">
                    {QUICK_QUESTIONS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => askQuestion(item)}
                        disabled={asking}
                        className="inline-flex w-auto max-w-full rounded-full border border-blue-100 bg-white px-3.5 py-2 text-left text-[12px] font-semibold leading-4 text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-60"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {canSubmitTicket && !ticketMode && !ticketSuccess && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <p className="text-[12px] font-semibold leading-5 text-blue-900">
                    Need anything else? Please raise a support ticket and our
                    team will contact you.
                  </p>

                  <button
                    type="button"
                    onClick={() => openTicketForm()}
                    className="mt-2 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-extrabold text-white transition hover:bg-blue-700"
                  >
                    Raise Support Ticket
                  </button>
                </div>
              )}

              {ticketSuccess && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-[12px] leading-5 text-green-700">
                  {ticketSuccess}
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] leading-5 text-red-700">
                  {error}
                </div>
              )}

                <div ref={messagesEndRef} className="h-2" />
              </div>
            </div>

            {showScrollToBottom && (
              <button
                type="button"
                onClick={() => scrollMessagesToBottom("smooth")}
                className="absolute bottom-3 left-1/2 z-20 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-blue-200 bg-white text-lg font-bold text-blue-700 shadow-[0_8px_22px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-blue-50"
                aria-label="Scroll to latest message"
                title="Scroll to latest message"
              >
                ↓
              </button>
            )}
          </div>

          {ticketMode ? (
            <form
              onSubmit={submitTicket}
              className="max-h-[76%] shrink-0 space-y-2.5 overflow-y-auto border-t bg-white p-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[13px] font-extrabold text-gray-950">
                    Submit Support Ticket
                  </h4>
                  <p className="mt-0.5 text-[10px] text-gray-500">
                    Admin will reply by email.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTicketMode(false);
                    setError("");
                  }}
                  disabled={ticketSubmitting}
                  className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Back
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={ticketForm.name}
                  onChange={(event) =>
                    updateTicketField("name", event.target.value)
                  }
                  placeholder="Name"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-600"
                  required
                />

                <input
                  type="email"
                  value={ticketForm.email}
                  onChange={(event) =>
                    updateTicketField("email", event.target.value)
                  }
                  placeholder="Email"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-600"
                  required
                />

                <input
                  value={ticketForm.phone}
                  onChange={(event) =>
                    updateTicketField("phone", event.target.value)
                  }
                  placeholder="Phone"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-600"
                  required
                />

                <input
                  value={ticketForm.booking_id}
                  onChange={(event) =>
                    updateTicketField("booking_id", event.target.value)
                  }
                  placeholder="Booking ID optional"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-600"
                />
              </div>

              <textarea
                value={ticketForm.message}
                onChange={(event) =>
                  updateTicketField("message", event.target.value)
                }
                placeholder="Write your message"
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-600"
                required
              />

              <button
                type="submit"
                disabled={ticketSubmitting}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {ticketSubmitting ? "Submitting..." : "Submit Ticket"}
              </button>
            </form>
          ) : (
            <form onSubmit={submitQuestion} className="shrink-0 border-t bg-white p-3">
              <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1.5 focus-within:border-blue-500">
                <textarea
                  ref={inputRef}
                  value={question}
                  onChange={(event) => {
                    setQuestion(event.target.value);
                    setError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submitQuestion(event);
                    }
                  }}
                  placeholder="Message Sovereign Assistant..."
                  rows={1}
                  className="max-h-20 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-[13px] leading-5 outline-none"
                />

                <button
                  type="submit"
                  disabled={asking || !question.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send message"
                >
                  ↑
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}