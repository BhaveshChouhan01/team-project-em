import os
import time
import json
import hashlib
import logging
import requests
import threading
import datetime
from urllib.parse import urlparse, urljoin
from http import HTTPStatus
from collections import defaultdict, Counter
from typing import List, Dict, Tuple, Optional
import re
from dotenv import load_dotenv

load_dotenv()

try:
    from bs4 import BeautifulSoup
except Exception:
    BeautifulSoup = None

try:
    import nltk
    nltk_available = True
except Exception:
    nltk_available = False

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    sklearn_available = True
except Exception:
    sklearn_available = False

logger = logging.getLogger("rtsearch")
logger.setLevel(logging.DEBUG)
ch = logging.StreamHandler()
ch.setFormatter(logging.Formatter("%(asctime)s %(levelname)s: %(message)s"))
logger.addHandler(ch)


class PolicyProxy:
    """
    Simple policy proxy that enforces basic quotas, secrets, and logs.
    In production this would be a networked service that validates outgoing requests.
    """
    def __init__(self, quotas: Dict[str,int] = None):
        self.quotas = quotas or {"google_search_per_minute": 60}
        self.counters = defaultdict(lambda: {"count": 0, "reset": time.time() + 60})
        self.lock = threading.Lock()
        
        
        self.vault = {
            "GOOGLE_API_KEY": os.environ.get("REACT_APP_GOOGLE_API_KEY") or os.environ.get("GOOGLE_API_KEY", ""),
            "SEARCH_ENGINE_ID": os.environ.get("REACT_APP_SEARCH_ENGINE_ID") or os.environ.get("SEARCH_ENGINE_ID", ""),
            "SERPAPI_KEY": os.environ.get("SERPAPI_KEY", "")
        }
        
        print(f"Loaded API Key: {'***' + self.vault['GOOGLE_API_KEY'][-4:] if self.vault['GOOGLE_API_KEY'] else 'MISSING'}")
        print(f"Loaded Search Engine ID: {self.vault['SEARCH_ENGINE_ID'] if self.vault['SEARCH_ENGINE_ID'] else 'MISSING'}")

    def check_and_consume(self, key_name:str, cost:int=1) -> bool:
        
        with self.lock:
            bucket = self.counters[key_name]
            if time.time() > bucket["reset"]:
                bucket["count"] = 0
                bucket["reset"] = time.time() + 60
            if bucket["count"] + cost > self.quotas.get(key_name, 1000000):
                logger.warning(f"Quota exceeded for {key_name}")
                return False
            bucket["count"] += cost
            return True

    def get_secret(self, name:str) -> str:
        return self.vault.get(name,"")

    def log_request(self, metadata:Dict):
        logger.info(f"PolicyProxy log: {json.dumps(metadata)}")

policy = PolicyProxy()


class QueryPlanner:
    """
    Very simple planner: if query contains 'recent' or date words or 'latest', prefer search.
    Also if the query is factual + time-sensitive, prefer search.
    """
    time_sensitive_tokens = {"latest","now","today","yesterday","recent","breaking","2025","2024","new","released","announce","updates"}

    def should_search(self, query:str, user_prefers_search:Optional[bool]=None) -> bool:
        if user_prefers_search is not None:
            return user_prefers_search
        q_lower = query.lower()
        if any(tok in q_lower for tok in self.time_sensitive_tokens):
            return True
        
        if re.match(r"^(when|who|what|where|how|is|are|did|do)\b", q_lower):
            
            return True
        return False

planner = QueryPlanner()

