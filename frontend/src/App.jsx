import React, { useState, useEffect } from "react";
import axios from "axios";

export default function App() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { type: "ai", text: 'Log interaction details here (e.g., "Met Dr. Smith, discussed Product X efficacy, positive sentiment, shared brochure") or ask for help.' }
  ]);
  const [history, setHistory] = useState([]);
  const [currentId, setCurrentId] = useState(null);

  const [form, setForm] = useState({
    hcp_name: "",
    interaction_type: "Meeting",
    date: "2026-04-18",
    time: "07:30",
    attendees: "",
    topics: "",
    materials: [],
    samples: [],
    sentiment: "Neutral",
    outcomes: "",
    followup: "",
    ai_suggestions: [
      "Schedule follow-up meeting in 2 weeks",
      "Send OncoBoost Phase III PDF",
      "Add Dr. Sharma to advisory board invite list"
    ]
  });

  const sentimentEmojis = {
    Positive: "😊",
    Neutral: "😐",
    Negative: "😞"
  };

  const updateForm = (key, value) => {
    setForm(prev => ({...prev, [key]: value }));
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.post("http://127.0.0.1:8000/agent", { input: "search " });
      if (res.data.tool_used === "search_hcp") {
        setHistory(res.data.result || []);
      }
    } catch (e) {
      console.error("Failed to fetch history:", e);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleAI = async () => {
    if (!input.trim()) {
      setError("Please describe the interaction first");
      return;
    }

    setLoading(true);
    setError("");
    setChatMessages(prev => [...prev, { type: "user", text: input }]);

    try {
      const res = await axios.post("http://127.0.0.1:8000/agent", { input });
      const { tool_used, result } = res.data;

      if (tool_used === "log_interaction") {
        setCurrentId(result.id);
        setForm(prev => ({
        ...prev,
          hcp_name: result.hcp_name || "",
          interaction_type: result.interaction_type || "Meeting",
          date: result.date || prev.date,
          time: result.time || prev.time,
          attendees: result.attendees || "",
          topics: result.topics || "",
          sentiment: result.sentiment || "Neutral",
          outcomes: result.outcomes || "",
          followup: result.followup || "",
        }));
        setChatMessages(prev => [...prev, { type: "ai", text: `Logged interaction #${result.id} for ${result.hcp_name}. Form updated.` }]);
        fetchHistory();
      }

      if (tool_used === "suggest_followup") {
        setForm(prev => ({
        ...prev,
          ai_suggestions: Array.isArray(result)? result : prev.ai_suggestions
        }));
        setChatMessages(prev => [...prev, { type: "ai", text: `Here are 3 follow-up suggestions:` }]);
      }

      if (tool_used === "summarize_voice_note") {
        setForm(prev => ({
        ...prev,
        ...result,
          ai_suggestions: result.ai_suggestions || prev.ai_suggestions
        }));
        setChatMessages(prev => [...prev, { type: "ai", text: "Voice note summarized and form filled." }]);
      }

      if (tool_used === "search_hcp") {
        if (result.length === 0) {
          setChatMessages(prev => [...prev, { type: "ai", text: `No interactions found for "${input.replace('search','').trim()}"` }]);
        } else {
          const list = result.map(r => `#${r.id}: ${r.hcp_name} on ${r.date} - ${r.topics || 'No topics'}`).join('\n');
          setChatMessages(prev => [...prev, { type: "ai", text: `Found ${result.length} interactions:\n${list}` }]);
        }
        setHistory(result);
      }

      setInput("");
    } catch (err) {
      console.error("ERROR:", err);
      const msg = err.response?.data?.detail || "Failed to reach AI backend. Is it running on :8000?";
      setError(msg);
      setChatMessages(prev => [...prev, { type: "ai", text: `Error: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentId) {
      setError("No interaction selected. Use AI to log one first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Build update string: field1=value1, field2=value2
      const updates = Object.entries(form)
       .filter(([k]) =>!["materials","samples","ai_suggestions"].includes(k))
       .map(([k,v]) => `${k}=${v}`)
       .join(", ");

      const res = await axios.post("http://127.0.0.1:8000/agent", {
        input: `edit ${currentId} ${updates}`
      });

      setChatMessages(prev => [...prev, { type: "ai", text: `Saved changes to interaction #${currentId}` }]);
      fetchHistory();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to save";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadFromHistory = (row) => {
    setCurrentId(row.id);
    setForm(prev => ({
     ...prev,
      hcp_name: row.hcp_name || "",
      interaction_type: row.interaction_type || "Meeting",
      date: row.date || "",
      time: row.time || "",
      attendees: row.attendees || "",
      topics: row.topics || "",
      sentiment: row.sentiment || "Neutral",
      outcomes: row.outcomes || "",
      followup: row.followup || "",
    }));
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.pageTitle}>Log HCP Interaction</h2>

      <div style={styles.mainGrid}>
        {/* LEFT PANEL */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Interaction Details {currentId && `#${currentId}`}</h3>
            <button onClick={handleSave} disabled={loading ||!currentId} style={styles.saveBtn}>
              💾 Save Changes
            </button>
          </div>

          <div style={styles.row}>
            <div style={styles.col}>
              <label style={styles.label}>HCP Name</label>
              <input
                placeholder="Search or select HCP..."
                value={form.hcp_name}
                onChange={(e) => updateForm("hcp_name", e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.col}>
              <label style={styles.label}>Interaction Type</label>
              <select
                value={form.interaction_type}
                onChange={(e) => updateForm("interaction_type", e.target.value)}
                style={styles.input}
              >
                <option>Meeting</option>
                <option>Call</option>
                <option>Email</option>
                <option>Conference</option>
              </select>
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.col}>
              <label style={styles.label}>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => updateForm("date", e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.col}>
              <label style={styles.label}>Time</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => updateForm("time", e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          <label style={styles.label}>Attendees</label>
          <input
            placeholder="Enter names or search..."
            value={form.attendees}
            onChange={(e) => updateForm("attendees", e.target.value)}
            style={styles.input}
          />

          <label style={styles.label}>Topics Discussed</label>
          <textarea
            placeholder="Enter key discussion points..."
            value={form.topics}
            onChange={(e) => updateForm("topics", e.target.value)}
            style={styles.textarea}
          />

          <button style={styles.voiceBtn}>
            ✨ Summarize from Voice Note (Requires Consent)
          </button>

          <label style={styles.sectionLabel}>Materials Shared / Samples Distributed</label>
          <div style={styles.subCard}>
            <div style={styles.subCardHeader}>
              <span>Materials Shared</span>
              <button style={styles.smallBtn}>🔍 Search/Add</button>
            </div>
            <div style={styles.emptyText}>No materials added.</div>
          </div>

          <div style={styles.subCard}>
            <div style={styles.subCardHeader}>
              <span>Samples Distributed</span>
              <button style={styles.smallBtn}>⊕ Add Sample</button>
            </div>
            <div style={styles.emptyText}>No samples added.</div>
          </div>

          <label style={styles.label}>
            Observed/Inferred HCP Sentiment
            <span style={styles.selectedEmoji}>{sentimentEmojis[form.sentiment]}</span>
          </label>
          <div style={styles.radioGroup}>
            {["Positive", "Neutral", "Negative"].map((s) => (
              <label key={s} style={styles.radioLabel}>
                <input
                  type="radio"
                  value={s}
                  checked={form.sentiment === s}
                  onChange={(e) => updateForm("sentiment", e.target.value)}
                />
                {s}
              </label>
            ))}
          </div>

          <label style={styles.label}>Outcomes</label>
          <textarea
            placeholder="Key outcomes or agreements..."
            value={form.outcomes}
            onChange={(e) => updateForm("outcomes", e.target.value)}
            style={styles.textarea}
          />

          <label style={styles.label}>Follow-up Actions</label>
          <textarea
            placeholder="Enter next steps or tasks..."
            value={form.followup}
            onChange={(e) => updateForm("followup", e.target.value)}
            style={styles.textarea}
          />

          <div style={styles.aiSuggestions}>
            <div style={styles.aiSuggestionsTitle}>AI Suggested Follow-ups:</div>
            {form.ai_suggestions.map((item, i) => (
              <div key={i} style={styles.suggestionItem}>+ {item}</div>
            ))}
          </div>

          {/* HISTORY TABLE */}
          <div style={styles.historySection}>
            <div style={styles.sectionLabel}>Recent Interactions</div>
            <div style={styles.table}>
              <div style={styles.tableHeader}>
                <div style={{flex: 0.5}}>ID</div>
                <div style={{flex: 2}}>HCP</div>
                <div style={{flex: 1}}>Date</div>
                <div style={{flex: 3}}>Topics</div>
              </div>
              {history.slice(0,5).map(row => (
                <div key={row.id} style={styles.tableRow} onClick={() => loadFromHistory(row)}>
                  <div style={{flex: 0.5}}>{row.id}</div>
                  <div style={{flex: 2}}>{row.hcp_name}</div>
                  <div style={{flex: 1}}>{row.date}</div>
                  <div style={{flex: 3,...styles.truncate}}>{row.topics || '-'}</div>
                </div>
              ))}
              {history.length === 0 && <div style={styles.emptyText}>No interactions yet.</div>}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{...styles.card,...styles.aiPanel}}>
          <div style={styles.aiHeader}>
            <div style={styles.aiIcon}>🔵</div>
            <div>
              <div style={styles.aiTitle}>AI Assistant</div>
              <div style={styles.aiSubtitle}>Log interaction via chat</div>
            </div>
          </div>

          <div style={styles.chatArea}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={msg.type === 'user'? styles.chatUser : styles.chatBubble}>
                {msg.text}
              </div>
            ))}
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.chatInputRow}>
            <input
              placeholder="Describe interaction or 'search Dr. Reddy'..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAI()}
              style={styles.chatInput}
            />
            <button
              onClick={handleAI}
              disabled={loading}
              style={{...styles.logBtn, opacity: loading? 0.6 : 1}}
            >
              {loading? "..." : "⚠️ Log"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: 20,
    fontFamily: "system-ui, -apple-system, sans-serif"
  },
  pageTitle: {
    margin: "0 0 20px 0",
    fontSize: 24,
    fontWeight: 600,
    color: "#0f172a"
  },
  mainGrid: {
    display: "flex",
    gap: 20,
    alignItems: "flex-start"
  },
  card: {
    background: "white",
    borderRadius: 12,
    padding: 24,
    flex: 2,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
  },
  aiPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    height: "calc(100vh - 100px)",
    position: "sticky",
    top: 20
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20
  },
  cardTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: "#334155"
  },
  saveBtn: {
    padding: "8px 14px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 500,
    color: "#475569",
    marginBottom: 6,
    marginTop: 14
  },
  selectedEmoji: {
    marginLeft: 8,
    fontSize: 20,
    verticalAlign: "middle"
  },
  sectionLabel: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
    marginTop: 20,
    marginBottom: 10
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 14,
    boxSizing: "border-box",
    outline: "none"
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 14,
    minHeight: 80,
    boxSizing: "border-box",
    fontFamily: "inherit",
    resize: "vertical"
  },
  row: {
    display: "flex",
    gap: 12
  },
  col: {
    flex: 1
  },
  voiceBtn: {
    width: "100%",
    padding: "10px",
    marginTop: 8,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    color: "#475569",
    textAlign: "left"
  },
  subCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10
  },
  subCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 8
  },
  smallBtn: {
    padding: "4px 10px",
    fontSize: 12,
    background: "white",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    cursor: "pointer"
  },
  emptyText: {
    fontSize: 13,
    color: "#94a3b8",
    fontStyle: "italic"
  },
  radioGroup: {
    display: "flex",
    gap: 20,
    marginTop: 6,
    marginBottom: 10
  },
  radioLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 14,
    cursor: "pointer"
  },
  aiSuggestions: {
    marginTop: 20,
    padding: 12,
    background: "#f8fafc",
    borderRadius: 8
  },
  aiSuggestionsTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
    marginBottom: 8
  },
  suggestionItem: {
    fontSize: 13,
    color: "#2563eb",
    marginBottom: 4,
    cursor: "pointer"
  },
  historySection: {
    marginTop: 24
  },
  table: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    overflow: "hidden"
  },
  tableHeader: {
    display: "flex",
    background: "#f8fafc",
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: "#64748b",
    borderBottom: "1px solid #e2e8f0"
  },
  tableRow: {
    display: "flex",
    padding: "10px 12px",
    fontSize: 13,
    borderBottom: "1px solid #f1f5f9",
    cursor: "pointer"
  },
  truncate: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  aiHeader: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: "1px solid #e2e8f0"
  },
  aiIcon: { fontSize: 20 },
  aiTitle: { fontSize: 15, fontWeight: 600 },
  aiSubtitle: { fontSize: 12, color: "#64748b" },
  chatArea: {
    flex: 1,
    overflowY: "auto",
    marginBottom: 12
  },
  chatBubble: {
    background: "#f1f5f9",
    padding: 12,
    borderRadius: 8,
    fontSize: 13,
    color: "#475569",
    marginBottom: 8,
    whiteSpace: "pre-wrap"
  },
  chatUser: {
    background: "#dbeafe",
    padding: 12,
    borderRadius: 8,
    fontSize: 13,
    color: "#1e40af",
    marginBottom: 8,
    marginLeft: 20
  },
  chatInputRow: {
    display: "flex",
    gap: 8,
    marginTop: "auto"
  },
  chatInput: {
    flex: 1,
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 14
  },
  logBtn: {
    padding: "10px 16px",
    background: "#f1f5f9",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500
  },
  error: {
    padding: 10,
    background: "#fef2f2",
    color: "#dc2626",
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 12
  }
};
