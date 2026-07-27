import re
import nltk
import spacy
from bs4 import BeautifulSoup
from nltk.corpus import stopwords

# Ensure NLTK stopwords are available (downloaded during setup)
try:
    stop_words = set(stopwords.words('english'))
except LookupError:
    nltk.download('stopwords')
    stop_words = set(stopwords.words('english'))

# Load spaCy model for lemmatization and tokenization
# Disable NER and Parser to speed up processing
nlp = spacy.load("en_core_web_sm", disable=["ner", "parser"])

def clean_text(text: str) -> str:
    """
    Cleans and preprocesses the input text for NLP tasks.
    
    Steps:
    1. Lowercasing
    2. Remove HTML
    3. Remove URLs
    4. Remove special characters and numbers
    5. Tokenization and Lemmatization (via spaCy)
    6. Stopword removal
    7. Remove extra spaces
    """
    if not text or not isinstance(text, str):
        return ""
    
    # 1. Lowercasing
    text = text.lower()
    
    # 2. Remove HTML tags
    text = BeautifulSoup(text, "html.parser").get_text()
    
    # 3. Remove URLs
    text = re.sub(r'http\S+|www\.\S+', '', text)
    
    # 4. Remove special characters and numbers
    text = re.sub(r'[^a-z\s]', ' ', text)
    
    # 5 & 6. Tokenization, Lemmatization, and Stopword removal via spaCy
    doc = nlp(text)
    cleaned_tokens = []
    for token in doc:
        lemma = token.lemma_
        if lemma not in stop_words and lemma.strip():
            cleaned_tokens.append(lemma)
            
    # 7. Rejoin and remove extra spaces
    cleaned_text = " ".join(cleaned_tokens)
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
    
    return cleaned_text
