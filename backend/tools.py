from database import SessionLocal
from models import Interaction

def log_interaction(data):
    db = SessionLocal()
    try:
        obj = Interaction(**data)
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return {"message": "Saved", "id": obj.id}
    except Exception as e:
        return {"error": str(e)}
    finally:
        db.close()


def edit_interaction(data):
    db = SessionLocal()
    try:
        obj = db.query(Interaction).filter(Interaction.id == data["id"]).first()
        if obj:
            obj.summary = data["summary"]
            db.commit()
            return {"message": "Updated"}
        return {"error": "Not found"}
    finally:
        db.close()


def get_history():
    db = SessionLocal()
    try:
        data = db.query(Interaction).all()
        return [{"hcp": i.hcp_name, "summary": i.summary} for i in data]
    finally:
        db.close()


def hcp_insights(name):
    return {"insight": f"{name} prefers diabetes drugs"}


def schedule_followup(name):
    return {"message": f"Follow-up scheduled with {name}"}