import { useState, useEffect } from "react";

interface FeedbackModalProps { open: boolean; onClose: () => void; }

const STORAGE_KEY = "btl-smadar-feedback";
const APP_NAME = "סמדר - ביקורת נסיעות לחו\"ל";
const SHEET_URL = "https://script.google.com/macros/s/AKfycbwD8CMFoP5XoOwRLwK_OxMMOFKF8fS2CRpbJkNdOHjbnJIepkOLzlGrg3GQNGRqbwB6bA/exec";
const NAME_KEY = "btl-smadar-feedback-user-name";

type Category = "\uD83D\uDC1B באג" | "\uD83D\uDCA1 שיפור" | "\uD83D\uDCCA נתונים" | "\uD83C\uDFA8 עיצוב";
type Severity = "קריטי" | "שיפור" | "קטן";

interface FeedbackEntry {
  id: number; name: string; category: Category | ""; severity: Severity | "";
  text: string; timestamp: string; sent: boolean;
}

async function sendToSheet(entry: FeedbackEntry, page: string): Promise<boolean> {
  try {
    await fetch(SHEET_URL, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: APP_NAME, name: entry.name || "אנונימי",
        category: entry.category || "כללי", severity: entry.severity || "-",
        text: entry.text, page,
      }),
    });
    return true;
  } catch { return false; }
}

const sevColor = (s: Severity | "") =>
  s === "קריטי" ? "border-red-500 bg-red-50 text-red-700" :
  s === "שיפור" ? "border-orange-400 bg-orange-50 text-orange-700" :
  s === "קטן" ? "border-green-500 bg-green-50 text-green-700" : "";

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || "");
  const [category, setCategory] = useState<Category | "">("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [text, setText] = useState("");
  const [items, setItems] = useState<FeedbackEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [lastStatus, setLastStatus] = useState<"" | "ok" | "offline">("");

  useEffect(() => { const s = localStorage.getItem(STORAGE_KEY); if (s) setItems(JSON.parse(s)); }, [open]);

  useEffect(() => {
    if (!open) return;
    const unsent = items.filter((i) => !i.sent);
    if (!unsent.length) return;
    Promise.all(unsent.map((i) => sendToSheet(i, window.location.pathname))).then((r) => {
      save(items.map((item) => {
        const idx = unsent.findIndex((u) => u.id === item.id);
        return idx >= 0 && r[idx] ? { ...item, sent: true } : item;
      }));
    });
  }, [open]);

  const save = (u: FeedbackEntry[]) => { setItems(u); localStorage.setItem(STORAGE_KEY, JSON.stringify(u)); };

  const handleSubmit = async () => {
    if (!text.trim() || !name.trim()) return;
    localStorage.setItem(NAME_KEY, name.trim());
    setSending(true); setLastStatus("");
    const entry: FeedbackEntry = {
      id: Date.now(), name: name.trim(), category, severity,
      text: text.trim(), timestamp: new Date().toISOString(), sent: false,
    };
    const ok = await sendToSheet(entry, window.location.pathname);
    entry.sent = ok;
    save([entry, ...items]);
    setCategory(""); setSeverity(""); setText("");
    setSending(false); setLastStatus(ok ? "ok" : "offline");
    setTimeout(() => setLastStatus(""), 3000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto p-6" dir="rtl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          <h2 className="text-lg font-bold text-right">משוב פיילוט</h2>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2 text-right">שם</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="השם שלך"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-right text-sm" dir="rtl" />
          </div>
          <div>
            <p className="text-sm font-medium mb-2 text-right">קטגוריה</p>
            <div className="flex gap-2 flex-wrap justify-end">
              {(["\uD83D\uDC1B באג", "\uD83D\uDCA1 שיפור", "\uD83D\uDCCA נתונים", "\uD83C\uDFA8 עיצוב"] as Category[]).map((c) => (
                <button key={c} onClick={() => setCategory(category === c ? "" : c)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${category === c ? "border-[#1B3A5C] bg-[#1B3A5C] text-white" : "border-gray-300 bg-white text-gray-700 hover:border-[#1B3A5C]"}`}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2 text-right">חומרה</p>
            <div className="flex gap-2 flex-wrap justify-end">
              {(["קריטי", "שיפור", "קטן"] as Severity[]).map((s) => (
                <button key={s} onClick={() => setSeverity(severity === s ? "" : s)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${severity === s ? `${sevColor(s)} border-2` : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"}`}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2 text-right">תיאור</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="תאר את המשוב..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 min-h-[80px] text-right text-sm" dir="rtl" />
          </div>
          <div>
            <button onClick={handleSubmit} disabled={!text.trim() || !name.trim() || sending}
              className="w-full py-2 rounded-md text-white font-medium text-sm disabled:opacity-50"
              style={{ backgroundColor: "#1B3A5C" }}>
              {sending ? "שולח..." : "שלח משוב"}
            </button>
            {lastStatus === "ok" && <p className="text-xs text-green-600 text-center mt-1">נשלח בהצלחה</p>}
            {lastStatus === "offline" && <p className="text-xs text-orange-500 text-center mt-1">נשמר מקומית - יישלח כשיהיה חיבור</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
