from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import os
import google.generativeai as genai

app = FastAPI(title="TRAVELER.DEV API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "traveler.db"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

def get_gemini():
    if not GEMINI_API_KEY:
        return None
    genai.configure(api_key=GEMINI_API_KEY)
    return genai.GenerativeModel("gemini-1.5-flash")

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

class ChatMessage(BaseModel):
    message: str
    system: str | None = None

@app.get("/")
def health_check():
    return {
        "status": "active",
        "brand": "TRAVELER.DEV",
        "version": "2.0.0",
        "gemini": "configured" if GEMINI_API_KEY else "missing GEMINI_API_KEY",
        "database": "sqlite"
    }

@app.get("/health")
def health():
    return {"status": "ok", "gemini": bool(GEMINI_API_KEY)}

@app.post("/api/chat")
def chat(payload: ChatMessage):
    model = get_gemini()
    if not model:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")
    try:
        system = payload.system or "You are TRAVELER DEV, an AI assistant built by Dolor David Prince."
        response = model.generate_content(f"{system}\n\nUser: {payload.message}")
        return {
            "status": "success",
            "response": response.text,
            "model": "gemini-1.5-flash"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/agent/interrogate")
def interrogate_workspace(payload: AgentQuery):
    model = get_gemini()
    try:
        if model:
            system = "You are TRAVELER DEV agent. Analyze the workspace query and provide actionable insights."
            response = model.generate_content(f"{system}\n\nQuery: {payload.prompt}")
            analysis = response.text
        else:
            analysis = f"Workspace interrogated for: {payload.prompt} [Gemini not configured]"

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO interrogations (prompt, analysis) VALUES (?, ?)",
            (payload.prompt, analysis)
        )
        conn.commit()
        conn.close()
        return {"status": "success", "query": payload.prompt, "analysis": analysis}
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
