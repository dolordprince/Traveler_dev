from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3

app = FastAPI(title="TRAVELER.DEV API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "traveler.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS interrogations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt TEXT NOT NULL,
            analysis TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

@app.on_event("startup")
def startup_event():
    init_db()

class AgentQuery(BaseModel, extra="allow"):
    prompt: str
    context: dict | None = None

@app.get("/")
def health_check():
    return {"status": "active", "brand": "TRAVELER.DEV", "database": "sqlite"}

@app.post("/api/agent/interrogate")
def interrogate_workspace(payload: AgentQuery):
    try:
        analysis = f"Dyad workspace successfully interrogated for: {payload.prompt}"
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO interrogations (prompt, analysis) VALUES (?, ?)", (payload.prompt, analysis))
        conn.commit()
        conn.close()
        return {
            "status": "success",
            "query": payload.prompt,
            "analysis": analysis
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/agent/history")
def get_history():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM interrogations ORDER BY id DESC LIMIT 10")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
