from langchain_community.embeddings.sentence_transformer import SentenceTransformerEmbeddings

# Cache the embeddings model
_embeddings = None

def get_embeddings():
    """
    Initializes and returns the sentence-transformers embedding model.
    """
    global _embeddings
    if _embeddings is None:
        print("Loading SentenceTransformerEmbeddings...")
        _embeddings = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
    return _embeddings
