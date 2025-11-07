import asyncio
import websockets
import json
import os
import sys
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to Python path to import realtimesearch
sys.path.append(str(Path(__file__).parent))

from realtimesearch import Orchestrator, PolicyProxy, QueryPlanner

# Try to import Gemini
try:
    import google.generativeai as genai
    genai_available = True
except ImportError:
    genai_available = False
    print("Warning: google-generativeai not installed. Model responses will be unavailable.")

# Ensure environment variables are set
if not os.getenv('REACT_APP_GOOGLE_API_KEY'):
    os.environ['REACT_APP_GOOGLE_API_KEY'] = 'AIzaSyBPf5zKoNq-sTTUiUvi1LT6Sm7Tav-Ya-8'
if not os.getenv('REACT_APP_SEARCH_ENGINE_ID'):
    os.environ['REACT_APP_SEARCH_ENGINE_ID'] = 'a06de0b448531400e'
if not os.getenv('REACT_APP_GEMINI_API_KEY'):
    os.environ['REACT_APP_GEMINI_API_KEY'] = 'AIzaSyCnUAbhDk8IKaK79NryYPUqISMCpsHFOjU'

print(f"GOOGLE_API_KEY: {os.getenv('REACT_APP_GOOGLE_API_KEY', 'NOT SET')[:10]}...")
print(f"SEARCH_ENGINE_ID: {os.getenv('REACT_APP_SEARCH_ENGINE_ID', 'NOT SET')}")

# Configure Gemini
GEMINI_API_KEY = os.getenv('REACT_APP_GEMINI_API_KEY')
print(f"Gemini API Key: {GEMINI_API_KEY[:10] if GEMINI_API_KEY else 'NOT SET'}...")
model = None
if GEMINI_API_KEY and genai_available:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    print("Gemini model configured successfully")

# Initialize components
policy = PolicyProxy()
orchestrator = Orchestrator(policy)
planner = QueryPlanner()

