from typing import TypedDict, Annotated
import os
import json
from datetime import datetime, date, time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List, Any

from sqlalchemy import create_engine, Column, Integer, String, Date, Time, Text, TIMESTAMP, func
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import SQLAlchemyError

from langgraph.graph import StateGraph, END
from langchain_groq import ChatGroq

# ================================================
# ENVIRONMENT SETUP
# ================================================
from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

print("DATABASE_URL from.env:", DATABASE_URL)
print("GROQ_API_KEY from.env:", GROQ_API_KEY[:8] + "..." if GROQ_API_KEY else None)

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in environment variables.")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY not set in environment variables.")

# ================================================
# DATABASE SETUP
# ================================================
Base = declarative_base()
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Interaction(Base):
    __tablename__ = "interactions"
    id = Column(Integer, primary_key=True, index=True)
    hcp_name = Column(Text)
    interaction_type = Column(Text)
    date = Column(Date)
    time = Column(Time)
    attendees = Column(Text)
    topics = Column(Text)
    sentiment = Column(Text)
    outcomes = Column(Text)
    followup = Column(Text)
    summary = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

Base.metadata.create_all(bind=engine)

# ================================================
# FASTAPI INITIALIZATION
# ================================================
app = FastAPI(title="AI-First CRM HCP Module - LogInteractionScreen")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================================================
# Pydantic Models
# ================================================
class AgentInput(BaseModel):
    input: str

# ================================================
# LLM INITIALIZATION (GROQ via langchain_groq)
# ================================================
llm = ChatGroq(api_key=GROQ_API_KEY, model="llama-3.1-8b-instant", temperature=0)

# ================================================
# HELPER FUNCTIONS
# ================================================
def row_to_dict(row):
    """Convert SQLAlchemy row to plain dict for JSON serialization"""
    result = {c.name: getattr(row, c.name) for c in row.__table__.columns}
    # Convert date/time objects to strings for JSON
    for key, value in result.items():
        if isinstance(value, (date, time)):
            result[key] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
    return result

def decide_tool(user_input: str) -> str:
    """Simple intent detection to route to correct tool"""
    user_input_lower = user_input.lower()
    if "log interaction" in user_input_lower or "met dr" in user_input_lower or "discussed" in user_input_lower:
        return "log_interaction"
    elif "edit " in user_input_lower:
        return "edit_interaction"
    elif "search" in user_input_lower or "find dr" in user_input_lower:
        return "search_hcp"
    elif "suggest followup" in user_input_lower or "suggest follow-up" in user_input_lower:
        return "suggest_followup"
    elif "voice" in user_input_lower or "transcript" in user_input_lower:
        return "summarize_voice_note"
    else:
        return "log_interaction"

# ================================================
# TOOL 1: log_interaction
# ================================================
def log_interaction(raw_text: str):
    print("Entering node: log_interaction")
    session = SessionLocal()
    try:
        prompt = f"""
You are an AI CRM assistant. Extract structured data from this text and return ONLY
a valid JSON with these fields:
["hcp_name","interaction_type","date","time","attendees","topics","sentiment","outcomes","followup","summary"]
If any field is missing, set it to "" except sentiment -> "Neutral".
If date or time are missing, use current date/time.
For date use YYYY-MM-DD format. For time use HH:MM:SS format.
DO NOT add any text before or after the JSON. No markdown. No explanations. No notes.

Input text:
{raw_text}
"""
        response = llm.invoke(prompt).content
        print("LLM raw response:", response)

        # Robust JSON extraction: find first { and last }
        response = response.strip()
        start = response.find('{')
        end = response.rfind('}')
        if start!= -1 and end!= -1:
            response = response[start:end+1]

        data = json.loads(response)

        today = date.today()
        now_time = datetime.now().time()
        data["date"] = data.get("date") or str(today)
        data["time"] = data.get("time") or str(now_time.strftime("%H:%M:%S"))

        new_row = Interaction(
            hcp_name=data.get("hcp_name", ""),
            interaction_type=data.get("interaction_type", ""),
            date=datetime.strptime(data["date"], "%Y-%m-%d").date() if isinstance(data["date"], str) else data["date"],
            time=datetime.strptime(data["time"], "%H:%M:%S").time() if isinstance(data["time"], str) else data["time"],
            attendees=data.get("attendees", ""),
            topics=data.get("topics", ""),
            sentiment=data.get("sentiment", "Neutral"),
            outcomes=data.get("outcomes", ""),
            followup=data.get("followup", ""),
            summary=data.get("summary", "")
        )
        session.add(new_row)
        session.commit()
        session.refresh(new_row)
        return row_to_dict(new_row)
    except SQLAlchemyError as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"DB Error: {str(e)}")
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"LLM returned invalid JSON: {response}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        session.close()

