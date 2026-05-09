"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Plus, Check, X, Copy, Sparkles, TrendingUp, Users, FileText,
  Trash2, Clock, Loader2, ArrowUpRight, Database,
  AlertTriangle, ShieldCheck, ChevronRight, Settings, ExternalLink, Link2,
  CreditCard, Info, Search,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip as RTooltip,
} from "recharts";

// ──────────────────────────────────────────────────────────────────────────
// Design tokens
// ──────────────────────────────────────────────────────────────────────────
const C = {
  paper: "#F4EFE6",
  paperDeep: "#EDE6D8",
  ink: "#1A1715",
  inkSoft: "#3D3934",
  muted: "#867F73",
  rule: "#D4CBB9",
  urgent: "#C8341A",
  warn: "#B07818",
  ok: "#5A6B2C",
  stripe: "#635BFF",
};
const fontDisplay = "'Instrument Serif', 'Times New Roman', serif";
const fontBody = "'Manrope', system-ui, sans-serif";
const fontMono = "'JetBrains Mono', 'Courier New', monospace";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────
type Invoice = {
  id: string;
  client: string;
  clientEmail: string;
  invoiceNumber: string;
  amount: number;
  issuedDate: string;
  dueDate: string;
  paidDate: string | null;
};

type StripeSettings = {
  publishableKey: string;
  proLink: string;
  businessLink: string;
  invoiceLink: string;
  senderName: string;
  senderEmail: string;
};

type ServerStripe = {
  configured: boolean;
  hasPro: boolean;
  hasBusiness: boolean;
  hasWebhook: boolean;
};

type StatusKey =
  | "paid" | "upcoming" | "duetoday" | "recent" | "late" | "serious" | "critical";
type Tone = "ok" | "warn" | "urgent" | "neutral";
type StatusInfo = { key: StatusKey; label: string; tone: Tone; daysLate: number };

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
const today = () => new Date(new Date().toDateString());
const daysBetween = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / 86_400_000);
const fmtMoney = (n: number) =>
  `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const getStatus = (inv: Invoice): StatusInfo => {
  if (inv.paidDate) return { key: "paid", label: "Paid", tone: "ok", daysLate: 0 };
  const due = new Date(inv.dueDate);
  const diff = daysBetween(today(), due);
  if (diff < 0) return { key: "upcoming", label: `Due in ${-diff}d`, tone: "neutral", daysLate: 0 };
  if (diff === 0) return { key: "duetoday", label: "Due today", tone: "warn", daysLate: 0 };
  if (diff <= 7) return { key: "recent", label: `${diff}d late`, tone: "warn", daysLate: diff };
  if (diff <= 30) return { key: "late", label: `${diff}d late`, tone: "warn", daysLate: diff };
  if (diff <= 60) return { key: "serious", label: `${diff}d late`, tone: "urgent", daysLate: diff };
  return { key: "critical", label: `${diff}d late`, tone: "urgent", daysLate: diff };
};
const toneColor = (t: Tone) =>
  ({ ok: C.ok, warn: C.warn, urgent: C.urgent, neutral: C.muted }[t] || C.muted);

const isStripeUrl = (url: string) => {
  if (!url) return false;
  return /^https:\/\/(buy\.stripe\.com|.*\.stripe\.com|checkout\.stripe\.com)/.test(url);
};

const buildPayLink = (baseUrl: string, inv: Invoice) => {
  if (!baseUrl || !isStripeUrl(baseUrl)) return null;
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("client_reference_id", inv.invoiceNumber);
    if (inv.clientEmail) url.searchParams.set("prefilled_email", inv.clientEmail);
    return url.toString();
  } catch {
    return null;
  }
};

const SAMPLE = (): Invoice[] => {
  const t = today();
  const offset = (d: number) => {
    const x = new Date(t);
    x.setDate(x.getDate() + d);
    return x.toISOString().slice(0, 10);
  };
  return [
    { id: "1", client: "Hartwell & Co. Architects", clientEmail: "accounts@hartwell-co.com", invoiceNumber: "INV-2041", amount: 8500,  issuedDate: offset(-95),  dueDate: offset(-65), paidDate: null },
    { id: "2", client: "Meridian Ventures",         clientEmail: "finance@meridianvc.com",   invoiceNumber: "INV-2042", amount: 3200,  issuedDate: offset(-50),  dueDate: offset(-20), paidDate: null },
    { id: "3", client: "Northstar Logistics",       clientEmail: "ap@northstarlog.com",      invoiceNumber: "INV-2043", amount: 12400, issuedDate: offset(-40),  dueDate: offset(-10), paidDate: null },
    { id: "4", client: "Hartwell & Co. Architects", clientEmail: "accounts@hartwell-co.com", invoiceNumber: "INV-2038", amount: 5000,  issuedDate: offset(-150), dueDate: offset(-120), paidDate: offset(-95) },
    { id: "5", client: "Bright Lane Studio",        clientEmail: "hello@brightlane.studio",  invoiceNumber: "INV-2044", amount: 1800,  issuedDate: offset(-25),  dueDate: offset(5),   paidDate: null },
    { id: "6", client: "Northstar Logistics",       clientEmail: "ap@northstarlog.com",      invoiceNumber: "INV-2039", amount: 9600,  issuedDate: offset(-110), dueDate: offset(-80), paidDate: offset(-30) },
    { id: "7", client: "Calderon Legal Group",      clientEmail: "billing@calderonlegal.com", invoiceNumber: "INV-2045", amount: 4400, issuedDate: offset(-35),  dueDate: offset(-5),  paidDate: null },
    { id: "8", client: "Bright Lane Studio",        clientEmail: "hello@brightlane.studio",  invoiceNumber: "INV-2040", amount: 2200,  issuedDate: offset(-80),  dueDate: offset(-50), paidDate: offset(-45) },
  ];
};

const DEFAULT_STRIPE: StripeSettings = {
  publishableKey: "",
  proLink: "",
  businessLink: "",
  invoiceLink: "",
  senderName: "",
  senderEmail: "",
};

// ──────────────────────────────────────────────────────────────────────────
// AI email generation (calls our Next.js API route)
// ──────────────────────────────────────────────────────────────────────────
async function generateReminderEmail(args: {
  inv: Invoice;
  daysLate: number;
  userContext: string;
  payLink: string | null;
  senderName: string;
}) {
  const res = await fetch("/api/reminder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || "Could not generate email");
  }
  return (await res.json()) as { subject: string; body: string };
}

// ──────────────────────────────────────────────────────────────────────────
// Local storage (replaces the artifact-only `window.storage`)
// ──────────────────────────────────────────────────────────────────────────
const lsGet = (key: string) => {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
};
const lsSet = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, value); } catch {}
};

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
export default function InvoiceSentry() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stripeSettings, setStripeSettings] = useState<StripeSettings>(DEFAULT_STRIPE);
  const [serverStripe, setServerStripe] = useState<ServerStripe>({ configured: false, hasPro: false, hasBusiness: false, hasWebhook: false });
  const [toast, setToast] = useState<{ message: string; tone: "ok" | "warn" } | null>(null);
  const [view, setView] = useState<"invoices" | "clients" | "aging" | "business">("invoices");
  const [showAdd, setShowAdd] = useState(false);
  const [reminder, setReminder] = useState<Invoice | null>(null);
  const [payLinkInv, setPayLinkInv] = useState<Invoice | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "overdue" | "paid">("all");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const inv = lsGet("invoices_v1");
    if (inv) {
      try { setInvoices(JSON.parse(inv)); } catch {}
    }
    const s = lsGet("stripe_settings_v1");
    if (s) {
      try { setStripeSettings({ ...DEFAULT_STRIPE, ...JSON.parse(s) }); } catch {}
    }
    setLoaded(true);

    // Probe server for Stripe config
    fetch("/api/stripe/status")
      .then((r) => r.json())
      .then((data: ServerStripe) => setServerStripe(data))
      .catch(() => {});
  }, []);

  // Auto-show toast for a few seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => { if (loaded) lsSet("invoices_v1", JSON.stringify(invoices)); }, [invoices, loaded]);
  useEffect(() => { if (loaded) lsSet("stripe_settings_v1", JSON.stringify(stripeSettings)); }, [stripeSettings, loaded]);

  const stripeStatus = useMemo(() => {
    const hasAny = !!(stripeSettings.proLink || stripeSettings.businessLink || stripeSettings.invoiceLink);
    const hasInvoiceLink = !!stripeSettings.invoiceLink;
    const hasPricing = !!(stripeSettings.proLink && stripeSettings.businessLink);
    return { connected: hasAny, hasInvoiceLink, hasPricing, complete: hasAny && hasInvoiceLink && hasPricing };
  }, [stripeSettings]);

  const stats = useMemo(() => {
    const open = invoices.filter((i) => !i.paidDate);
    const outstanding = open.reduce((s, i) => s + Number(i.amount || 0), 0);
    const overdueList = open.filter((i) => getStatus(i).daysLate > 0);
    const overdue = overdueList.reduce((s, i) => s + Number(i.amount || 0), 0);
    const recovered = invoices
      .filter((i) => i.paidDate && daysBetween(today(), new Date(i.paidDate)) <= 30)
      .reduce((s, i) => s + Number(i.amount || 0), 0);
    const paidWithDays = invoices.filter((i) => i.paidDate);
    const avgDays =
      paidWithDays.length === 0
        ? 0
        : Math.round(
            paidWithDays.reduce(
              (s, i) => s + Math.max(0, daysBetween(new Date(i.paidDate!), new Date(i.dueDate))),
              0,
            ) / paidWithDays.length,
          );
    const buckets: Record<string, number> = { Current: 0, "1–30 days": 0, "31–60 days": 0, "60+ days": 0 };
    open.forEach((i) => {
      const d = getStatus(i).daysLate;
      const a = Number(i.amount || 0);
      if (d <= 0) buckets.Current += a;
      else if (d <= 30) buckets["1–30 days"] += a;
      else if (d <= 60) buckets["31–60 days"] += a;
      else buckets["60+ days"] += a;
    });
    const agingData = Object.entries(buckets).map(([k, v]) => ({ name: k, amount: v }));
    return {
      outstanding, overdue, recovered, avgDays, agingData,
      openCount: open.length, overdueCount: overdueList.length,
    };
  }, [invoices]);

  const clientStats = useMemo(() => {
    const map: Record<string, {
      name: string; total: number; outstanding: number; paidLate: number;
      paidOnTime: number; daysToPaySum: number; paidCount: number; openCount: number;
      maxDaysLate: number;
    }> = {};
    invoices.forEach((i) => {
      if (!map[i.client]) {
        map[i.client] = {
          name: i.client, total: 0, outstanding: 0, paidLate: 0, paidOnTime: 0,
          daysToPaySum: 0, paidCount: 0, openCount: 0, maxDaysLate: 0,
        };
      }
      const m = map[i.client];
      m.total += Number(i.amount || 0);
      if (i.paidDate) {
        m.paidCount++;
        const d = Math.max(0, daysBetween(new Date(i.paidDate), new Date(i.dueDate)));
        m.daysToPaySum += d;
        if (d > 0) m.paidLate++;
        else m.paidOnTime++;
      } else {
        m.outstanding += Number(i.amount || 0);
        m.openCount++;
        m.maxDaysLate = Math.max(m.maxDaysLate, getStatus(i).daysLate);
      }
    });
    return Object.values(map)
      .map((m) => {
        const avg = m.paidCount ? m.daysToPaySum / m.paidCount : 0;
        let risk: "good" | "watch" | "high" = "good";
        let riskScore = 1;
        if (avg > 30 || m.maxDaysLate > 60) { risk = "high"; riskScore = 3; }
        else if (avg > 14 || m.maxDaysLate > 30) { risk = "watch"; riskScore = 2; }
        return { ...m, avgDaysLate: Math.round(avg), risk, riskScore };
      })
      .sort((a, b) => b.riskScore - a.riskScore || b.outstanding - a.outstanding);
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices
      .filter((i) => {
        const s = getStatus(i);
        if (filter === "overdue" && s.daysLate <= 0) return false;
        if (filter === "open" && i.paidDate) return false;
        if (filter === "paid" && !i.paidDate) return false;
        if (q) {
          const blob = `${i.client} ${i.invoiceNumber} ${i.clientEmail || ""}`.toLowerCase();
          if (!blob.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (!a.paidDate && b.paidDate) return -1;
        if (a.paidDate && !b.paidDate) return 1;
        return getStatus(b).daysLate - getStatus(a).daysLate;
      });
  }, [invoices, filter, search]);

  const addInvoice = (inv: Omit<Invoice, "id">) =>
    setInvoices([{ ...inv, id: crypto.randomUUID() }, ...invoices]);
  const deleteInvoice = (id: string) => setInvoices(invoices.filter((i) => i.id !== id));
  const togglePaid = (id: string) =>
    setInvoices(
      invoices.map((i) =>
        i.id === id
          ? { ...i, paidDate: i.paidDate ? null : new Date().toISOString().slice(0, 10) }
          : i,
      ),
    );
  const markPaidByNumber = (invoiceNumber: string) =>
    setInvoices((prev) =>
      prev.map((i) =>
        i.invoiceNumber === invoiceNumber && !i.paidDate
          ? { ...i, paidDate: new Date().toISOString().slice(0, 10) }
          : i,
      ),
    );

  // Handle return from Stripe Checkout: ?paid=INV-2041&session_id=cs_...
  useEffect(() => {
    if (!loaded) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const paidNum = params.get("paid");
    const sessionId = params.get("session_id");
    const subscribed = params.get("subscribed");
    const canceled = params.get("canceled") || params.get("subscribe_canceled");

    const cleanUrl = () => {
      const u = new URL(window.location.href);
      ["paid", "session_id", "subscribed", "canceled", "subscribe_canceled"].forEach((k) =>
        u.searchParams.delete(k),
      );
      window.history.replaceState({}, "", u.toString());
    };

    if (paidNum && sessionId) {
      fetch(`/api/stripe/verify?session_id=${encodeURIComponent(sessionId)}`)
        .then((r) => r.json())
        .then((data: { paid?: boolean; error?: string }) => {
          if (data.paid) {
            markPaidByNumber(paidNum);
            setToast({ message: `Payment received for ${paidNum} — marked as paid.`, tone: "ok" });
          } else {
            setToast({ message: `Stripe could not confirm payment for ${paidNum}.`, tone: "warn" });
          }
        })
        .catch(() => setToast({ message: "Could not verify Stripe session.", tone: "warn" }))
        .finally(cleanUrl);
    } else if (subscribed && sessionId) {
      setToast({ message: `Subscribed to ${subscribed} plan — welcome aboard.`, tone: "ok" });
      cleanUrl();
    } else if (canceled) {
      setToast({ message: "Checkout canceled.", tone: "warn" });
      cleanUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  return (
    <div style={{ background: C.paper, minHeight: "100vh", fontFamily: fontBody, color: C.ink }}>
      <div className="grain" style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* Masthead */}
        <header style={{ borderBottom: `1px solid ${C.ink}`, paddingBottom: 16, marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted, fontFamily: fontMono, marginBottom: 14 }}>
            <span>Vol. 1 · Cash Flow Edition</span>
            <span suppressHydrationWarning>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontFamily: fontDisplay, fontSize: "clamp(48px, 8vw, 92px)", lineHeight: 0.92, fontWeight: 400, letterSpacing: "-0.02em", margin: 0 }}>
                Invoice<span style={{ fontStyle: "italic" }}>Sentry</span>
              </h1>
              <p style={{ fontSize: 14, color: C.inkSoft, marginTop: 8, maxWidth: 560, lineHeight: 1.5 }}>
                Cash-flow intelligence for service businesses. Track what&apos;s owed, predict who&apos;ll pay late, and recover overdue invoices with AI-written reminders <em>+ one-click Stripe payment links</em>.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <StripeBadge connected={stripeStatus.connected} onClick={() => setShowSettings(true)} />
              {invoices.length === 0 && loaded && (
                <button
                  onClick={() => setInvoices(SAMPLE())}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "transparent", border: `1px solid ${C.ink}`, color: C.ink, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: fontBody }}
                >
                  <Database size={14} /> Sample data
                </button>
              )}
              <button
                onClick={() => setShowSettings(true)}
                title="Stripe settings"
                aria-label="Stripe settings"
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", background: "transparent", border: `1px solid ${C.rule}`, color: C.inkSoft, cursor: "pointer" }}
              >
                <Settings size={14} />
              </button>
              <button
                onClick={() => setShowAdd(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", background: C.ink, color: C.paper, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: fontBody }}
              >
                <Plus size={14} /> New invoice
              </button>
            </div>
          </div>
        </header>

        {/* Stripe nudge banner */}
        {!stripeStatus.connected && invoices.length > 0 && (
          <div style={{ background: "#fff", border: `1px solid ${C.rule}`, borderLeft: `3px solid ${C.stripe}`, padding: "14px 18px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flex: "1 1 auto", minWidth: 240 }}>
              <CreditCard size={18} color={C.stripe} />
              <div style={{ fontSize: 13 }}>
                <strong>Connect Stripe</strong> to add one-click payment links to your reminder emails. Recovery rates jump 30–50% when clients can pay instantly.
              </div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: C.stripe, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: fontBody }}
            >
              Connect <ChevronRight size={13} />
            </button>
          </div>
        )}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 1, background: C.rule, border: `1px solid ${C.rule}`, marginBottom: 28 }}>
          <KPI label="Outstanding" value={fmtMoney(stats.outstanding)} sub={`${stats.openCount} open invoice${stats.openCount === 1 ? "" : "s"}`} loaded={loaded} />
          <KPI label="Overdue" value={fmtMoney(stats.overdue)} sub={`${stats.overdueCount} past due`} accent={stats.overdue > 0 ? C.urgent : C.ink} loaded={loaded} />
          <KPI label="Recovered (30d)" value={fmtMoney(stats.recovered)} sub="paid in last 30 days" loaded={loaded} />
          <KPI label="Avg. days to pay" value={stats.avgDays.toString()} sub="historical baseline" loaded={loaded} />
        </section>

        <nav style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.rule}`, marginBottom: 24, overflowX: "auto" }}>
          {[
            { k: "invoices", label: "Invoices", icon: FileText },
            { k: "clients",  label: "Clients",  icon: Users },
            { k: "aging",    label: "Aging",    icon: TrendingUp },
            { k: "business", label: "About this app", icon: Sparkles },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setView(t.k as typeof view)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "14px 20px", background: "transparent", border: "none",
                borderBottom: `2px solid ${view === t.k ? C.ink : "transparent"}`,
                color: view === t.k ? C.ink : C.muted,
                fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: fontBody,
                marginBottom: -1, whiteSpace: "nowrap",
              }}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </nav>

        {view === "invoices" && (
          <div className="fade-up">
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { k: "all", label: "All", count: invoices.length },
                  { k: "open", label: "Open", count: invoices.filter((i) => !i.paidDate).length },
                  { k: "overdue", label: "Overdue", count: stats.overdueCount },
                  { k: "paid", label: "Paid", count: invoices.filter((i) => i.paidDate).length },
                ].map((c) => (
                  <button
                    key={c.k}
                    onClick={() => setFilter(c.k as typeof filter)}
                    style={{
                      padding: "6px 12px", fontSize: 12, fontFamily: fontMono, letterSpacing: "0.04em",
                      background: filter === c.k ? C.ink : "transparent",
                      color: filter === c.k ? C.paper : C.inkSoft,
                      border: `1px solid ${filter === c.k ? C.ink : C.rule}`,
                      cursor: "pointer", textTransform: "uppercase",
                    }}
                  >
                    {c.label} <span style={{ opacity: 0.6, marginLeft: 4 }}>{c.count}</span>
                  </button>
                ))}
              </div>
              <div style={{ flex: "1 1 200px", minWidth: 180, position: "relative" }}>
                <Search size={14} color={C.muted} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search client, invoice #, email"
                  style={{ width: "100%", padding: "8px 12px 8px 32px", background: "#fff", border: `1px solid ${C.rule}`, fontSize: 13, fontFamily: fontBody, color: C.ink, boxSizing: "border-box" }}
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                onLoadSample={() => setInvoices(SAMPLE())}
                hasNone={invoices.length === 0}
                isFiltered={!!search || filter !== "all"}
              />
            ) : (
              <div style={{ background: "#fff", border: `1px solid ${C.rule}`, overflowX: "auto" }}>
                <div style={{ minWidth: 900 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1.1fr 1.1fr 1fr 1.6fr", padding: "12px 18px", borderBottom: `1px solid ${C.rule}`, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, fontFamily: fontMono }}>
                    <div>Client / Invoice</div>
                    <div style={{ textAlign: "right" }}>Amount</div>
                    <div>Due</div>
                    <div>Status</div>
                    <div>Paid</div>
                    <div style={{ textAlign: "right" }}>Actions</div>
                  </div>
                  {filtered.map((inv) => (
                    <InvoiceRow
                      key={inv.id}
                      inv={inv}
                      onTogglePaid={togglePaid}
                      onDelete={deleteInvoice}
                      onRemind={() => setReminder(inv)}
                      onPayLink={() => setPayLinkInv(inv)}
                      stripeReady={stripeStatus.hasInvoiceLink || serverStripe.configured}
                      serverConfigured={serverStripe.configured}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {view === "clients" && (
          <div className="fade-up">
            {clientStats.length === 0 ? (
              <EmptyState onLoadSample={() => setInvoices(SAMPLE())} hasNone={invoices.length === 0} />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                {clientStats.map((c) => (
                  <ClientCard key={c.name} c={c} />
                ))}
              </div>
            )}
          </div>
        )}

        {view === "aging" && (
          <div className="fade-up">
            <div style={{ background: "#fff", border: `1px solid ${C.rule}`, padding: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ fontFamily: fontDisplay, fontSize: 32, fontWeight: 400, margin: 0 }}>Receivables aging</h2>
                  <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>How much of your outstanding cash is sitting in each risk bucket.</p>
                </div>
                <div style={{ fontFamily: fontMono, fontSize: 12, color: C.muted }}>
                  Total at risk:{" "}
                  <span style={{ color: C.ink, fontWeight: 600 }}>{fmtMoney(stats.outstanding)}</span>
                </div>
              </div>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.agingData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: fontBody, fill: C.inkSoft }} axisLine={{ stroke: C.rule }} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fontFamily: fontMono, fill: C.muted }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <RTooltip
                      formatter={(v: number) => fmtMoney(v)}
                      cursor={{ fill: C.paperDeep }}
                      contentStyle={{ background: "#fff", border: `1px solid ${C.ink}`, fontSize: 12, fontFamily: fontBody }}
                    />
                    <Bar dataKey="amount" radius={[2, 2, 0, 0]}>
                      {stats.agingData.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? C.ok : i === 1 ? C.warn : i === 2 ? "#D86326" : C.urgent} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 1, background: C.rule, marginTop: 28, border: `1px solid ${C.rule}` }}>
                {stats.agingData.map((d, i) => (
                  <div key={d.name} style={{ background: "#fff", padding: 16 }}>
                    <div style={{ width: 24, height: 3, background: i === 0 ? C.ok : i === 1 ? C.warn : i === 2 ? "#D86326" : C.urgent, marginBottom: 8 }} />
                    <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, fontFamily: fontMono, marginBottom: 4 }}>{d.name}</div>
                    <div style={{ fontFamily: fontMono, fontSize: 22, fontWeight: 500 }}>{fmtMoney(d.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === "business" && <BusinessTab onShowPricing={() => setShowPricing(true)} stripeStatus={stripeStatus} />}

        <footer style={{ marginTop: 60, paddingTop: 20, borderTop: `1px solid ${C.rule}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, fontSize: 12, color: C.muted, fontFamily: fontMono }}>
          <span>Free tier: up to 10 invoices · Data saved locally on this device.</span>
          <button
            onClick={() => setShowPricing(true)}
            style={{ background: "transparent", border: "none", color: C.ink, fontFamily: fontMono, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
          >
            View pricing
          </button>
        </footer>
      </div>

      {showAdd && <AddInvoiceModal onAdd={addInvoice} onClose={() => setShowAdd(false)} />}
      {reminder && <ReminderModal inv={reminder} stripe={stripeSettings} onClose={() => setReminder(null)} />}
      {payLinkInv && (
        <PayLinkModal
          inv={payLinkInv}
          stripe={stripeSettings}
          serverConfigured={serverStripe.configured}
          onClose={() => setPayLinkInv(null)}
          onOpenSettings={() => { setPayLinkInv(null); setShowSettings(true); }}
        />
      )}
      {showPricing && (
        <PricingModal
          stripe={stripeSettings}
          serverStripe={serverStripe}
          onClose={() => setShowPricing(false)}
          onOpenSettings={() => { setShowPricing(false); setShowSettings(true); }}
        />
      )}
      {toast && (
        <div
          role="status"
          style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            background: toast.tone === "ok" ? C.ok : C.warn,
            color: "#fff", padding: "10px 18px", fontSize: 13, fontFamily: fontBody,
            zIndex: 100, animation: "fadeUp 0.25s ease",
            boxShadow: "0 8px 24px -8px rgba(0,0,0,0.3)",
          }}
        >
          {toast.message}
        </div>
      )}
      {showSettings && (
        <SettingsModal
          value={stripeSettings}
          onSave={setStripeSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

function StripeBadge({ connected, onClick }: { connected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "8px 12px",
        background: connected ? `${C.stripe}10` : "transparent",
        border: `1px solid ${connected ? C.stripe : C.rule}`,
        color: connected ? C.stripe : C.muted,
        fontSize: 11, fontFamily: fontMono, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? C.stripe : C.muted }} />
      Stripe {connected ? "connected" : "not connected"}
    </button>
  );
}

function KPI({
  label, value, sub, accent = C.ink, loaded,
}: { label: string; value: string; sub: string; accent?: string; loaded: boolean }) {
  return (
    <div style={{ background: "#fff", padding: "20px 22px" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, fontFamily: fontMono, marginBottom: 10 }}>
        {label}
      </div>
      {loaded ? (
        <div style={{ fontFamily: fontMono, fontSize: 30, fontWeight: 500, color: accent, lineHeight: 1, letterSpacing: "-0.01em" }}>
          {value}
        </div>
      ) : (
        <div style={{ height: 30, width: "60%", background: C.paperDeep }} />
      )}
      <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>{sub}</div>
    </div>
  );
}

function InvoiceRow({
  inv, onTogglePaid, onDelete, onRemind, onPayLink, stripeReady, serverConfigured,
}: {
  inv: Invoice;
  onTogglePaid: (id: string) => void;
  onDelete: (id: string) => void;
  onRemind: () => void;
  onPayLink: () => void;
  stripeReady: boolean;
  serverConfigured: boolean;
}) {
  const [hover, setHover] = useState(false);
  const [charging, setCharging] = useState(false);

  const chargeWithStripe = async () => {
    if (charging) return;
    setCharging(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount,
          client: inv.client,
          clientEmail: inv.clientEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Could not create checkout session");
      window.location.href = data.url;
    } catch (e) {
      setCharging(false);
      alert(e instanceof Error ? e.message : "Could not start Stripe checkout");
    }
  };
  const s = getStatus(inv);
  const color = toneColor(s.tone);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "2.2fr 1fr 1.1fr 1.1fr 1fr 1.6fr",
        padding: "14px 18px",
        borderBottom: `1px solid ${C.rule}`,
        fontSize: 14,
        alignItems: "center",
        background: hover ? C.paperDeep : "#fff",
        transition: "background 0.15s ease",
      }}
    >
      <div>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{inv.client}</div>
        <div style={{ fontFamily: fontMono, fontSize: 11, color: C.muted }}>
          {inv.invoiceNumber}
          {inv.clientEmail ? ` · ${inv.clientEmail}` : ""}
        </div>
      </div>
      <div style={{ textAlign: "right", fontFamily: fontMono, fontWeight: 500 }}>{fmtMoney(inv.amount)}</div>
      <div style={{ fontFamily: fontMono, fontSize: 12, color: C.inkSoft }}>{fmtDate(inv.dueDate)}</div>
      <div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", background: `${color}15`, color, fontSize: 11, fontFamily: fontMono, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {s.tone === "ok" && <Check size={10} />}
          {s.tone === "urgent" && <AlertTriangle size={10} />}
          {s.tone === "warn" && <Clock size={10} />}
          {s.label}
        </span>
      </div>
      <div style={{ fontFamily: fontMono, fontSize: 12, color: C.muted }}>
        {inv.paidDate ? fmtDate(inv.paidDate) : "—"}
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {!inv.paidDate && serverConfigured && (
          <button
            onClick={chargeWithStripe}
            disabled={charging}
            title="Charge via Stripe Checkout (server-side API)"
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", background: C.stripe, color: "#fff", border: "none", fontSize: 11, fontFamily: fontMono, fontWeight: 600, cursor: charging ? "wait" : "pointer", letterSpacing: "0.04em", opacity: charging ? 0.7 : 1 }}
          >
            {charging ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <CreditCard size={10} />}
            {charging ? "OPENING..." : "CHARGE"}
          </button>
        )}
        {!inv.paidDate && !serverConfigured && stripeReady && (
          <button
            onClick={onPayLink}
            title="Stripe pay link"
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", background: C.stripe, color: "#fff", border: "none", fontSize: 11, fontFamily: fontMono, fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em" }}
          >
            <Link2 size={10} /> PAY LINK
          </button>
        )}
        {!inv.paidDate && (
          <button
            onClick={onRemind}
            title="Generate reminder email"
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", background: C.ink, color: C.paper, border: "none", fontSize: 11, fontFamily: fontMono, fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em" }}
          >
            <Sparkles size={10} /> REMIND
          </button>
        )}
        <button
          onClick={() => onTogglePaid(inv.id)}
          title={inv.paidDate ? "Mark unpaid" : "Mark paid"}
          style={{
            padding: "5px 9px", background: "transparent",
            color: inv.paidDate ? C.ok : C.inkSoft,
            border: `1px solid ${inv.paidDate ? C.ok : C.rule}`,
            fontSize: 11, fontFamily: fontMono, fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em",
          }}
        >
          {inv.paidDate ? "✓ PAID" : "MARK PAID"}
        </button>
        <button
          onClick={() => onDelete(inv.id)}
          title="Delete"
          aria-label="Delete invoice"
          style={{ padding: "5px 7px", background: "transparent", color: C.muted, border: `1px solid ${C.rule}`, cursor: "pointer" }}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function ClientCard({ c }: { c: { name: string; total: number; outstanding: number; paidLate: number; paidOnTime: number; avgDaysLate: number; risk: "good" | "watch" | "high" } }) {
  const riskColor = c.risk === "high" ? C.urgent : c.risk === "watch" ? C.warn : C.ok;
  const RiskIcon = c.risk === "high" ? AlertTriangle : c.risk === "watch" ? Clock : ShieldCheck;
  const riskLabel = c.risk === "high" ? "High risk" : c.risk === "watch" ? "Watch list" : "Good standing";
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.rule}`, padding: 20, borderTop: `3px solid ${riskColor}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <h3 style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 400, margin: 0, lineHeight: 1.15 }}>{c.name}</h3>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", background: `${riskColor}15`, color: riskColor, fontSize: 10, fontFamily: fontMono, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          <RiskIcon size={10} /> {riskLabel}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <Stat label="Lifetime billed" value={fmtMoney(c.total)} />
        <Stat label="Outstanding" value={fmtMoney(c.outstanding)} accent={c.outstanding > 0 ? C.urgent : C.ink} />
        <Stat label="Avg. days late" value={c.avgDaysLate.toString()} />
        <Stat label="Paid late / on time" value={`${c.paidLate} / ${c.paidOnTime}`} />
      </div>
    </div>
  );
}

function Stat({ label, value, accent = C.ink }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, fontFamily: fontMono, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: fontMono, fontSize: 16, fontWeight: 500, color: accent }}>{value}</div>
    </div>
  );
}

function EmptyState({
  onLoadSample, hasNone, isFiltered = false,
}: { onLoadSample: () => void; hasNone: boolean; isFiltered?: boolean }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.rule}`, padding: "60px 24px", textAlign: "center" }}>
      <FileText size={36} color={C.muted} style={{ marginBottom: 16 }} />
      <h3 style={{ fontFamily: fontDisplay, fontSize: 28, fontWeight: 400, margin: "0 0 8px" }}>
        {hasNone ? "No invoices yet" : isFiltered ? "No matches" : "Nothing here"}
      </h3>
      <p style={{ fontSize: 14, color: C.muted, maxWidth: 380, margin: "0 auto 20px" }}>
        {hasNone
          ? "Add your first invoice or load sample data to see InvoiceSentry in action."
          : isFiltered
            ? "Try a different filter or clear your search."
            : "Try a different filter, or add a new invoice."}
      </p>
      {hasNone && (
        <button
          onClick={onLoadSample}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: C.ink, color: C.paper, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: fontBody }}
        >
          <Database size={14} /> Load sample data
        </button>
      )}
    </div>
  );
}

function AddInvoiceModal({
  onAdd, onClose,
}: {
  onAdd: (i: Omit<Invoice, "id">) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    client: "", clientEmail: "", invoiceNumber: "", amount: "",
    issuedDate: new Date().toISOString().slice(0, 10), dueDate: "",
  });
  const submit = () => {
    if (!form.client || !form.amount || !form.dueDate) return;
    onAdd({
      ...form,
      amount: Number(form.amount),
      paidDate: null,
      invoiceNumber: form.invoiceNumber || `INV-${Date.now().toString().slice(-5)}`,
    });
    onClose();
  };
  return (
    <Modal onClose={onClose} title="New invoice">
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="Client name *">
          <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="e.g. Acme Co." style={inputStyle} />
        </Field>
        <Field label="Client email (for pay links)">
          <input type="email" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} placeholder="accounts@acme.com" style={inputStyle} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Invoice number">
            <input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="auto" style={inputStyle} />
          </Field>
          <Field label="Amount ($) *">
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" style={inputStyle} />
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Issued">
            <input type="date" value={form.issuedDate} onChange={(e) => setForm({ ...form, issuedDate: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Due *">
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} style={inputStyle} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: "10px 16px", background: "transparent", border: `1px solid ${C.rule}`, fontSize: 13, fontFamily: fontBody, cursor: "pointer" }}>Cancel</button>
          <button onClick={submit} style={{ padding: "10px 18px", background: C.ink, color: C.paper, border: "none", fontSize: 13, fontWeight: 600, fontFamily: fontBody, cursor: "pointer" }}>Create invoice</button>
        </div>
      </div>
    </Modal>
  );
}

