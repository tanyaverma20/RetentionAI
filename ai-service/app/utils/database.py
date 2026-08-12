import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "retentionai")

# Production default: TLS certificate validation ENABLED.
# Optional explicit environment setting for local dev or custom CA bundles if required.
MONGODB_TLS_ALLOW_INVALID = os.getenv("MONGODB_TLS_ALLOW_INVALID", "false").lower() in ("true", "1", "yes")
MONGODB_TLS_CA_FILE = os.getenv("MONGODB_TLS_CA_FILE", None)

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_db():
    """
    Establish MongoDB connection.
    Enforces TLS certificate validation by default in production.
    """
    print(f"Connecting to MongoDB: {MONGODB_URI}")
    kwargs = {}
    if MONGODB_TLS_ALLOW_INVALID:
        kwargs["tlsAllowInvalidCertificates"] = True
    if MONGODB_TLS_CA_FILE and os.path.exists(MONGODB_TLS_CA_FILE):
        kwargs["tlsCAFile"] = MONGODB_TLS_CA_FILE

    db_instance.client = AsyncIOMotorClient(MONGODB_URI, **kwargs)
    db_instance.db = db_instance.client[MONGODB_DB_NAME]
    # Verify connection
    try:
        await db_instance.client.admin.command('ping')
        print("MongoDB connection established successfully.")
    except Exception as e:
        print(f"MongoDB connection failed: {e}")

async def disconnect_db():
    """
    Close MongoDB connection.
    """
    if db_instance.client:
        db_instance.client.close()
        print("MongoDB connection closed.")

def get_db():
    """
    Returns the active database instance.
    """
    return db_instance.db