# ================================================
# TOOL 2: edit_interaction
# ================================================
def edit_interaction(interaction_id: int, updates: dict):
    print("Entering node: edit_interaction")
    session = SessionLocal()
    try:
        record = session.query(Interaction).filter(Interaction.id == interaction_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="Interaction not found.")
        for key, value in updates.items():
            if hasattr(record, key):
                setattr(record, key, value)
        session.commit()
        session.refresh(record)
        return row_to_dict(record)
    except SQLAlchemyError as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()

# ================================================
# TOOL 3: search_hcp
# ================================================
def search_hcp(hcp_name: str):
    print("Entering node: search_hcp")
    session = SessionLocal()
    try:
        records = session.query(Interaction).filter(Interaction.hcp_name.ilike(f"%{hcp_name}%")).all()
        return [row_to_dict(r) for r in records]
    finally:
        session.close()

# ================================================
# TOOL 4: suggest_followup
# ================================================
def suggest_followup(interaction_id: int):
    print("Entering node: suggest_followup")
    session = SessionLocal()
    try:
        record = session.query(Interaction).filter(Interaction.id == interaction_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="Interaction not found.")
        prompt = f"""
Given this interaction:
Topics: {record.topics}
Outcomes: {record.outcomes}

Suggest 3 specific actionable follow-up steps. Return ONLY a JSON list of strings.
No markdown. No explanations. No text before or after the JSON.

Example: ["Send brochure", "Schedule call", "Share pricing"]
"""
        response = llm.invoke(prompt).content
        response = response.strip()
        start = response.find('[')
        end = response.rfind(']')
        if start!= -1 and end!= -1:
            response = response[start:end+1]
        try:
            suggestions = json.loads(response)
        except json.JSONDecodeError:
            suggestions = [line.strip("-• ") for line in response.split("\n") if line.strip()]
        return suggestions
    finally:
        session.close()

# ================================================
# TOOL 5: summarize_voice_note
# ================================================
def summarize_voice_note(transcript: str):
    print("Entering node: summarize_voice_note")
    prompt = f"""
Summarize the following voice note into structured form. Return ONLY valid JSON with fields:
["hcp_name","interaction_type","date","time","attendees","topics","sentiment","outcomes","followup","summary"]
If any field missing, set it as "" (sentiment defaults to "Neutral").
For date use YYYY-MM-DD format. For time use HH:MM:SS format.
DO NOT add any text before or after the JSON. No markdown. No explanations.

Transcript:
{transcript}
"""
    response = llm.invoke(prompt).content
    response = response.strip()
    start = response.find('{')
    end = response.rfind('}')
    if start!= -1 and end!= -1:
        response = response[start:end+1]
    try:
        data = json.loads(response)
        return data
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail=f"LLM returned invalid JSON: {response}")

# ================================================
# LANGGRAPH FLOW SETUP
# ================================================
class AgentState(TypedDict):
    input: str
    output: Any

def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("log_interaction", log_interaction)
    graph.add_node("edit_interaction", edit_interaction)
    graph.add_node("search_hcp", search_hcp)
    graph.add_node("suggest_followup", suggest_followup)
    graph.add_node("summarize_voice_note", summarize_voice_note)
    graph.add_edge("log_interaction", END)
    graph.add_edge("edit_interaction", END)
    graph.add_edge("search_hcp", END)
    graph.add_edge("suggest_followup", END)
    graph.add_edge("summarize_voice_note", END)
    return graph.compile()

# ================================================
# API ENDPOINTS
# ================================================
@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/agent")
def run_agent(agent_input: AgentInput):
    tool_name = decide_tool(agent_input.input)
    print(f"Agent decided to use tool: {tool_name}")

    if tool_name == "log_interaction":
        result = log_interaction(agent_input.input)
    elif tool_name == "edit_interaction":
        try:
            parts = agent_input.input.split(" ", 2)
            interaction_id = int(parts[1])
            updates_str = parts[2]
            updates = {}
            for kv in updates_str.split(","):
                if "=" in kv:
                    key, value = kv.split("=", 1)
                    updates[key.strip()] = value.strip()
            result = edit_interaction(interaction_id, updates)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid input for edit: {e}")
    elif tool_name == "search_hcp":
        name = agent_input.input.split(" ", 1)[-1].replace("search ", "").replace("find ", "")
        result = search_hcp(name)
    elif tool_name == "suggest_followup":
        try:
            parts = agent_input.input.split(" ")
            interaction_id = int(parts[-1])
            result = suggest_followup(interaction_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid input for suggest_followup. Format: 'suggest followup 1'")
    elif tool_name == "summarize_voice_note":
        text = agent_input.input.replace("voice", "").replace("transcript", "").strip()
        result = summarize_voice_note(text)
    else:
        raise HTTPException(status_code=400, detail="Unknown tool selected.")

    return {"tool_used": tool_name, "result": result}