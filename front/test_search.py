

from realtimesearch import orch
import json

def test_search_queries():
    """Test various search queries to verify functionality"""
    
    test_queries = [
        "What is the capital of Tamil Nadu?",
        "Latest news about AI technology 2024",
        "How to install Python packages?",
        "Weather in Chennai today"
    ]
    
    print("=== Web Search Functionality Test ===\n")
    
    for i, query in enumerate(test_queries, 1):
        print(f"Test {i}: {query}")
        print("-" * 50)
        
        try:
            result = orch.handle_query(query)
            
            print(f"Answer: {result['answer'][:200]}...")
            print(f"Citations: {len(result['citations'])}")
            print(f"Confidence: {result['confidence']}")
            print(f"Status: ✅ SUCCESS")
            
        except Exception as e:
            print(f"Status: ❌ ERROR - {e}")
            
        print("\n" + "="*60 + "\n")

if __name__ == "__main__":
    test_search_queries()