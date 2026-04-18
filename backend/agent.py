from typing import TypedDict

# ---- STATE ----
class State(TypedDict):
    input: str
    output: str

# ---- DUMMY FUNCTIONS (replace later with real logic) ----
def get_history():
    return "No history available"

def hcp_insights(name: str):
    return f"Basic insights for {name}"

def schedule_followup(name: str):
    return f"Follow-up scheduled for {name}"

def extract_data(text: str):
    # simple mock extraction
    return {
        "hcp_name": "Dr Rao",
        "date": "2026-04-17",
        "summary": text
    }

# ---- MAIN PROCESS FUNCTION ----
def process(state: State) -> State:
    text = state["input"].lower()

    if "history" in text:
        return {"output": get_history()}

    elif "insight" in text:
        return {"output": hcp_insights("Dr Rao")}

    elif "followup" in text:
        return {"output": schedule_followup("Dr Rao")}

    else:
        data = extract_data(state["input"])
        return {"output": f"Extracted: {data}"}


# ---- SIMPLE GRAPH MOCK (instead of broken LangGraph) ----
class SimpleGraph:
    def invoke(self, state):
        return process(state)

graph = SimpleGraph()