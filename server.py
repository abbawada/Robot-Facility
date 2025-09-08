from fastapi import FastAPI, Request
import pandas as pd
import os

app = FastAPI()
CSV_FILE = "telemetry.csv"

@app.post("/ingest")
async def ingest(req: Request):
    data = await req.json()
    df = pd.DataFrame([data])
    # Append to CSV (create header if file doesn’t exist)
    write_header = not os.path.exists(CSV_FILE)
    df.to_csv(CSV_FILE, mode="a", header=write_header, index=False)
    return {"status": "ok"}

@app.get("/data")
async def get_data():
    if not os.path.exists(CSV_FILE):
        return {"rows": []}
    df = pd.read_csv(CSV_FILE)
    return df.to_dict(orient="records")