async def get_gold_price():
    """Get current gold price from a reliable API"""
    try:
        apis = [
            'https://api.metals.live/v1/spot/gold',
            'https://api.goldapi.io/api/XAU/USD',
        ]
        for api_url in apis:
            try:
                response = requests.get(api_url, timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                        price = data[0].get('price')
                        if price:
                            return f"Current gold price: ${price:.2f} per ounce (USD) - Data from live market feeds"
                    elif 'price' in data:
                        price = data['price']
                        return f"Current gold price: ${price:.2f} per ounce (USD) - Data from live market feeds"
                    elif 'price_gram_24k' in data:
                        price_oz = data['price_gram_24k'] * 31.1035
                        return f"Current gold price: ${price_oz:.2f} per ounce (USD) - Data from live market feeds"
            except:
                continue
        return "Current gold price: ~$2,650-2,700 per ounce (USD) - Live data temporarily unavailable, showing recent market range"
    except Exception as e:
        print(f"Gold price API error: {e}")
        return "Current gold price: ~$2,650-2,700 per ounce (USD) - Live data temporarily unavailable, showing recent market range"

# ✅ UPDATED HANDLER — FIXED FOR websockets v11+
async def handle_query(websocket):
    """Handle WebSocket connections and process queries"""
    print(f"New client connected: {websocket.remote_address}")

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                query = data.get('query', '')
                agent_id = data.get('agentId', 'general')

                print(f"Received query: {query} (agent: {agent_id})")

                # Check for gold price query
                if 'gold price' in query.lower() or 'price of gold' in query.lower():
                    print("Handling gold price query...")
                    gold_info = await get_gold_price()
                    response = {
                        'type': 'search_response',
                        'content': gold_info,
                        'sources': [{'url': 'https://api.metals.live', 'title': 'Metals Live API', 'accessed': '2025-01-27'}],
                        'confidence': 0.9,
                        'method': 'api'
                    }
                    await websocket.send(json.dumps(response))
                    continue

                # Determine if we should use search or model
                should_search = planner.should_search(query)

                if should_search:
                    print("Using web search...")
                    try:
                        result = orchestrator.handle_query(query)
                        print(f"Search result: {result}")

                        if (result['answer'] == "No fetchable sources found." or
                            result.get('confidence', 0) < 0.3 or
                            len(result.get('citations', [])) == 0):
                            print("Search failed or low confidence, falling back to Gemini...")
                            should_search = False
                        else:
                            response = {
                                'type': 'search_response',
                                'content': result['answer'],
                                'sources': result.get('citations', []),
                                'confidence': result.get('confidence', 0.5),
                                'method': 'search'
                            }
                    except Exception as e:
                        print(f"Search error: {e}")
                        should_search = False

                if not should_search:
                    print("Using Gemini model...")
                    if model and GEMINI_API_KEY:
                        try:
                            agent_prompts = {
                                'general': "You are a helpful assistant providing clear and professional responses.",
                                'research': "You are a research analyst. Focus on detailed, evidence-based answers.",
                                'code': "You are a code assistant. Provide clean, efficient code solutions.",
                                'travel': "You are a travel planner. Give practical travel advice and tips.",
                                'tutor': "You are a learning tutor. Explain concepts clearly with examples."
                            }

                            prompt = agent_prompts.get(agent_id, agent_prompts['general'])
                            full_query = f"{prompt}\n\nUser: {query}"

                            gemini_response = model.generate_content(full_query)
                            content = gemini_response.text

                            response = {
                                'type': 'model_response',
                                'content': content,
                                'sources': [],
                                'confidence': 0.85,
                                'method': 'model'
                            }
                        except Exception as e:
                            print(f"Gemini error: {e}")
                            response = {
                                'type': 'error',
                                'content': 'Sorry, I encountered an error processing your request.',
                                'sources': [],
                                'confidence': 0.1,
                                'method': 'error'
                            }
                    else:
                        response = {
                            'type': 'error',
                            'content': 'Gemini API key not configured or google-generativeai not installed.',
                            'sources': [],
                            'confidence': 0.1,
                            'method': 'error'
                        }

                await websocket.send(json.dumps(response))

            except json.JSONDecodeError:
                error_response = {
                    'type': 'error',
                    'content': 'Invalid JSON format',
                    'sources': [],
                    'confidence': 0.0,
                    'method': 'error'
                }
                await websocket.send(json.dumps(error_response))
            except Exception as e:
                print(f"Error processing message: {e}")
                error_response = {
                    'type': 'error',
                    'content': 'Internal server error',
                    'sources': [],
                    'confidence': 0.0,
                    'method': 'error'
                }
                await websocket.send(json.dumps(error_response))

    except websockets.exceptions.ConnectionClosed:
        print(f"Client disconnected: {websocket.remote_address}")
    except Exception as e:
        print(f"WebSocket error: {e}")

async def main():
    """Start the WebSocket server"""
    print("Starting WebSocket server on localhost:8765...")

    google_key = os.getenv('REACT_APP_GOOGLE_API_KEY', '')
    search_id = os.getenv('REACT_APP_SEARCH_ENGINE_ID', '')

    print(f"Setting GOOGLE_API_KEY: {google_key[:10] if google_key else 'EMPTY'}...")
    print(f"Setting SEARCH_ENGINE_ID: {search_id}")

    os.environ['GOOGLE_API_KEY'] = google_key
    os.environ['SEARCH_ENGINE_ID'] = search_id

    print(f"Final GOOGLE_API_KEY in env: {os.environ.get('GOOGLE_API_KEY', 'NOT SET')[:10]}...")
    print(f"Final SEARCH_ENGINE_ID in env: {os.environ.get('SEARCH_ENGINE_ID', 'NOT SET')}")

    try:
        print("Testing search functionality...")
        test_result = orchestrator.handle_query("test query")
        print(f"Search test result: {test_result.get('answer', 'No answer')[:100]}...")
    except Exception as e:
        print(f"Search test failed: {e}")

    async with websockets.serve(handle_query, "localhost", 8765):
        print("WebSocket server is running...")
        print("Connect from React app to ws://localhost:8765")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    asyncio.run(main())
