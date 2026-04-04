import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import {
  HelpCircle, ChevronDown, Send, MessageSquare, Mail,
  Loader2, CheckCircle, AlertCircle, Plus, ArrowLeft, Clock,
  Ticket, ChevronRight
} from "lucide-react";

interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

interface TicketMessageData {
  id: string;
  ticketId: string;
  userId: string;
  message: string;
  isStaff: boolean;
  createdAt: string;
}

interface TicketDetail extends SupportTicket {
  messages: TicketMessageData[];
}

/* ────────────────────────────────────────────────────────────
   FAQ Data
   ──────────────────────────────────────────────────────────── */

const FAQ_ITEMS = [
  {
    question: "How do I know the cards are dealt fairly?",
    answer:
      "Every shuffle on High Rollers Club uses SHA-256 cryptographic verification with multi-party entropy. " +
      "Before each hand, a server seed and player seeds are combined to produce the deck order. You can verify " +
      "any hand after it completes by checking the hash against the revealed seeds in your hand history.",
  },
  {
    question: "Are the chips worth real money?",
    answer:
      "No. All chips and virtual currency on High Rollers Club are for entertainment purposes only. They have " +
      "no real-world monetary value and cannot be exchanged for cash, goods, or services. This is a social " +
      "gaming platform, not a gambling site.",
  },
  {
    question: "How do I create or join a private club?",
    answer:
      'Navigate to "Browse Clubs" from the sidebar to find existing clubs, or click "Create Club" to start ' +
      "your own. Club owners can set membership rules, run private tournaments, and manage their community. " +
      "Invite friends using shareable invite links.",
  },
  {
    question: "What should I do if I suspect cheating at my table?",
    answer:
      "Report suspicious behavior immediately using the in-game report button or by contacting support through " +
      "the form below. Include the table ID, hand numbers, and the usernames involved. Our integrity team " +
      "reviews all reports and has access to complete hand histories and behavioral analytics.",
  },
  {
    question: "Can I play on mobile devices?",
    answer:
      "Yes. High Rollers Club is a fully responsive web application that works on phones, tablets, and desktops. " +
      "No app download is required -- simply visit the site in your mobile browser. We recommend using the latest " +
      "version of Chrome, Safari, or Firefox for the best experience.",
  },
  {
    question: "How do tournaments work?",
    answer:
      "We support Sit & Go tournaments and scheduled multi-table tournaments (MTTs). Club owners can create " +
      "custom tournaments with configurable blind structures, starting stacks, and payout distributions. " +
      "Check the Tournaments section for upcoming events.",
  },
  {
    question: "How do I recover my account if I lose access?",
    answer:
      "Visit the Account Recovery page from the login screen. You can reset your password via email verification. " +
      "If you no longer have access to your registered email, contact support with your username and any " +
      "account details you can provide for manual verification.",
  },
  {
    question: "Is video chat available at tables?",
    answer:
      "Yes. High Rollers Club supports live WebRTC video chat at tables. You can enable or disable your camera " +
      "and microphone at any time during gameplay. Video chat is optional and fully controlled by each player.",
  },
];

/* ────────────────────────────────────────────────────────────
   FAQ Accordion Item
   ──────────────────────────────────────────────────────────── */

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/[0.06] last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 px-1 text-left group"
      >
        <span className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors pr-4">
          {question}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-sm text-gray-400 leading-relaxed pb-4 px-1">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Contact Form
   ──────────────────────────────────────────────────────────── */

function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canSubmit = name.trim() && email.trim() && subject.trim() && message.trim() && !sending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() }),
      });

      if (res.ok) {
        setResult({ type: "success", text: "Your message has been sent. We will get back to you as soon as possible." });
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
      } else {
        const data = await res.json().catch(() => ({}));
        setResult({ type: "error", text: data.message || "Failed to send message. Please try again." });
      }
    } catch {
      setResult({ type: "error", text: "Network error. Please check your connection and try again." });
    } finally {
      setSending(false);
    }
  };

  const inputClasses =
    "w-full rounded-lg px-4 py-3 text-sm bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-500 " +
    "focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className={inputClasses}
            maxLength={100}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClasses}
            maxLength={200}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="What is this about?"
          className={inputClasses}
          maxLength={200}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your issue or question in detail..."
          rows={5}
          className={`${inputClasses} resize-none`}
          maxLength={5000}
        />
      </div>

      {result && (
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            result.type === "success"
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {result.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {result.text}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-bold uppercase tracking-wider transition-all bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {sending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        {sending ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}

/* ────────────────────────────────────────────────────────────
   Support Page
   ──────────────────────────────────────────────────────────── */

export default function Support() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);

  // New ticket form
  const [newCategory, setNewCategory] = useState("other");
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketResult, setTicketResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Reply
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const loadTickets = async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch("/api/support/tickets", { credentials: "include" });
      if (res.ok) setTickets(await res.json());
    } catch {} finally {
      setTicketsLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadTickets();
  }, [user]);

  const loadTicketDetail = async (ticketId: string) => {
    setTicketLoading(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, { credentials: "include" });
      if (res.ok) setSelectedTicket(await res.json());
    } catch {} finally {
      setTicketLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim()) return;
    setSubmittingTicket(true);
    setTicketResult(null);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subject: newSubject.trim(),
          message: newMessage.trim(),
          category: newCategory,
          priority: newPriority,
        }),
      });
      if (res.ok) {
        setTicketResult({ type: "success", text: "Ticket created successfully!" });
        setNewSubject("");
        setNewMessage("");
        setNewCategory("other");
        setNewPriority("medium");
        setShowNewTicket(false);
        loadTickets();
      } else {
        const data = await res.json().catch(() => ({}));
        setTicketResult({ type: "error", text: data.message || "Failed to create ticket" });
      }
    } catch {
      setTicketResult({ type: "error", text: "Network error" });
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/support/tickets/${selectedTicket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: replyMessage.trim() }),
      });
      if (res.ok) {
        const msg = await res.json();
        setSelectedTicket(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
        setReplyMessage("");
      }
    } catch {} finally {
      setSendingReply(false);
    }
  };

  const inputClasses =
    "w-full rounded-lg px-4 py-3 text-sm bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-500 " +
    "focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors";

  const statusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "in-progress": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "resolved": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "closed": return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-black text-white">Support</h1>
              <p className="text-xs text-gray-500 mt-0.5">Get help and answers to common questions</p>
            </div>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            Browse the frequently asked questions below, submit a ticket, or send us a message.
          </p>
        </div>

        {/* My Tickets Section */}
        {user && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-white">My Tickets</h2>
              </div>
              <button
                onClick={() => { setShowNewTicket(!showNewTicket); setSelectedTicket(null); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New Ticket
              </button>
            </div>

            {/* New Ticket Form */}
            <AnimatePresence>
              {showNewTicket && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-6"
                >
                  <form onSubmit={handleCreateTicket} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Category</label>
                        <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className={inputClasses}>
                          <option value="account">Account</option>
                          <option value="payment">Payment</option>
                          <option value="game">Game</option>
                          <option value="technical">Technical</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Priority</label>
                        <select value={newPriority} onChange={e => setNewPriority(e.target.value)} className={inputClasses}>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Subject</label>
                      <input
                        type="text"
                        value={newSubject}
                        onChange={e => setNewSubject(e.target.value)}
                        placeholder="Brief description of your issue"
                        className={inputClasses}
                        maxLength={200}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Message</label>
                      <textarea
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="Describe your issue in detail..."
                        rows={4}
                        className={`${inputClasses} resize-none`}
                        maxLength={5000}
                      />
                    </div>
                    {ticketResult && (
                      <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
                        ticketResult.type === "success"
                          ? "bg-green-500/10 border border-green-500/20 text-green-400"
                          : "bg-red-500/10 border border-red-500/20 text-red-400"
                      }`}>
                        {ticketResult.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                        {ticketResult.text}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={!newSubject.trim() || !newMessage.trim() || submittingTicket}
                      className="flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-bold uppercase tracking-wider transition-all bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {submittingTicket ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {submittingTicket ? "Submitting..." : "Submit Ticket"}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Ticket Detail View */}
            {selectedTicket ? (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
                  <button onClick={() => setSelectedTicket(null)} className="text-gray-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">{selectedTicket.subject}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[0.5625rem] font-bold px-2 py-0.5 rounded border ${statusColor(selectedTicket.status)}`}>
                        {selectedTicket.status}
                      </span>
                      <span className="text-[0.5625rem] text-gray-500 capitalize">{selectedTicket.category}</span>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="px-5 py-4 space-y-4 max-h-96 overflow-y-auto">
                  {ticketLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                  ) : (
                    selectedTicket.messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.isStaff ? "justify-start" : "justify-end"}`}>
                        <div className={`max-w-[80%] rounded-lg px-4 py-3 ${
                          msg.isStaff
                            ? "bg-blue-500/10 border border-blue-500/20"
                            : "bg-white/[0.04] border border-white/[0.08]"
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[0.5625rem] font-bold text-gray-400">
                              {msg.isStaff ? "Staff" : "You"}
                            </span>
                            <span className="text-[0.5rem] text-gray-600">
                              {new Date(msg.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-300 whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Reply */}
                {selectedTicket.status !== "closed" && (
                  <div className="px-5 py-4 border-t border-white/[0.06] flex gap-3">
                    <input
                      type="text"
                      value={replyMessage}
                      onChange={e => setReplyMessage(e.target.value)}
                      placeholder="Type a reply..."
                      className={`${inputClasses} flex-1`}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={!replyMessage.trim() || sendingReply}
                      className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-bold hover:bg-primary/20 transition-colors disabled:opacity-40"
                    >
                      {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Ticket List */
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                {ticketsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                ) : tickets.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500">
                    No tickets yet. Create one if you need help!
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {tickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        onClick={() => loadTicketDetail(ticket.id)}
                        className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white truncate">{ticket.subject}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[0.5625rem] font-bold px-2 py-0.5 rounded border ${statusColor(ticket.status)}`}>
                              {ticket.status}
                            </span>
                            <span className="text-[0.5625rem] text-gray-500 capitalize">{ticket.category}</span>
                            <span className="text-[0.5625rem] text-gray-600 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(ticket.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* FAQ Section */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-5">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">Frequently Asked Questions</h2>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 md:p-6">
            {FAQ_ITEMS.map((item, i) => (
              <FAQItem key={i} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>

        {/* Contact Section */}
        <div>
          <div className="flex items-center gap-2 mb-5">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-white">Contact Us</h2>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 md:p-6">
            <ContactForm />
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-600">
          We typically respond to support requests within 24 hours.
        </div>
      </div>
    </DashboardLayout>
  );
}