class GoogleCustomSearchConnector:
    """
    Minimal wrapper for Google Programmable Search (Custom Search JSON API).
    Produces a list of {'title','link','snippet','cacheId','displayLink'}.
    Requires GOOGLE_API_KEY and SEARCH_ENGINE_ID in policy vault.
    """
    SEARCH_URL = "https://www.googleapis.com/customsearch/v1"

    def __init__(self, policy_proxy:PolicyProxy):
        self.policy = policy_proxy

    def search(self, q:str, num:int=5) -> List[Dict]:
        if not self.policy.check_and_consume("google_search_per_minute", 1):
            logger.error("Quota exceeded for Google search")
            return []
            
        api_key = self.policy.get_secret("GOOGLE_API_KEY")
        cx = self.policy.get_secret("SEARCH_ENGINE_ID")
        
        if not api_key or not cx:
            logger.error(f"Missing Google API credentials - API Key: {bool(api_key)}, Search Engine ID: {bool(cx)}")
            return []
            
        params = {"key": api_key, "cx": cx, "q": q, "num": min(num, 10)}
        
        try:
            logger.info(f"Making Google search request for query: {q}")
            r = requests.get(self.SEARCH_URL, params=params, timeout=10)
            
            if r.status_code != 200:
                logger.error(f"Google search failed with status {r.status_code}: {r.text[:200]}")
                return []
                
            data = r.json()
            
            if "error" in data:
                logger.error(f"Google API error: {data['error']}")
                return []
                
            items = []
            for it in data.get("items", []):
                items.append({
                    "title": it.get("title", ""),
                    "link": it.get("link", ""),
                    "snippet": it.get("snippet", ""),
                    "displayLink": it.get("displayLink", ""),
                    "cacheId": it.get("cacheId", "")
                })
                
            logger.info(f"Successfully retrieved {len(items)} search results")
            self.policy.log_request({"type": "google_search", "query": q, "count": len(items)})
            return items
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error during Google search: {e}")
            return []
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Google search response: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error during Google search: {e}")
            return []

class SerpApiConnector:
    """
    Minimal SerpAPI connector fallback. Requires SERPAPI_KEY.
    """
    SERP_URL = "https://serpapi.com/search.json"
    def __init__(self, policy_proxy:PolicyProxy):
        self.policy = policy_proxy

    def search(self, q:str, num:int=5) -> List[Dict]:
        key = self.policy.get_secret("SERPAPI_KEY")
        if not key:
            logger.info("No SerpAPI key found, skipping SerpAPI search")
            return []
            
        params = {"q": q, "engine": "google", "api_key": key, "num": num}
        
        try:
            logger.info(f"Making SerpAPI search request for query: {q}")
            r = requests.get(self.SERP_URL, params=params, timeout=10)
            
            if r.status_code != 200:
                logger.error(f"SerpAPI search failed with status {r.status_code}")
                return []
                
            js = r.json()
            
            if "error" in js:
                logger.error(f"SerpAPI error: {js['error']}")
                return []
                
            res = []
            for p in js.get("organic_results", [])[:num]:
                res.append({
                    "title": p.get("title", ""),
                    "link": p.get("link", ""),
                    "snippet": p.get("snippet", "")
                })
                
            logger.info(f"Successfully retrieved {len(res)} SerpAPI results")
            self.policy.log_request({"type": "serpapi_search", "query": q, "count": len(res)})
            return res
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error during SerpAPI search: {e}")
            return []
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse SerpAPI response: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error during SerpAPI search: {e}")
            return []


