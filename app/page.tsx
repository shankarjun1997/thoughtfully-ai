"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, ClipboardCheck, Clock3, Flower2, Gift, Heart, House, Leaf, Link2, ListChecks, Menu, Plus, Search, ShoppingBasket, Sparkles, Wallet, X } from "lucide-react";
import { analyzeLocally } from "@/lib/analyzer";
import WorkspaceMenu, { type SessionData } from "@/components/WorkspaceMenu";
import type { ListAnalysis, PlannerEvent, ShoppingItem } from "@/lib/types";

type Section = "Overview" | "Smart list" | "Calendar" | "My occasions";
const initialList: ShoppingItem[] = [
  { id: "1", name: "Fresh flowers", price: 150, checked: false },
  { id: "2", name: "Coconut and fruits", price: 260, checked: false },
  { id: "3", name: "Pooja essentials", price: 350, checked: false },
  { id: "4", name: "Reusable brass diya", price: 450, checked: false },
];
const dayISO = (offset: number) => { const date = new Date(); date.setDate(date.getDate() + offset); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const starterEvents: PlannerEvent[] = [
  { id: "e1", title: "Review shopping list", date: dayISO(2), category: "Shopping", notes: "Check what is already at home." },
  { id: "e2", title: "Family get-together", date: dayISO(7), category: "Family", notes: "Confirm guests and menu." },
  { id: "e3", title: "Prepare a handmade gift", date: dayISO(10), category: "DIY", notes: "Keep materials simple." },
];
const nav: { name: Section; icon: typeof House }[] = [
  { name: "Overview", icon: House }, { name: "Smart list", icon: ListChecks }, { name: "Calendar", icon: CalendarDays }, { name: "My occasions", icon: Gift },
];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function HomePage() {
  const [section, setSection] = useState<Section>("Overview");
  const [calendarMode, setCalendarMode] = useState<"Gregorian" | "Panchang">("Gregorian");
  const [calendarView, setCalendarView] = useState<"Day" | "Month" | "Year">("Month");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [items, setItems] = useState<ShoppingItem[]>(initialList);
  const [events, setEvents] = useState<PlannerEvent[]>(starterEvents);
  const [budget, setBudget] = useState("1500");
  const [purpose, setPurpose] = useState("Housewarming pooja");
  const [region, setRegion] = useState("Tamil Nadu");
  const [rawList, setRawList] = useState("Flowers — ₹150\nCoconut and fruits — ₹260\nPooja essentials — ₹350\nBrass diya — ₹450");
  const [keywords, setKeywords] = useState("Diwali pooja at home for 6 people, simple decorations, homemade sweets");
  const [generating, setGenerating] = useState(false);
  const [generateNotice, setGenerateNotice] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importPlan, setImportPlan] = useState<{
    summary: string;
    actions: Array<{ title: string; detail: string; timeframe?: string | null }>;
    caveats: string[];
    source: { url: string; capture: string; slides: number };
  } | null>(null);
  const [analysis, setAnalysis] = useState<ListAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [loading, setLoading] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState(dayISO(7));
  const [eventCategory, setEventCategory] = useState("Family");
  const [eventNotice, setEventNotice] = useState("");
  const [showEventForm, setShowEventForm] = useState(false);
  const [search, setSearch] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [session, setSession] = useState<SessionData | null>(null);
  const [scope, setScope] = useState("local");
  const [hydratedScope, setHydratedScope] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/session")
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (cancelled || !body) return;
        setSession(body as SessionData);
        if (body.activeWorkspaceId) setScope(`ws:${body.activeWorkspaceId}`);
      })
      .catch(() => { /* Local mode remains usable if session lookup fails. */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setHydratedScope(null);
    try {
      const savedItems = localStorage.getItem(`thoughtfully-items-v2:${scope}`) ?? (scope === "local" ? localStorage.getItem("thoughtfully-items-v1") : null);
      const savedEvents = localStorage.getItem(`thoughtfully-events-v2:${scope}`) ?? (scope === "local" ? localStorage.getItem("thoughtfully-events-v1") : null);
      setItems(savedItems ? JSON.parse(savedItems) : initialList);
      setEvents(savedEvents ? JSON.parse(savedEvents) : starterEvents);
    } catch {
      setItems(initialList);
      setEvents(starterEvents);
    }
    setHydratedScope(scope);
  }, [scope]);
  useEffect(() => { if (hydratedScope === scope) localStorage.setItem(`thoughtfully-items-v2:${scope}`, JSON.stringify(items)); }, [items, scope, hydratedScope]);
  useEffect(() => { if (hydratedScope === scope) localStorage.setItem(`thoughtfully-events-v2:${scope}`, JSON.stringify(events)); }, [events, scope, hydratedScope]);

  const total = items.reduce((sum, item) => sum + (item.price ?? 0), 0);
  const completed = items.filter((item) => item.checked).length;
  const upcoming = [...events].filter((event) => event.date >= toISODate(new Date())).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const visibleEvents = useMemo(() => events.filter((event) => `${event.title} ${event.category}`.toLowerCase().includes(search.toLowerCase())), [events, search]);

  function toggleItem(id: string) { setItems((current) => current.map((item) => item.id === id ? { ...item, checked: !item.checked } : item)); }
  function addItem() { if (!newItem.trim()) return; setItems((current) => [...current, { id: crypto.randomUUID(), name: newItem.trim(), checked: false }]); setNewItem(""); }
  function updateItem(id: string, patch: Partial<ShoppingItem>) { setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)); }
  function removeItem(id: string) { setItems((current) => current.filter((item) => item.id !== id)); }
  async function importFromLink() {
    if (!importUrl.trim()) return;
    setImporting(true); setImportError(""); setImportPlan(null); setAnalysis(null);
    try {
      const response = await fetch("/api/import-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: importUrl.trim() }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to import this link.");
      const checklist = (body.checklist as Array<{ name: string; quantity?: string | null; estimatedPrice?: number | null }>);
      setItems(checklist.map((item) => ({
        id: crypto.randomUUID(),
        name: item.name,
        price: typeof item.estimatedPrice === "number" ? item.estimatedPrice : undefined,
        quantity: item.quantity ?? undefined,
        checked: false,
      })));
      setRawList(checklist.map((item) => typeof item.estimatedPrice === "number" ? `${item.name}${item.quantity ? ` (${item.quantity})` : ""} — ₹${item.estimatedPrice}` : item.name).join("\n"));
      setImportPlan({
        summary: body.summary ?? "",
        actions: body.actions ?? [],
        caveats: body.caveats ?? [],
        source: body.source ?? { url: importUrl.trim(), capture: "unknown", slides: 0 },
      });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unable to import this link.");
    } finally { setImporting(false); }
  }
  function addPlanToCalendar() {
    const plan = importPlan;
    if (!plan?.actions.length) return;
    setEvents((current) => [...current, ...plan.actions.map((action, index) => ({
      id: crypto.randomUUID(),
      title: action.title,
      date: dayISO(index + 1),
      category: "Action",
      notes: action.detail,
    }))].sort((a, b) => a.date.localeCompare(b.date)));
  }
  async function generateChecklist() {
    if (!keywords.trim()) return;
    setGenerating(true); setGenerateNotice(""); setAnalysis(null);
    const parsedBudget = Number(budget);
    try {
      const response = await fetch("/api/generate-checklist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keywords, purpose, budget: Number.isFinite(parsedBudget) ? parsedBudget : 0, region }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to build a checklist.");
      const generated = (body.items as Array<{ name: string; quantity?: string | null; estimatedPrice?: number | null }>);
      setItems(generated.map((item) => ({
        id: crypto.randomUUID(),
        name: item.name,
        price: typeof item.estimatedPrice === "number" ? item.estimatedPrice : undefined,
        quantity: item.quantity ?? undefined,
        checked: false,
      })));
      setRawList(generated.map((item) => typeof item.estimatedPrice === "number" ? `${item.name}${item.quantity ? ` (${item.quantity})` : ""} — ₹${item.estimatedPrice}` : item.name).join("\n"));
      if (body.summary) setGenerateNotice(body.summary);
    } catch (error) {
      setGenerateNotice(error instanceof Error ? error.message : "Unable to build a checklist.");
    } finally { setGenerating(false); }
  }
  function addEvent() {
    if (!eventTitle.trim() || !eventDate) { setEventNotice("Add an event name and date first."); return; }
    setEvents((current) => [...current, { id: crypto.randomUUID(), title: eventTitle.trim(), date: eventDate, category: eventCategory }].sort((a, b) => a.date.localeCompare(b.date)));
    setEventNotice("Event saved on this device."); setEventTitle(""); setShowEventForm(false);
  }
  async function runAnalysis() {
    setLoading(true); setAnalysisError(""); setAnalysis(null);
    const parsedBudget = Number(budget);
    try {
      const response = await fetch("/api/analyze-list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: rawList, purpose, budget: Number.isFinite(parsedBudget) ? parsedBudget : 0, region, ownedItems: items.filter((item) => item.checked).map((item) => item.name) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to analyze list.");
      setAnalysis(body as ListAnalysis);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to connect to the AI service.";
      if (message.includes("LLM_API_KEY") || message.includes("AI is not configured")) {
        setAnalysis(analyzeLocally(rawList, Number.isFinite(parsedBudget) ? parsedBudget : 0, purpose));
        setAnalysisError("AI API not configured — showing a clearly labelled local rules preview instead.");
      } else setAnalysisError(message);
    } finally { setLoading(false); }
  }

  const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const dayOffset = monthStart.getDay();
  const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
  const days = [...Array(dayOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return <main className="app-shell">
    <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Sparkles size={20} /></div><div><div className="brand-name">thoughtfully<span>AI</span></div><div className="brand-tagline">Make every moment matter</div></div><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Main navigation">{nav.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${section === name ? "active" : ""}`} onClick={() => { setSection(name); setMobileNavOpen(false); }}><Icon size={18}/><span>{name}</span>{name === "Smart list" && <span className="nav-count">{items.length}</span>}</button>)}</nav>
      <div className="sidebar-spacer"/>
      <div className="sidebar-tip"><div className="tip-icon"><Heart size={17}/></div><div className="tip-title">Thoughtful doesn&apos;t mean expensive.</div><p>The best plans make room for what matters to you.</p><button onClick={() => { setSection("Smart list"); setPurpose("A thoughtful surprise"); }}>Plan a small surprise <ChevronRight size={14}/></button></div>
      <WorkspaceMenu session={session} />
    </aside>
    {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation overlay" onClick={() => setMobileNavOpen(false)}/>}
    <section className="main-panel">
      <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20}/></button><div className="breadcrumb">Workspace <ChevronRight size={14}/> <strong>{section}</strong></div><div className="topbar-actions"><div className="today-chip"><span className="status-dot"/> Your plans are saved locally</div><button className="avatar small-avatar" aria-label="Profile">S</button></div></header>
      {section === "Overview" && <div className="page-content">
        <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR THOUGHTFUL SPACE</div><h1>Make room for <em>what matters.</em></h1><p className="page-subtitle">A little planning today makes every occasion feel more meaningful.</p></div><div className="welcome-illustration"><div className="sun-orb"/><div className="flower-stem"/><Flower2 size={72} strokeWidth={1.15}/><span className="illustration-star star-one">✳</span><span className="illustration-star star-two">✦</span></div></div>
        <div className="quick-actions"><button className="quick-card" onClick={() => setSection("Smart list")}><span className="quick-icon sage"><ShoppingBasket size={20}/></span><span><strong>Review a shopping list</strong><small>Spot duplicates, gaps & savings</small></span><ChevronRight size={17}/></button><button className="quick-card" onClick={() => { setSection("Calendar"); setShowEventForm(true); }}><span className="quick-icon peach"><CalendarDays size={20}/></span><span><strong>Plan an occasion</strong><small>Turn a date into a simple plan</small></span><ChevronRight size={17}/></button></div>
        <div className="stats-grid"><div className="stat-card"><div className="stat-top"><span>Shopping list</span><span className="stat-icon sage"><ListChecks size={17}/></span></div><div className="stat-number">{items.length}<span> items</span></div><div className="stat-foot">{completed} checked off so far</div><div className="progress-track"><div className="progress-fill" style={{ width: `${items.length ? completed / items.length * 100 : 0}%` }}/></div></div><div className="stat-card"><div className="stat-top"><span>Planned spend</span><span className="stat-icon blue"><Wallet size={17}/></span></div><div className="stat-number">{money(total)}</div><div className="stat-foot">Across items with prices</div><div className="stat-note">{Number(budget) >= total ? `${money(Math.max(0, Number(budget) - total))} within your budget` : `${money(total - Number(budget))} over your budget`}</div></div><div className="stat-card"><div className="stat-top"><span>Upcoming plans</span><span className="stat-icon peach"><Clock3 size={17}/></span></div><div className="stat-number">{upcoming.length}<span> soon</span></div><div className="stat-foot">Personal events & preparation</div><button className="text-action" onClick={() => setSection("Calendar")}>Open calendar <ChevronRight size={14}/></button></div></div>
        <div className="content-grid"><section className="panel list-panel"><div className="panel-heading"><div><div className="eyebrow">YOUR CHECKLIST</div><h2>Things to take care of</h2></div><button className="text-action" onClick={() => setSection("Smart list")}>View all <ChevronRight size={14}/></button></div><p className="panel-description">Keep the essentials close and the clutter out.</p><div className="checklist">{items.slice(0, 5).map((item) => <label key={item.id} className={`check-row ${item.checked ? "is-checked" : ""}`}><input type="checkbox" checked={item.checked} onChange={() => toggleItem(item.id)}/><span className="custom-check"><Check size={12}/></span><span className="check-name">{item.name}</span>{typeof item.price === "number" && <span className="check-price">{money(item.price)}</span>}</label>)}</div><button className="add-link" onClick={() => setSection("Smart list")}><Plus size={15}/> Add or review items</button></section>
        <section className="panel upcoming-panel"><div className="panel-heading"><div><div className="eyebrow">LOOKING AHEAD</div><h2>Coming up</h2></div><button className="icon-button" aria-label="Open calendar" onClick={() => setSection("Calendar")}><ChevronRight size={18}/></button></div><div className="event-list">{upcoming.length ? upcoming.map((event) => <div className="event-row" key={event.id}><div className="event-date"><strong>{new Date(`${event.date}T12:00:00`).getDate()}</strong><span>{new Date(`${event.date}T12:00:00`).toLocaleDateString("en-IN", { month: "short" })}</span></div><div className="event-detail"><strong>{event.title}</strong><span>{event.category} · {event.notes || "A little preparation goes a long way."}</span></div><span className={`event-dot ${event.category.toLowerCase()}`}/></div>) : <div className="empty-state">No upcoming plans yet. Add a date to get started.</div>}</div><button className="add-link" onClick={() => { setSection("Calendar"); setShowEventForm(true); }}><Plus size={15}/> Add an occasion</button></section></div>
        <div className="gentle-banner"><div className="banner-icon"><Leaf size={22}/></div><div><strong>A small reminder</strong><p>Before buying something new, check what you already have. Thoughtful planning can save money and reduce waste.</p></div><span className="banner-sparkle">✳</span></div>
      </div>}

      {section === "Smart list" && <div className="page-content"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> SMART SHOPPING</div><h1>Your list, <em>thoughtfully reviewed.</em></h1><p className="page-subtitle">Paste a list, set your budget, and get help spotting duplicates, gaps and practical alternatives.</p></div><div className="heading-icon sage"><ClipboardCheck size={25}/></div></div><div className="smart-layout"><section className="panel form-panel"><div className="panel-heading"><div><h2>What are you planning?</h2><p className="panel-description">Add your occasion and the list you have so far.</p></div><span className="step-pill">STEP 01</span></div><label className="field-label" htmlFor="purpose">Purpose or occasion</label><input id="purpose" className="text-input" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Housewarming pooja"/><div className="field-row"><div className="field-grow"><label className="field-label" htmlFor="budget">Total budget (INR)</label><div className="input-prefix"><span>₹</span><input id="budget" type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} /></div></div><div className="field-grow"><label className="field-label" htmlFor="region">Region</label><select id="region" className="text-input" value={region} onChange={(e) => setRegion(e.target.value)}><option>Tamil Nadu</option><option>Kerala</option><option>Karnataka</option><option>Andhra Pradesh</option><option>Other India</option></select></div></div><div className="import-divider"><span>or import an Instagram post</span></div><label className="field-label" htmlFor="import-url">Post or reel link</label><div className="import-row"><input id="import-url" type="url" className="text-input" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} placeholder="https://www.instagram.com/reel/…"/><button className="secondary-button" disabled={importing || !importUrl.trim()} onClick={importFromLink}>{importing ? <span className="spinner dark-spinner"/> : <Link2 size={15}/>} {importing ? "Reading…" : "Import link"}</button></div><div className="field-hint"><CircleHelp size={14}/> We capture the slides or a screenshot, read the text, then build a checklist and action plan.</div>{importError && <div className="notice"><CircleHelp size={16}/><span>{importError}</span></div>}<label className="field-label" htmlFor="keywords">Rough keywords or notes</label><textarea id="keywords" className="text-input list-textarea" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={'Paste keywords, a rough list or a few notes\ne.g. Diwali pooja for 6 people, diyas, sweets, flowers, under ₹3000'} rows={3}/><button className="secondary-button generate-button" disabled={generating || !keywords.trim()} onClick={generateChecklist}>{generating ? <span className="spinner"/> : <Sparkles size={15}/>} {generating ? "Building your checklist…" : "Build checklist with AI"}</button>{generateNotice && <div className="notice"><CircleHelp size={16}/><span>{generateNotice}</span></div>}<label className="field-label" htmlFor="raw-list">Your shopping list</label><textarea id="raw-list" className="text-input list-textarea" value={rawList} onChange={(e) => setRawList(e.target.value)} placeholder={'One item per line, prices optional\nFlowers — ₹150\nCoconut — ₹60'} rows={8}/><div className="field-hint"><CircleHelp size={14}/> Include quantities, prices or what you already own if you know them.</div><button className="primary-button full-button" disabled={loading || !rawList.trim()} onClick={runAnalysis}>{loading ? <span className="spinner"/> : <Sparkles size={17}/>} {loading ? "Reviewing your list…" : "Review list with AI"}</button><div className="privacy-note">Your API key stays on the server. Lists are not saved to a server by this screen unless you configure persistence.</div></section><section className="panel result-panel"><div className="panel-heading"><div><div className="eyebrow">YOUR REVIEW</div><h2>Keep the good. Skip the waste.</h2></div><span className="result-spark"><Sparkles size={18}/></span></div>{analysisError && <div className="notice"><CircleHelp size={16}/><span>{analysisError}</span></div>}{importPlan && <div className="import-plan"><div className="panel-heading"><div><div className="eyebrow">FROM YOUR LINK</div><h2>Checklist and action plan</h2></div><span className="mode-pill">{importPlan.source.capture === "screenshot" ? "OCR from screenshot" : `OCR from ${importPlan.source.slides} slide(s)`}</span></div><div className="analysis-summary">{importPlan.summary}</div><h3>Action plan</h3><div className="action-plan">{importPlan.actions.map((action, index) => <div className="action-plan-row" key={`${action.title}-${index}`}><span className="action-step">{index + 1}</span><div><strong>{action.title}</strong><p>{action.detail}</p>{action.timeframe && <span className="action-time">{action.timeframe}</span>}</div></div>)}</div><div className="import-plan-actions"><button className="secondary-button" onClick={addPlanToCalendar}><CalendarDays size={15}/> Add actions to calendar</button><a className="text-action" href={importPlan.source.url} target="_blank" rel="noreferrer">Open original post</a></div>{importPlan.caveats.map((item) => <p className="caveat" key={item}>{item}</p>)}</div>}{analysis ? <div className="analysis-results"><div className="analysis-summary">{analysis.summary}</div><div className="analysis-metrics"><div><span>Estimated total</span><strong>{analysis.totalEstimated === null ? "Not enough prices" : money(analysis.totalEstimated)}</strong></div><div><span>Budget check</span><strong className={analysis.totalEstimated !== null && analysis.totalEstimated > Number(budget) ? "danger-text" : ""}>{analysis.budgetStatus}</strong></div></div><h3>Item-by-item recommendations</h3>{analysis.recommendations.map((rec, index) => <div className="recommendation-row" key={`${rec.item}-${index}`}><span className={`action-tag ${rec.action}`}>{rec.action}</span><div><strong>{rec.item}</strong><p>{rec.reason}</p></div>{typeof rec.estimatedPrice === "number" && <span className="check-price">{money(rec.estimatedPrice)}</span>}</div>)}{analysis.missingEssentials.length > 0 && <><h3>Possibly missing</h3><ul className="simple-list">{analysis.missingEssentials.map((x) => <li key={x}>{x}</li>)}</ul></>}{analysis.savingsTips.length > 0 && <><h3>Ways to save</h3><ul className="simple-list">{analysis.savingsTips.map((x) => <li key={x}>{x}</li>)}</ul></>}{analysis.caveats.map((x) => <p className="caveat" key={x}>{x}</p>)}<span className="mode-pill">{analysis.mode === "ai" ? "AI-generated analysis" : "Local rules preview"}</span></div> : !importPlan ? <div className="result-empty"><div className="result-illustration"><ClipboardCheck size={42} strokeWidth={1.2}/><span>✳</span></div><h3>Your second pair of eyes.</h3><p>We’ll review your list against your occasion and budget, highlight possible duplicates, and suggest what to double-check before you buy.</p><div className="result-example"><span><Check size={14}/> Keep what you need</span><span><Search size={14}/> Check for duplicates</span><span><Leaf size={14}/> Consider simpler alternatives</span></div><button className="secondary-button" onClick={() => { setRawList("Flowers — ₹150\nCoconut — ₹60\nBananas — ₹80\nPooja essentials — ₹350\nBrass diya — ₹450\nFlowers — ₹150"); setPurpose("Housewarming pooja"); }}>Load sample list</button></div> : null}</section></div><section className="panel owned-panel"><div className="panel-heading"><div><h2>Your household checklist</h2><p className="panel-description">Tick items you already have; the AI can consider these in its review.</p></div><span className="owned-count">{completed} of {items.length} checked</span></div><div className="checklist">{items.map((item) => <div key={item.id} className={`check-row ${item.checked ? "is-checked" : ""}`}><label className="check-toggle" aria-label={`Mark ${item.name} as owned`}><input type="checkbox" checked={item.checked} onChange={() => toggleItem(item.id)}/><span className="custom-check"><Check size={12}/></span></label><span className="check-name">{item.name}</span><input className="qty-input" value={item.quantity ?? ""} onChange={(e) => updateItem(item.id, { quantity: e.target.value || undefined })} placeholder="Qty" aria-label={`Quantity for ${item.name}`}/><div className="rate-input"><span>₹</span><input type="number" min="0" inputMode="decimal" value={item.price ?? ""} onChange={(e) => updateItem(item.id, { price: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="Rate" aria-label={`Rate for ${item.name}`}/></div><button className="icon-button item-remove" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.id)}><X size={14}/></button></div>)}</div><div className="add-item-row"><input className="text-input" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addItem(); }} placeholder="Add something you already have or need"/><button className="secondary-button" onClick={addItem}><Plus size={15}/> Add item</button></div></section></div>}

      {section === "Calendar" && <div className="page-content"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR TIME, YOUR TRADITIONS</div><h1>Plan ahead, <em>with meaning.</em></h1><p className="page-subtitle">Personal dates, Indian festivals and preparation milestones in one place.</p></div><button className="primary-button" onClick={() => setShowEventForm((v) => !v)}><Plus size={16}/> Add event</button></div><div className="calendar-toolbar panel"><div className="calendar-mode-switch" role="group" aria-label="Calendar system">{(["Gregorian", "Panchang"] as const).map((mode) => <button key={mode} className={calendarMode === mode ? "selected" : ""} onClick={() => setCalendarMode(mode)}>{mode === "Panchang" && <Flower2 size={14}/>} {mode}</button>)}</div><div className="calendar-nav"><button className="icon-button" aria-label="Previous period" onClick={() => setCalendarDate(calendarView === "Day" ? new Date(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate() - 1) : new Date(calendarDate.getFullYear(), calendarDate.getMonth() - (calendarView === "Month" ? 1 : 12), 1))}><ChevronLeft size={18}/></button><strong>{calendarView === "Day" ? calendarDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : calendarView === "Month" ? `${monthNames[calendarDate.getMonth()]} ${calendarDate.getFullYear()}` : calendarDate.getFullYear()}</strong><button className="icon-button" aria-label="Next period" onClick={() => setCalendarDate(calendarView === "Day" ? new Date(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate() + 1) : new Date(calendarDate.getFullYear(), calendarDate.getMonth() + (calendarView === "Month" ? 1 : 12), 1))}><ChevronRight size={18}/></button></div><div className="view-switch">{(["Day", "Month", "Year"] as const).map((view) => <button key={view} className={calendarView === view ? "selected" : ""} onClick={() => setCalendarView(view)}>{view}</button>)}</div></div>{calendarMode === "Panchang" && <div className="notice panchang-notice"><Flower2 size={18}/><div><strong>Panchang mode selected</strong><p>Tithi, nakshatra, yoga, karana and muhurtham need a verified Panchang calculation/data provider configured for your location. This build does not fabricate those values. Your saved events remain available in either mode.</p><button className="text-action" onClick={() => setCalendarMode("Gregorian")}>Return to Gregorian view</button></div></div>}{showEventForm && <section className="panel event-form"><div className="panel-heading"><div><h2>Add a personal occasion</h2><p className="panel-description">Save birthdays, poojas, shopping deadlines or DIY preparation.</p></div><button className="icon-button" aria-label="Close form" onClick={() => setShowEventForm(false)}><X size={17}/></button></div><div className="event-form-grid"><div><label className="field-label" htmlFor="event-title">Event name</label><input id="event-title" className="text-input" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="e.g. Housewarming pooja"/></div><div><label className="field-label" htmlFor="event-date">Date</label><input id="event-date" className="text-input" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)}/></div><div><label className="field-label" htmlFor="event-category">Category</label><select id="event-category" className="text-input" value={eventCategory} onChange={(e) => setEventCategory(e.target.value)}><option>Family</option><option>Pooja</option><option>Festival</option><option>Shopping</option><option>DIY</option><option>Birthday</option><option>Anniversary</option></select></div><button className="primary-button" onClick={addEvent}><Check size={16}/> Save event</button></div>{eventNotice && <p className="success-message">{eventNotice}</p>}</section>}<div className="calendar-layout"><section className="panel month-panel">{calendarView === "Day" ? <div className="day-agenda"><div className="day-agenda-date"><span>{calendarDate.toLocaleDateString("en-IN", { weekday: "long" })}</span><strong>{calendarDate.getDate()}</strong><small>{calendarDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</small></div><div className="day-agenda-events">{events.filter((event) => event.date === toISODate(calendarDate)).map((event) => <div className="day-event-card" key={event.id}><span className="legend-dot personal"/><div><strong>{event.title}</strong><p>{event.category} · {event.notes || "Personal plan"}</p></div><button className="icon-button" aria-label={`Delete ${event.title}`} onClick={() => setEvents((current) => current.filter((item) => item.id !== event.id))}><X size={15}/></button></div>)}{!events.some((event) => event.date === toISODate(calendarDate)) && <div className="empty-state">Nothing planned for this day yet. Keep it free, or add a meaningful occasion.</div>}<button className="secondary-button" onClick={() => { setEventDate(toISODate(calendarDate)); setShowEventForm(true); }}><Plus size={15}/> Add plan for this day</button></div></div> : calendarView === "Month" ? <><div className="calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <span key={d}>{d}</span>)}</div><div className="calendar-grid">{days.map((day, index) => { const date = day ? `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : `blank-${index}`; const dayEvents = day ? events.filter((event) => event.date === date) : []; return <button key={date} disabled={!day} className={`calendar-day ${dayEvents.length ? "has-event" : ""} ${date === toISODate(new Date()) ? "today" : ""}`} onClick={() => { if (day) { setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day)); setEventDate(date); setShowEventForm(true); } }}><span>{day ?? ""}</span>{dayEvents.slice(0, 2).map((event) => <span key={event.id} className="calendar-event-dot" title={event.title}>{event.title}</span>)}</button>; })}</div><div className="calendar-legend"><span><i className="legend-dot personal"/> Personal event</span><span><i className="legend-dot festival"/> Festival dates after data integration</span></div></> : <div className="year-grid">{monthNames.map((month, index) => <button key={month} className="year-month" onClick={() => { setCalendarDate(new Date(calendarDate.getFullYear(), index, 1)); setCalendarView("Month"); }}><strong>{month.slice(0, 3)}</strong><span>{events.filter((event) => event.date.startsWith(`${calendarDate.getFullYear()}-${String(index + 1).padStart(2, "0")}`)).length} plans</span></button>)}</div>}</section><section className="panel agenda-panel"><div className="panel-heading"><div><div className="eyebrow">YOUR AGENDA</div><h2>Occasions & plans</h2></div><span className="agenda-count">{visibleEvents.length}</span></div><div className="search-box"><Search size={15}/><input aria-label="Search events" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find an occasion"/>{search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={14}/></button>}</div><div className="agenda-list">{visibleEvents.sort((a, b) => a.date.localeCompare(b.date)).map((event) => <div className="agenda-item" key={event.id}><div className="agenda-date"><strong>{new Date(`${event.date}T12:00:00`).getDate()}</strong><span>{new Date(`${event.date}T12:00:00`).toLocaleDateString("en-IN", { month: "short" })}</span></div><div className="agenda-detail"><strong>{event.title}</strong><span>{dateLabel(event.date)} · {event.category}</span></div><button className="icon-button delete-event" aria-label={`Delete ${event.title}`} onClick={() => setEvents((current) => current.filter((item) => item.id !== event.id))}><X size={15}/></button></div>)}{visibleEvents.length === 0 && <div className="empty-state">No matching events. Add one to start planning.</div>}</div><button className="secondary-button full-button" onClick={() => setShowEventForm(true)}><Plus size={15}/> Add to calendar</button></section></div><div className="notice calendar-disclaimer"><CircleHelp size={16}/><span>Starter data includes example events for preview. Indian public holidays and festival dates must be connected to a maintained source before relying on this calendar for real-world observance.</span></div></div>}

      {section === "My occasions" && <div className="page-content"><div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> THE MOMENTS THAT MATTER</div><h1>Every occasion, <em>more personal.</em></h1><p className="page-subtitle">Save meaningful dates and turn them into plans that feel considered, not complicated.</p></div><button className="primary-button" onClick={() => { setSection("Calendar"); setShowEventForm(true); }}><Plus size={16}/> New occasion</button></div><div className="occasion-cards"><button className="occasion-card" onClick={() => { setPurpose("Pooja or religious ritual"); setSection("Smart list"); }}><span className="occasion-art art-flower"><Flower2 size={30}/></span><strong>Poojas & rituals</strong><p>Plan essentials, offerings and family-specific customs.</p><span className="occasion-link">Make a checklist <ChevronRight size={14}/></span></button><button className="occasion-card" onClick={() => { setPurpose("Housewarming"); setSection("Smart list"); }}><span className="occasion-art art-home"><House size={30}/></span><strong>New home</strong><p>Thoughtful gifts, household basics and preparation tasks.</p><span className="occasion-link">Make a checklist <ChevronRight size={14}/></span></button><button className="occasion-card" onClick={() => { setPurpose("Handmade DIY gift"); setSection("Smart list"); }}><span className="occasion-art art-leaf"><Leaf size={30}/></span><strong>DIY & handmade</strong><p>Simple materials, doable steps and personal touches.</p><span className="occasion-link">Make a checklist <ChevronRight size={14}/></span></button><button className="occasion-card" onClick={() => { setPurpose("Birthday or anniversary"); setSection("Smart list"); }}><span className="occasion-art art-gift"><Gift size={30}/></span><strong>Birthdays & milestones</strong><p>Personal gifts and little details within your budget.</p><span className="occasion-link">Make a checklist <ChevronRight size={14}/></span></button></div><section className="panel saved-occasions"><div className="panel-heading"><div><h2>Your saved dates</h2><p className="panel-description">A single place for the occasions you want to prepare for.</p></div><button className="text-action" onClick={() => setSection("Calendar")}>Open calendar <ChevronRight size={14}/></button></div>{events.length ? events.sort((a, b) => a.date.localeCompare(b.date)).map((event) => <div className="saved-event-row" key={event.id}><div className="saved-event-icon"><CalendarDays size={18}/></div><div className="event-detail"><strong>{event.title}</strong><span>{dateLabel(event.date)} · {event.category}</span></div><button className="text-action" onClick={() => { setEventDate(event.date); setEventTitle(event.title); setEventCategory(event.category); setSection("Calendar"); setShowEventForm(true); }}>Edit plan <ChevronRight size={14}/></button></div>) : <div className="empty-state">Your saved occasions will appear here.</div>}</section></div>}
      <footer className="app-footer"><span>Thoughtfully AI · Early access build</span><span>Made for meaningful moments <Heart size={12}/></span></footer>
    </section>
  </main>;
}