function ReminderModal({
  inv, stripe, onClose,
}: {
  inv: Invoice;
  stripe: StripeSettings;
  onClose: () => void;
}) {
  const status = getStatus(inv);
  const [context, setContext] = useState("");
  const [includePayLink, setIncludePayLink] = useState(true);
  const [email, setEmail] = useState<{ subject: string; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const payLink = stripe.invoiceLink ? buildPayLink(stripe.invoiceLink, inv) : null;
  const linkAvailable = !!payLink;

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateReminderEmail({
        inv,
        daysLate: status.daysLate,
        userContext: context,
        payLink: includePayLink && linkAvailable ? payLink : null,
        senderName: stripe.senderName,
      });
      setEmail(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not reach the AI service. Try again in a moment.";
      setError(msg);
    }
    setLoading(false);
  };

  const copy = () => {
    if (!email) return;
    const text = `Subject: ${email.subject}\n\n${email.body}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal onClose={onClose} title="Generate reminder email" wide>
      <div style={{ background: C.paperDeep, padding: 14, marginBottom: 16, fontSize: 13, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div><span style={{ color: C.muted }}>To:</span> <strong>{inv.client}</strong> · {inv.invoiceNumber}</div>
        <div><span style={{ color: C.muted }}>Amount:</span> <strong style={{ fontFamily: fontMono }}>{fmtMoney(inv.amount)}</strong></div>
        <div><span style={{ color: C.muted }}>Status:</span> <strong style={{ color: toneColor(status.tone) }}>{status.label}</strong></div>
      </div>

      {!email && (
        <>
          <Field label="Optional context for the AI">
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              placeholder="e.g. Long-term client, want to keep tone friendly. They mentioned cash-flow trouble last month."
              style={{ ...inputStyle, fontFamily: fontBody, resize: "vertical" }}
            />
          </Field>

          {linkAvailable && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px 12px", background: `${C.stripe}08`, border: `1px solid ${C.stripe}40`, cursor: "pointer", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={includePayLink}
                onChange={(e) => setIncludePayLink(e.target.checked)}
                style={{ accentColor: C.stripe }}
              />
              <Link2 size={14} color={C.stripe} />
              <span>Include Stripe pay-now link in the email <strong style={{ color: C.stripe }}>(recommended)</strong></span>
            </label>
          )}
          {!linkAvailable && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: C.paperDeep, fontSize: 12, color: C.muted, display: "flex", gap: 8, alignItems: "center" }}>
              <Info size={14} /> Configure your Stripe invoice payment link in Settings to include one-click pay buttons in reminders.
            </div>
          )}

          <div style={{ marginTop: 14, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
            {status.daysLate <= 7 && "✦ Tone: friendly nudge — assumes oversight"}
            {status.daysLate > 7 && status.daysLate <= 30 && "⚠ Tone: clear and direct — requests immediate action"}
            {status.daysLate > 30 && status.daysLate <= 60 && "⚠⚠ Tone: firm — mentions late fees and consequences"}
            {status.daysLate > 60 && "⚠⚠⚠ Tone: final notice — mentions collections referral"}
          </div>
          {error && <div style={{ marginTop: 12, padding: 10, background: `${C.urgent}15`, color: C.urgent, fontSize: 12 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
            <button onClick={onClose} style={{ padding: "10px 16px", background: "transparent", border: `1px solid ${C.rule}`, fontSize: 13, cursor: "pointer", fontFamily: fontBody }}>Cancel</button>
            <button
              onClick={generate}
              disabled={loading}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", background: C.ink, color: C.paper, border: "none", fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer", fontFamily: fontBody, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
              {loading ? "Writing..." : "Generate email"}
            </button>
          </div>
        </>
      )}

      {email && (
        <div className="fade-up">
          <div style={{ background: "#fff", border: `1px solid ${C.rule}`, marginBottom: 16 }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.rule}`, fontSize: 13 }}>
              <span style={{ color: C.muted, fontFamily: fontMono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>Subject:</span>{" "}
              <strong>{email.subject}</strong>
            </div>
            <div style={{ padding: 16, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 320, overflowY: "auto" }}>
              {email.body}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setEmail(null)} style={{ padding: "10px 16px", background: "transparent", border: `1px solid ${C.rule}`, fontSize: 13, cursor: "pointer", fontFamily: fontBody }}>Regenerate</button>
            <button
              onClick={copy}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", background: C.ink, color: C.paper, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: fontBody }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy email"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function PayLinkModal({
  inv, stripe, serverConfigured, onClose, onOpenSettings,
}: {
  inv: Invoice;
  stripe: StripeSettings;
  serverConfigured: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const link = buildPayLink(stripe.invoiceLink, inv);

  const createSession = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount,
          client: inv.client,
          clientEmail: inv.clientEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Could not create checkout session");
      window.location.href = data.url;
    } catch (e) {
      setCreating(false);
      alert(e instanceof Error ? e.message : "Could not start Stripe checkout");
    }
  };

  if (!stripe.invoiceLink && !serverConfigured) {
    return (
      <Modal onClose={onClose} title="Stripe pay link">
        <div style={{ padding: "20px 0", textAlign: "center" }}>
          <CreditCard size={36} color={C.stripe} style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, marginBottom: 18 }}>You haven&apos;t connected Stripe yet. Either set <code style={{ fontFamily: fontMono, fontSize: 12 }}>STRIPE_SECRET_KEY</code> on the server, or paste a Stripe Payment Link URL in Settings.</p>
          <button
            onClick={onOpenSettings}
            style={{ padding: "10px 18px", background: C.stripe, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: fontBody }}
          >
            Open Stripe settings
          </button>
        </div>
      </Modal>
    );
  }

  const copy = () => {
    if (!link) return;
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal onClose={onClose} title="Stripe pay link">
      <div style={{ background: C.paperDeep, padding: 14, marginBottom: 16, fontSize: 13, display: "grid", gap: 4 }}>
        <div><span style={{ color: C.muted }}>For:</span> <strong>{inv.client}</strong> · {inv.invoiceNumber}</div>
        <div><span style={{ color: C.muted }}>Amount:</span> <strong style={{ fontFamily: fontMono }}>{fmtMoney(inv.amount)}</strong></div>
        {inv.clientEmail && (
          <div>
            <span style={{ color: C.muted }}>Email pre-fill:</span>{" "}
            <span style={{ fontFamily: fontMono, fontSize: 12 }}>{inv.clientEmail}</span>
          </div>
        )}
      </div>

      {serverConfigured && (
        <div style={{ marginBottom: 16, padding: 14, background: `${C.stripe}08`, border: `1px solid ${C.stripe}40` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <CreditCard size={16} color={C.stripe} />
            <strong style={{ fontSize: 13 }}>Stripe Checkout (recommended)</strong>
          </div>
          <p style={{ fontSize: 12, color: C.inkSoft, margin: "0 0 12px", lineHeight: 1.5 }}>
            Creates a one-time Checkout Session for exactly <strong>{fmtMoney(inv.amount)}</strong> via the server-side Stripe API. After payment, the invoice is auto-marked paid.
          </p>
          <button
            onClick={createSession}
            disabled={creating}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", background: C.stripe, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: creating ? "wait" : "pointer", fontFamily: fontBody, opacity: creating ? 0.7 : 1 }}
          >
            {creating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <CreditCard size={14} />}
            {creating ? "Opening Stripe..." : `Charge ${fmtMoney(inv.amount)} via Stripe`}
            <ArrowUpRight size={13} />
          </button>
        </div>
      )}

      {link && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, fontFamily: fontMono, marginBottom: 8 }}>
            {serverConfigured ? "Or share Payment Link URL" : "Payment Link URL"}
          </div>
          <div style={{ background: "#fff", border: `1px solid ${C.rule}`, padding: 14, fontFamily: fontMono, fontSize: 12, wordBreak: "break-all", color: C.inkSoft, lineHeight: 1.5 }}>
            {link}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 1.5, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>When the client pays, invoice <code style={{ fontFamily: fontMono }}>{inv.invoiceNumber}</code> appears under &quot;Reference&quot; in your Stripe dashboard.</span>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 12 }}>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "transparent", border: `1px solid ${C.rule}`, fontSize: 13, cursor: "pointer", fontFamily: fontBody, color: C.ink, textDecoration: "none" }}
            >
              <ExternalLink size={14} /> Open in browser
            </a>
            <button
              onClick={copy}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", background: C.ink, color: C.paper, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: fontBody }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function SettingsModal({
  value, onSave, onClose,
}: {
  value: StripeSettings;
  onSave: (v: StripeSettings) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<StripeSettings>(value);
  const validUrl = (u: string) => !u || isStripeUrl(u);
  const save = () => {
    onSave(form);
    onClose();
  };

  return (
    <Modal onClose={onClose} title="Stripe settings" wide>
      <div style={{ background: `${C.stripe}08`, border: `1px solid ${C.stripe}30`, padding: 14, marginBottom: 20, fontSize: 13, lineHeight: 1.6 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <CreditCard size={16} color={C.stripe} />
          <strong>How to get your Stripe Payment Links</strong>
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: C.inkSoft }}>
          <li>
            Open your{" "}
            <a href="https://dashboard.stripe.com/payment-links" target="_blank" rel="noopener noreferrer" style={{ color: C.stripe, textDecoration: "underline" }}>
              Stripe dashboard → Payment Links
            </a>
            .
          </li>
          <li>Create a link for each pricing tier ($29 Pro, $79 Business — recurring monthly).</li>
          <li>For invoice payments, create one link with <strong>&quot;Customers can pay what they want&quot;</strong> enabled.</li>
          <li>Copy each URL and paste below. URLs look like <code style={{ fontFamily: fontMono, fontSize: 12 }}>https://buy.stripe.com/…</code></li>
        </ol>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Your name (for email sign-off)">
            <input value={form.senderName} onChange={(e) => setForm({ ...form, senderName: e.target.value })} placeholder="Jane Smith" style={inputStyle} />
          </Field>
          <Field label="Your email">
            <input type="email" value={form.senderEmail} onChange={(e) => setForm({ ...form, senderEmail: e.target.value })} placeholder="jane@yourbusiness.com" style={inputStyle} />
          </Field>
        </div>

        <div style={{ paddingTop: 14, borderTop: `1px solid ${C.rule}` }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, fontFamily: fontMono, marginBottom: 14 }}>Payment links</div>
          <div style={{ display: "grid", gap: 14 }}>
            <Field label="Invoice payment link (customer-pays-amount) — REQUIRED for pay buttons">
              <input
                value={form.invoiceLink}
                onChange={(e) => setForm({ ...form, invoiceLink: e.target.value })}
                placeholder="https://buy.stripe.com/..."
                style={{ ...inputStyle, borderColor: form.invoiceLink && !validUrl(form.invoiceLink) ? C.urgent : C.rule }}
              />
              {form.invoiceLink && !validUrl(form.invoiceLink) && (
                <div style={{ color: C.urgent, fontSize: 11, marginTop: 4 }}>This doesn&apos;t look like a Stripe URL.</div>
              )}
            </Field>
            <Field label="Pro plan ($29/mo) subscription link">
              <input
                value={form.proLink}
                onChange={(e) => setForm({ ...form, proLink: e.target.value })}
                placeholder="https://buy.stripe.com/..."
                style={{ ...inputStyle, borderColor: form.proLink && !validUrl(form.proLink) ? C.urgent : C.rule }}
              />
            </Field>
            <Field label="Business plan ($79/mo) subscription link">
              <input
                value={form.businessLink}
                onChange={(e) => setForm({ ...form, businessLink: e.target.value })}
                placeholder="https://buy.stripe.com/..."
                style={{ ...inputStyle, borderColor: form.businessLink && !validUrl(form.businessLink) ? C.urgent : C.rule }}
              />
            </Field>
            <Field label="Stripe publishable key (optional, for future features)">
              <input
                value={form.publishableKey}
                onChange={(e) => setForm({ ...form, publishableKey: e.target.value })}
                placeholder="pk_live_... or pk_test_..."
                style={inputStyle}
              />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                Safe to paste here — publishable keys are designed to be public. Never paste a secret key (sk_...).
              </div>
            </Field>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8, paddingTop: 14, borderTop: `1px solid ${C.rule}` }}>
          <button onClick={onClose} style={{ padding: "10px 16px", background: "transparent", border: `1px solid ${C.rule}`, fontSize: 13, cursor: "pointer", fontFamily: fontBody }}>Cancel</button>
          <button onClick={save} style={{ padding: "10px 18px", background: C.stripe, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: fontBody }}>Save settings</button>
        </div>
      </div>
    </Modal>
  );
}

function PricingModal({
  stripe, serverStripe, onClose, onOpenSettings,
}: {
  stripe: StripeSettings;
  serverStripe: ServerStripe;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const [opening, setOpening] = useState<"pro" | "business" | null>(null);
  const subscribeViaApi = async (plan: "pro" | "business") => {
    setOpening(plan);
    try {
      const res = await fetch("/api/stripe/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Could not start subscription");
      window.location.href = data.url;
    } catch (e) {
      setOpening(null);
      alert(e instanceof Error ? e.message : "Could not start subscription");
    }
  };

  type Tier = {
    name: string; price: string; sub: string; features: string[];
    cta: string; plan: "pro" | "business" | null;
    fallbackLink: string | null;
    highlight: boolean; disabled: boolean;
  };
  const tiers: Tier[] = [
    { name: "Free", price: "$0", sub: "Forever", features: ["Up to 10 invoices", "Basic aging dashboard", "3 AI reminders/month", "Single user"], cta: "Current plan", plan: null, fallbackLink: null, highlight: false, disabled: true },
    { name: "Pro", price: "$29", sub: "per month", features: ["Unlimited invoices", "Full aging + cash flow", "Unlimited AI reminders", "Stripe pay-link integration", "Client risk scores", "CSV / accounting export"], cta: "Subscribe with Stripe", plan: "pro", fallbackLink: stripe.proLink, highlight: true, disabled: false },
    { name: "Business", price: "$79", sub: "per month", features: ["Everything in Pro", "Up to 5 team members", "Custom email branding", "Priority support", "API access"], cta: "Subscribe with Stripe", plan: "business", fallbackLink: stripe.businessLink, highlight: false, disabled: false },
  ];
  const anyConfigured = !!(stripe.proLink || stripe.businessLink || serverStripe.configured);

  return (
    <Modal onClose={onClose} title="Pricing" wide>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 20, maxWidth: 540 }}>
        InvoiceSentry pays for itself the first time it recovers an invoice you would have written off. The average user recovers $4,200 in the first 60 days.
      </p>

      {!anyConfigured && (
        <div style={{ background: `${C.stripe}08`, border: `1px solid ${C.stripe}40`, padding: 12, marginBottom: 18, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span>Connect Stripe (server env vars or Settings) to enable real subscription checkout.</span>
          <button onClick={onOpenSettings} style={{ padding: "6px 12px", background: C.stripe, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: fontBody }}>Open settings</button>
        </div>
      )}

      {serverStripe.configured && (
        <div style={{ background: `${C.ok}10`, border: `1px solid ${C.ok}40`, padding: 12, marginBottom: 18, fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <ShieldCheck size={14} color={C.ok} />
          <span style={{ color: C.inkSoft }}>
            Server-side Stripe API is live. Subscribe buttons create real Checkout Sessions.
            {!serverStripe.hasPro && " (Pro price ID missing.)"}
            {!serverStripe.hasBusiness && " (Business price ID missing.)"}
          </span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {tiers.map((t) => {
          const useApi =
            !!t.plan &&
            serverStripe.configured &&
            ((t.plan === "pro" && serverStripe.hasPro) || (t.plan === "business" && serverStripe.hasBusiness));
          const isOpening = opening === t.plan;
          return (
            <div
              key={t.name}
              style={{ border: `1px solid ${t.highlight ? C.ink : C.rule}`, padding: 22, background: t.highlight ? C.ink : "#fff", color: t.highlight ? C.paper : C.ink, position: "relative" }}
            >
              {t.highlight && (
                <div style={{ position: "absolute", top: -10, left: 22, background: C.stripe, color: "#fff", fontSize: 10, padding: "2px 8px", fontFamily: fontMono, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Most popular
                </div>
              )}
              <div style={{ fontFamily: fontDisplay, fontSize: 28, marginBottom: 4 }}>{t.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 16 }}>
                <span style={{ fontFamily: fontMono, fontSize: 32, fontWeight: 600 }}>{t.price}</span>
                <span style={{ fontSize: 12, opacity: 0.6 }}>{t.sub}</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 18px", fontSize: 13, lineHeight: 1.8 }}>
                {t.features.map((f) => (
                  <li key={f} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <Check size={13} style={{ marginTop: 4, flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>
              {t.disabled ? (
                <button disabled style={{ width: "100%", padding: 10, background: t.highlight ? C.paper : C.paperDeep, color: t.highlight ? C.ink : C.muted, border: "none", fontSize: 13, fontWeight: 600, fontFamily: fontBody, cursor: "default" }}>{t.cta}</button>
              ) : useApi && t.plan ? (
                <button
                  onClick={() => subscribeViaApi(t.plan!)}
                  disabled={isOpening}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: 10, background: t.highlight ? C.stripe : C.ink, color: t.highlight ? "#fff" : C.paper, border: "none", fontSize: 13, fontWeight: 600, cursor: isOpening ? "wait" : "pointer", fontFamily: fontBody, opacity: isOpening ? 0.7 : 1 }}
                >
                  {isOpening ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <CreditCard size={13} />}
                  {isOpening ? "Opening Stripe..." : t.cta}
                  {!isOpening && <ArrowUpRight size={13} />}
                </button>
              ) : t.fallbackLink ? (
                <a
                  href={t.fallbackLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: 10, background: t.highlight ? C.stripe : C.ink, color: t.highlight ? "#fff" : C.paper, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: fontBody, textDecoration: "none", boxSizing: "border-box" }}
                >
                  <CreditCard size={13} /> {t.cta} <ArrowUpRight size={13} />
                </a>
              ) : (
                <button onClick={onOpenSettings} style={{ width: "100%", padding: 10, background: "transparent", color: t.highlight ? C.paper : C.ink, border: `1px solid ${t.highlight ? C.paper : C.rule}`, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: fontBody }}>
                  Connect Stripe →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function BusinessTab({
  onShowPricing, stripeStatus,
}: {
  onShowPricing: () => void;
  stripeStatus: { connected: boolean; complete: boolean };
}) {
  return (
    <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
      <div style={{ gridColumn: "1 / -1", background: C.ink, color: C.paper, padding: 36 }}>
        <div style={{ fontFamily: fontMono, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12, opacity: 0.6 }}>The opportunity</div>
        <h2 style={{ fontFamily: fontDisplay, fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 400, margin: 0, lineHeight: 1.1, maxWidth: 720 }}>
          $3 trillion in B2B invoices is paid late globally.{" "}
          <span style={{ fontStyle: "italic", opacity: 0.7 }}>Every late invoice is leverage waiting to be applied.</span>
        </h2>
      </div>
      <BizCard
        kicker="The niche"
        title="Service businesses with cash-flow pain"
        body="Freelancers, design agencies, law firms, consultancies, and trades — businesses that invoice clients on net-30/60 terms and bleed cash when those terms slip. Existing tools (Chaser, InvoiceAge, Sidetrade) are built for finance teams at $200+ per month. There is no opinionated $29/mo product for the long tail."
      />
      <BizCard
        kicker="The wedge"
        title="AI emails + Stripe pay links, together"
        body="Anyone can build an aging report. The painful part is writing reminder emails AND making it easy for the client to pay. The combo of AI-written email + one-click Stripe pay link replaces a 20-minute task with a 20-second one and dramatically lifts recovery rates. That's the moat."
      />
      <BizCard
        kicker="Unit economics"
        title="$29/mo Pro · ~85% gross margin"
        body="Stripe takes 2.9% + 30¢. AI inference per active user runs ~$0.40/mo. Servers and storage scale near-zero. With 1,000 paying users, MRR is $29,000 with ~$24,500 contribution margin. Churn in productivity SaaS averages 5–7%/mo."
      />
      <BizCard
        kicker="Distribution"
        title="Where the customers are"
        body="Indie Hackers, r/freelance, freelancer Slack/Discord communities, accountant referral programs, integrations with QuickBooks/Xero/FreshBooks. Content angle: 'How I recovered $X in 30 days' case studies."
      />
      <BizCard
        kicker="The ask"
        title="Validate, then scale"
        body="Start with a free Notion-form waitlist. Pre-sell 50 annual seats at $290 ($14.5K) before writing more code. If conversion beats 8% on a clear landing page, build out the full product. If it doesn't, the niche is wrong, not the execution."
      />
      <div style={{ background: "#fff", border: `1px solid ${stripeStatus.connected ? C.stripe : C.ink}`, padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 200 }}>
        <div>
          <div style={{ fontFamily: fontMono, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>Live integration</div>
          <h3 style={{ fontFamily: fontDisplay, fontSize: 26, fontWeight: 400, margin: "0 0 8px", lineHeight: 1.1 }}>
            Stripe is {stripeStatus.connected ? "connected" : "not connected"}
          </h3>
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
            {stripeStatus.complete
              ? "Both subscription billing and per-invoice pay links are configured. The full payment loop works against your real Stripe account."
              : stripeStatus.connected
                ? "Some Stripe links are configured. Add the missing ones in Settings to unlock all features."
                : "Add your Stripe Payment Link URLs in Settings to enable real payments."}
          </p>
        </div>
        <button
          onClick={onShowPricing}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: stripeStatus.connected ? C.stripe : C.ink, color: stripeStatus.connected ? "#fff" : C.paper, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: fontBody, alignSelf: "flex-start", marginTop: 16 }}
        >
          View pricing <ArrowUpRight size={14} />
        </button>
      </div>
    </div>
  );
}

function BizCard({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.rule}`, padding: 24, display: "flex", flexDirection: "column" }}>
      <div style={{ fontFamily: fontMono, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>{kicker}</div>
      <h3 style={{ fontFamily: fontDisplay, fontSize: 24, fontWeight: 400, margin: "0 0 12px", lineHeight: 1.15 }}>{title}</h3>
      <p style={{ fontSize: 14, color: C.inkSoft, lineHeight: 1.6, margin: 0 }}>{body}</p>
    </div>
  );
}

function Modal({
  children, title, onClose, wide,
}: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(26, 23, 21, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50, backdropFilter: "blur(4px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.paper, border: `1px solid ${C.ink}`, width: "100%", maxWidth: wide ? 680 : 480, maxHeight: "90vh", overflowY: "auto", animation: "fadeUp 0.25s ease", boxShadow: "0 24px 48px -12px rgba(26, 23, 21, 0.25)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: `1px solid ${C.rule}`, position: "sticky", top: 0, background: C.paper, zIndex: 1 }}>
          <h2 style={{ fontFamily: fontDisplay, fontSize: 26, fontWeight: 400, margin: 0 }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", color: C.inkSoft, padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, fontFamily: fontMono, marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "#fff",
  border: `1px solid ${C.rule}`,
  fontSize: 14,
  fontFamily: fontMono,
  color: C.ink,
  boxSizing: "border-box",
};
