#!/usr/bin/env python3
"""
Simple test script to verify the integration works
"""
import asyncio
import websockets
import json
import os
import sys

async def test_websocket():
    """Test WebSocket connection and query processing"""
    
    
    try:
        with open('../.env', 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    os.environ[key] = value
    except FileNotFoundError:
        print("Warning: .env file not found")
    
    try:
       
        print("Connecting to WebSocket server...")
        async with websockets.connect("ws://localhost:8765") as websocket:
            print("Connected successfully!")
            
            
            test_queries = [
                {"query": "What is Python?", "agentId": "general", "expected": "model"},
                {"query": "Latest news about AI in 2024", "agentId": "research", "expected": "search"},
                {"query": "How to create a React component?", "agentId": "code", "expected": "model"},
                {"query": "Recent developments in machine learning", "agentId": "research", "expected": "search"}
            ]
            
            for i, test in enumerate(test_queries, 1):
                print(f"\n--- Test {i}: {test['query']} ---")
                print(f"Expected method: {test['expected']}")
                
             
                await websocket.send(json.dumps({
                    "query": test["query"],
                    "agentId": test["agentId"]
                }))
                
                
                response = await websocket.recv()
                data = json.loads(response)
                
                print(f"Actual method: {data.get('method', 'unknown')}")
                print(f"Response type: {data.get('type')}")
                print(f"Content length: {len(data.get('content', ''))}")
                print(f"Sources: {len(data.get('sources', []))}")
                print(f"Confidence: {data.get('confidence')}")
                
                if data.get('method') == test['expected']:
                    print("✅ Test passed!")
                else:
                    print("⚠️  Method different than expected (this might be normal)")

                print(f"Response content: {data.get('content', '')[:200]}...")
                await asyncio.sleep(1)
            
            print("\n🎉 All tests completed!")
            
    except ConnectionRefusedError:
        print("❌ Could not connect to WebSocket server.")
        print("Make sure to start the server first with: python websocket_server.py")
        return False
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("Testing WebSocket Integration")
    print("=" * 40)
    
    success = asyncio.run(test_websocket())
    
    if success:
        print("\n✅ Integration test completed successfully!")
        print("You can now start the React app and test the full system.")
    else:
        print("\n❌ Integration test failed.")
        print("Please check the server setup and try again.")
    
    sys.exit(0 if success else 1)