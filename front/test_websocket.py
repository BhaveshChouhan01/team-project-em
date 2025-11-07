

import asyncio
import websockets
import json

async def test_websocket():
    """Test WebSocket connection and search functionality"""
    
    try:
        
        async with websockets.connect("ws://localhost:8765") as websocket:
            print("✅ Connected to WebSocket server")
            
            
            test_query = {
                "query": "what is gold price today",
                "agentId": "general"
            }
            
            print(f"📤 Sending query: {test_query['query']}")
            await websocket.send(json.dumps(test_query))
            
            
            response = await websocket.recv()
            data = json.loads(response)
            
            print(f"📥 Response received:")
            print(f"   Type: {data.get('type')}")
            print(f"   Method: {data.get('method')}")
            print(f"   Content: {data.get('content', '')[:200]}...")
            print(f"   Sources: {len(data.get('sources', []))}")
            print(f"   Confidence: {data.get('confidence')}")
            
            if data.get('content') and 'gold price' in data.get('content', '').lower():
                print("✅ Gold price query working!")
            else:
                print("❌ Gold price query failed")
                
    except Exception as e:
        print(f"❌ WebSocket test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket())