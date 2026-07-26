from fastapi import FastAPI

app = FastAPI(title="RetentionAI AI Service")


@app.get("/health")
def get_health() -> dict[str, str]:
    return {"status": "OK"}