class SimpleFetcher:
    """
    Fetches pages with respect for robots.txt and conditional requests using ETag/Last-Modified.
    Keeps a local file-based cache mapping URL->(etag,lastmod,content,access_time)
    """
    def __init__(self, cache_path="fetch_cache.json", user_agent="rtsearch-bot/1.0"):
        self.cache_path = cache_path
        self.user_agent = user_agent
        self._load_cache()
        self.robots_cache = {}

    def _load_cache(self):
        try:
            with open(self.cache_path, "r", encoding="utf-8") as f:
                self.cache = json.load(f)
        except Exception:
            self.cache = {}

    def _save_cache(self):
        with open(self.cache_path, "w", encoding="utf-8") as f:
            json.dump(self.cache, f)

    def _can_fetch(self, url):
        parsed = urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        
        
        trusted_domains = [
            "wikipedia.org", "britannica.com", "gov.in", "edu", 
            "stackoverflow.com", "github.com", "medium.com"
        ]
        
        if any(domain in parsed.netloc for domain in trusted_domains):
            return True
            
        rp = self.robots_cache.get(base)
        if rp is None:
            try:
                robots_url = urljoin(base, "/robots.txt")
                r = requests.get(robots_url, headers={"User-Agent": self.user_agent}, timeout=3)
                rp = r.text if r.status_code == 200 else ""
            except Exception:
                rp = ""
            self.robots_cache[base] = rp
        
        txt = self.robots_cache.get(base, "")
        
        if re.search(r"User-agent:\s*\*\s*Disallow:\s*/\s*$", txt, re.I | re.M):
            return False
        return True

    def fetch(self, url, force=False, timeout=10) -> Dict:
        if not self._can_fetch(url):
            logger.warning("robots.txt blocks fetching %s", url)
            return {"url":url,"status":"blocked","content":""}
        headers = {"User-Agent": self.user_agent}
        cached = self.cache.get(url)
        if cached and not force:
            
            if cached.get("etag"):
                headers["If-None-Match"] = cached["etag"]
            if cached.get("last_modified"):
                headers["If-Modified-Since"] = cached["last_modified"]
        try:
            r = requests.get(url, headers=headers, timeout=timeout)
        except Exception as e:
            logger.warning("Fetch error %s for %s", e, url)
            return {"url":url,"status":"error","content":""}
        if r.status_code == HTTPStatus.NOT_MODIFIED and cached:
            cached["accessed"] = time.time()
            self.cache[url] = cached
            self._save_cache()
            return {"url":url,"status":"not_modified","content":cached.get("content",""), "headers":r.headers}
        content = r.text
        
        entry = {
            "etag": r.headers.get("ETag"),
            "last_modified": r.headers.get("Last-Modified"),
            "content": content,
            "accessed": time.time(),
            "fetched_at": datetime.datetime.now(datetime.UTC).isoformat()+"Z",
            "status_code": r.status_code
        }
        self.cache[url] = entry
        self._save_cache()
        return {"url":url,"status":"ok","content":content,"headers":r.headers, "status_code": r.status_code}

fetcher = SimpleFetcher()


class ContentExtractor:
    """
    Extract main text from HTML. If BeautifulSoup available, do simple tag removal + heuristics.
    Also performs light boilerplate removal and language detection stub.
    """
    def __init__(self):
        pass

    def extract(self, html:str, url:str="") -> Dict:
        text = html
        title = None
        if BeautifulSoup:
            soup = BeautifulSoup(html, "html.parser")
           
            article = soup.find("article")
            if article:
                main = article.get_text(separator="\n")
            else:
                
                for s in soup(["script","style","noscript","iframe"]):
                    s.decompose()
                
                texts = [(len(t.get_text(strip=True)), t) for t in soup.find_all(['div','main','section','body','p','article'])]
                texts_sorted = sorted(texts, key=lambda x: x[0], reverse=True)
                main = texts_sorted[0][1].get_text(separator="\n") if texts_sorted else soup.get_text(separator="\n")
            
            t = soup.find("title")
            title = t.get_text().strip() if t else None
            text = re.sub(r'\n\s*\n+', '\n\n', main).strip()
        else:
            
            text = re.sub(r'<[^>]+>', ' ', html)
            text = re.sub(r'\s+', ' ', text).strip()
        
        lang = "unknown"
        if len(text) > 0:
            ascii_ratio = sum(1 for c in text if ord(c) < 128) / max(1, len(text))
            lang = "en" if ascii_ratio > 0.8 else "unknown"
       
        if len(text) < 50:
            text = ""
        return {"url":url, "title": title, "text": text, "lang": lang}

extractor = ContentExtractor()

class PromptInjectionDetector:
    """
    Simple heuristics for prompt injection from web content:
    - Looks for phrases telling the model to ignore instructions
    - Long inline code blocks, hidden inputs, suspicious <script> with eval
    - The extractor should not blindly follow "This is the true answer" claims without verification.
    """
    suspicious_patterns = [
        r"ignore (previous|earlier) instructions",
        r"follow the instructions below",
        r"do not verify",
        r"this is the true answer",
        r"click here to continue",
    ]

    def detect(self, text:str) -> List[str]:
        hits = []
        t = text.lower()
        for p in self.suspicious_patterns:
            if re.search(p, t):
                hits.append(p)
        
        
        base64_matches = re.findall(r"[A-Za-z0-9+/=]{200,}", text)
        if base64_matches and any("eval" in text.lower() or "script" in text.lower() for _ in base64_matches):
            hits.append("long_base64_like")
            
        if "<script" in text.lower() and "eval(" in text.lower():
            hits.append("script_eval")
        return hits

