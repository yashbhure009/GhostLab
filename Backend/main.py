import sys
import os
sys.path.append(os.path.dirname(__file__))
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from Backend.anonymizer import anonymize_text
from Backend.mapping_store import restore_text
from Backend.ai_mock import run_ai
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
class AnalyzeRequest(BaseModel):
    text: str
    known_fakes: List[str] = []
@app.get("/")
def home():
    return {
        "Ghost Lab": "RUNNING",
        "message": "Welcome to the Ghost Lab API!"
    }
@app.post("/analyze")
def analyze(data: AnalyzeRequest):
    user_input = data.text
    known_fakes = set(data.known_fakes)
    sanitized = anonymize_text(user_input, known_fakes=known_fakes)
    ai_response = run_ai(sanitized)
    final_response = restore_text(ai_response)
    return {
        "original_input": user_input,
        "sanitized_sent_to_ai": sanitized,
        "ai_output": ai_response,
        "final_output": final_response
    }