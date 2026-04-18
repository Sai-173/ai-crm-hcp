# AI-First HCP CRM

Log Healthcare Professional interactions using natural language. Built with FastAPI + LangGraph + Groq + React + Supabase.

### Features
- Chat to log: "Met Dr. Reddy, discussed OncoBoost, positive sentiment"
- AI auto-fills form fields: HCP, date, topics, sentiment, follow-up
- Save/edit interactions manually
- Search past interactions via AI: "search Dr. Reddy"
- AI follow-up suggestions
- Supabase persistence

### Stack
- **Backend**: FastAPI, LangGraph, Groq Llama-3.1-70B, Supabase
- **Frontend**: React + Axios
- **AI**: Function calling for `log_interaction`, `suggest_followup`, `search_hcp`, `summarize_voice_note`, `edit_interaction`

### Setup
**Backend**
cd backend
pip install fastapi uvicorn langgraph langchain-groq supabase
uvicorn main:app --reloadjavascript
**Frontend**
cd frontend
npm install
npm run devjavascript
**Env vars**:
Copy `.env.example` to `.env` and add your `SUPABASE_URL`, `SUPABASE_KEY`, `GROQ_API_KEY`