pi_detector = PromptInjectionDetector()

def dedupe_snippets(items: List[Dict], threshold=0.8) -> List[Dict]:
    """
    Very simple dedupe by snippet fingerprint (hash and Jaccard on words)
    """
    out = []
    seen_hashes = set()
    for it in items:
        snippet = (it.get("snippet") or it.get("text") or "")[:400]
        h = hashlib.sha256(snippet.encode("utf-8")).hexdigest()
        if h in seen_hashes:
            continue
        seen_hashes.add(h)
        out.append(it)
    return out


class BM25:
    def __init__(self, docs:List[str], k1=1.5, b=0.75):
        self.docs = docs
        self.N = len(docs)
        self.avgdl = sum(len(d.split()) for d in docs) / max(1, self.N)
        self.k1 = k1
        self.b = b
        self.doc_freqs = []
        self.df = {}
        self.term_freqs = []
        for doc in docs:
            freqs = Counter(doc.split())
            self.term_freqs.append(freqs)
            for t in freqs.keys():
                self.df[t] = self.df.get(t,0) + 1

    def score(self, query:str) -> List[float]:
        q_terms = query.split()
        scores = [0.0]*self.N
        for qi in q_terms:
            df = self.df.get(qi,0)
            idf = max(0.0, (self.N - df + 0.5) / (df + 0.5))
            idf = max(0.001, (self.N - df + 0.5) / (df + 0.5))  
            idf = max(0.0, math_log(idf))
            for i, freqs in enumerate(self.term_freqs):
                f = freqs.get(qi,0)
                denom = f + self.k1 * (1 - self.b + self.b * len(self.docs[i].split()) / self.avgdl)
                scores[i] += idf * (f * (self.k1+1) / (denom + 1e-8))
        return scores

import math
def math_log(x):
    return math.log(x+1e-12)


class Reranker:
    def __init__(self, docs:List[str]):
        self.docs = docs
        try:
            self.bm25 = BM25(docs)
        except Exception as e:
            self.bm25 = None
        if sklearn_available:
            self.vectorizer = TfidfVectorizer(stop_words="english")
            self.tfidf = self.vectorizer.fit_transform(docs)
        else:
            self.vectorizer = None
            self.tfidf = None

    def rank(self, query:str, top_k:int=5) -> List[Tuple[int,float]]:
        
        scores = []
        if self.bm25:
            bm_scores = self.bm25.score(query)
        else:
            bm_scores = [0]*len(self.docs)
        
        if self.tfidf is not None:
            qv = self.vectorizer.transform([query])
            cos = cosine_similarity(self.tfidf, qv).reshape(-1)
            cos_scores = cos.tolist()
        else:
            cos_scores = [0.0]*len(self.docs)
       
        for i in range(len(self.docs)):
            combined = 0.6*bm_scores[i] + 0.4*cos_scores[i]
            scores.append((i, combined))
        scores_sorted = sorted(scores, key=lambda x: x[1], reverse=True)
        return scores_sorted[:top_k]


def chunk_text(text:str, chunk_size:int=500, overlap:int=50) -> List[str]:
    words = text.split()
    out = []
    i=0
    while i < len(words):
        chunk = words[i:i+chunk_size]
        out.append(" ".join(chunk))
        if i+chunk_size >= len(words):
            break
        i += chunk_size - overlap
    return out

def generate_citation(result:Dict, access_time:Optional[datetime.datetime]=None, quote:Optional[str]=None) -> Dict:
    access_time = access_time or datetime.datetime.now(datetime.UTC)
    c = {
        "url": result.get("link") or result.get("url"),
        "title": result.get("title") or result.get("displayLink") or "",
        "accessed": access_time.isoformat()+"Z"
    }
    if quote:
        c["quote"] = quote
    return c

def compose_answer(query:str, ranked_items:List[Dict], used_spans:List[Tuple[str,str]]):
    """
    Compose an answer: synthesize main claim from top sources (very simple),
    add citations and confidence estimate (heuristic).
    used_spans: list of (url, span_text) that were pulled to support each claim
    """
    
    top_snips = [it.get("snippet") or (it.get("text")[:900] if it.get("text") else "") for it in ranked_items[:3]]
    body = "\n\n".join(s for s in top_snips if s)
    citations = [generate_citation(it, quote=(used_spans[idx][1] if idx < len(used_spans) else None))
                 for idx, it in enumerate(ranked_items[:len(used_spans)])]
    
    confidence = min(0.95, 0.4 + 0.2*len(ranked_items) + 0.1*(1 if "trusted" in (ranked_items[0].get("displayLink","") if ranked_items else "") else 0))
    return {"answer": body or "I found sources but couldn't synthesize a short answer.", "citations": citations, "confidence": round(confidence,2)}

class Orchestrator:
    def __init__(self, policy:PolicyProxy):
        self.policy = policy
        self.google = GoogleCustomSearchConnector(policy)
        self.serp = SerpApiConnector(policy)
        self.fetcher = fetcher
        self.extractor = extractor

    def handle_query(self, query:str, user_prefers_search:Optional[bool]=None) -> Dict:
        do_search = planner.should_search(query, user_prefers_search)
        if not do_search:
            logger.info("Planner decided not to search; returning model knowledge (simulated)")
            return {"answer": f"(model-only) I think: {query}", "citations": [], "confidence": 0.4}
       
        results = self.google.search(query, num=6)
        if not results:
            results = self.serp.search(query, num=6)
        results = dedupe_snippets(results)
        fetched = []
        for r in results[:6]:
            url = r.get("link") or r.get("url")
            if not url:
                continue
            page = self.fetcher.fetch(url)
            if page.get("status") in ("blocked","error"):
                continue
            content = page.get("content","")
            extracted = self.extractor.extract(content, url=url)
            
            injections = pi_detector.detect(content)
            if injections and len(injections) > 1: 
                logger.warning("Multiple prompt injection patterns detected in %s: %s", url, injections)
                continue
            elif injections:
                logger.info("Minor injection pattern detected in %s: %s (proceeding anyway)", url, injections)
            r2 = r.copy()
            r2.update({"text": extracted.get("text",""), "title_extracted": extracted.get("title")})
            fetched.append(r2)
        if not fetched:
            return {"answer":"No fetchable sources found.","citations":[],"confidence":0.2}
        docs = [f.get("text") or f.get("snippet","") for f in fetched]
        reranker = Reranker(docs)
        ranked_idx = reranker.rank(query, top_k=min(5,len(docs)))
        ranked_items = [fetched[i] for i,score in ranked_idx]
        used_spans=[]
        for it in ranked_items:
            txt = it.get("text","")
            chunks = chunk_text(txt, chunk_size=250, overlap=40)
            
            found_span=None
            q_terms = [t for t in re.findall(r"\w+", query.lower()) if len(t)>2]
            for ch in chunks:
                ch_low = ch.lower()
                if all(any(qt in token for token in ch_low.split()) for qt in q_terms[:3]):  
                    found_span = ch[:500]
                    break
            if not found_span and chunks:
                found_span = chunks[0][:500]
            used_spans.append((it.get("link") or it.get("url"), found_span))
        answer_obj = compose_answer(query, ranked_items, used_spans)
        answer_obj["model"] = "simulated (compose)"
        answer_obj["generated_at"] = datetime.datetime.now(datetime.UTC).isoformat()+"Z"
        return answer_obj

orch = Orchestrator(policy)

def example():
    q = "Where is TamilNadu located?"
    print("Query:", q)
    res = orch.handle_query(q)
    print("\n--- SYNTHESIZED ANSWER ---")
    print(res["answer"])
    print("\n--- CITATIONS ---")
    print(json.dumps(res["citations"], indent=2))
    print("\nConfidence:", res["confidence"])

if __name__ == "__main__":
    example()