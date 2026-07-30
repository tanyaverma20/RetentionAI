"""
app/utils/migrations.py
=========================
One-time, idempotent startup migrations. Currently: reconciling the
prediction-history collection name mismatch between FastAPI (which used to
write to "predictionHistory", camelCase) and Node's Mongoose model (which
reads/writes "predictionhistories" — Mongoose's default pluralization of the
model name `PredictionHistory`). These were two entirely disjoint
collections; this migration merges any pre-existing data from the old name
into the correct one without loss, then removes the now-empty old
collection. Safe to run on every startup — it's a no-op once migrated.
"""


async def migrate_prediction_history_collection(db):
    old_name = "predictionHistory"
    new_name = "predictionhistories"

    existing = await db.list_collection_names()
    if old_name not in existing:
        return  # already migrated (or never existed) — nothing to do

    if new_name not in existing:
        # Atomic, index-preserving rename — the common case.
        await db[old_name].rename(new_name)
        count = await db[new_name].count_documents({})
        print(f"[migration] Renamed '{old_name}' -> '{new_name}' ({count} documents)")
        return

    # Both collections exist — merge old into new (skip any _id already
    # present in the new collection), then drop the old one.
    old_docs = await db[old_name].find({}).to_list(length=None)
    if old_docs:
        existing_ids = set()
        async for doc in db[new_name].find({}, {"_id": 1}):
            existing_ids.add(doc["_id"])
        to_insert = [d for d in old_docs if d["_id"] not in existing_ids]
        if to_insert:
            await db[new_name].insert_many(to_insert, ordered=False)
        print(f"[migration] Merged {len(to_insert)} document(s) from '{old_name}' into '{new_name}'")

    await db.drop_collection(old_name)
    print(f"[migration] Dropped now-redundant '{old_name}' collection")
