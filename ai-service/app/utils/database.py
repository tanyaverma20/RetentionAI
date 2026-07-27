import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "retentionai")

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_db():
    """
    Establish MongoDB connection.
    """
    print(f"Connecting to MongoDB: {MONGODB_URI}")
    db_instance.client = AsyncIOMotorClient(MONGODB_URI)
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
