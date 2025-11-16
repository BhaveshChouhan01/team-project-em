"""
Vector Store Manager using ChromaDB
Handles embedding generation and vector similarity search
"""

import chromadb
from chromadb.config import Settings
from typing import List, Dict, Optional
from sentence_transformers import SentenceTransformer
import uuid
import os

class VectorStore:
    def __init__(self, 
                 collection_name: str = "documents",
                 persist_directory: str = "./chroma_db",
                 embedding_model: str = "all-MiniLM-L6-v2"):
        """
        Initialize Vector Store with ChromaDB
        
        Args:
            collection_name: Name of the collection to store documents
            persist_directory: Directory to persist the database
            embedding_model: Sentence transformer model for embeddings
        """
        self.collection_name = collection_name
        self.persist_directory = persist_directory
        
        # Create directory if it doesn't exist
        os.makedirs(persist_directory, exist_ok=True)
        
        # Initialize ChromaDB client
        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Initialize embedding model
        print(f"Loading embedding model: {embedding_model}")
        self.embedding_model = SentenceTransformer(embedding_model)
        print("Embedding model loaded successfully")
        
        # Get or create collection
        try:
            self.collection = self.client.get_collection(name=collection_name)
            print(f"Loaded existing collection: {collection_name}")
        except:
            self.collection = self.client.create_collection(
                name=collection_name,
                metadata={"description": "Document embeddings for RAG"}
            )
            print(f"Created new collection: {collection_name}")
    
    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for a text
        
        Args:
            text: Input text
            
        Returns:
            Embedding vector
        """
        embedding = self.embedding_model.encode(text, convert_to_numpy=True)
        return embedding.tolist()
    
    def add_documents(self, chunks: List[Dict], user_id: Optional[str] = None) -> List[str]:
        """
        Add document chunks to vector store
        
        Args:
            chunks: List of document chunks with text and metadata
            user_id: Optional user ID to associate documents with
            
        Returns:
            List of document IDs
        """
        if not chunks:
            return []
        
        # Prepare data for ChromaDB
        ids = []
        documents = []
        embeddings = []
        metadatas = []
        
        for chunk in chunks:
            doc_id = str(uuid.uuid4())
            ids.append(doc_id)
            
            documents.append(chunk["text"])
            
            # Generate embedding
            embedding = self.generate_embedding(chunk["text"])
            embeddings.append(embedding)
            
            # Prepare metadata - ChromaDB requires all values to be strings, ints, floats, or bools
            metadata = {}
            for key, value in chunk.get("metadata", {}).items():
                if isinstance(value, (str, int, float, bool)):
                    metadata[key] = value
                else:
                    metadata[key] = str(value)
            
            if user_id:
                metadata["user_id"] = user_id
            metadata["chunk_index"] = int(chunk.get("chunk_index", 0))
            
            metadatas.append(metadata)
        
        # Add to collection
        self.collection.add(
            ids=ids,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas
        )
        
        print(f"Added {len(chunks)} chunks to vector store")
        return ids
    
    def search(self, 
               query: str, 
               n_results: int = 5,
               user_id: Optional[str] = None,
               filter_metadata: Optional[Dict] = None) -> List[Dict]:
        """
        Search for relevant documents
        
        Args:
            query: Search query
            n_results: Number of results to return
            user_id: Optional user ID to filter results
            filter_metadata: Optional metadata filters
            
        Returns:
            List of relevant documents with scores
        """
        # Generate query embedding
        query_embedding = self.generate_embedding(query)
        
        # Prepare where filter
        where_filter = filter_metadata.copy() if filter_metadata else {}
        if user_id:
            where_filter["user_id"] = user_id
        
        # Search in collection
        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where=where_filter if where_filter else None
            )
        except Exception as e:
            print(f"Search error: {e}")
            return []
        
        # Format results
        formatted_results = []
        if results and results["documents"] and len(results["documents"]) > 0:
            for i in range(len(results["documents"][0])):
                formatted_results.append({
                    "id": results["ids"][0][i],
                    "text": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i] if results["metadatas"] and len(results["metadatas"]) > 0 else {},
                    "distance": results["distances"][0][i] if results["distances"] and len(results["distances"]) > 0 else None
                })
        
        return formatted_results
    
    def delete_by_filename(self, filename: str, user_id: Optional[str] = None) -> int:
        """
        Delete all chunks from a specific file
        
        Args:
            filename: Name of the file to delete
            user_id: Optional user ID to filter deletion
            
        Returns:
            Number of deleted documents
        """
        where_filter = {"filename": filename}
        if user_id:
            where_filter["user_id"] = user_id
        
        try:
            results = self.collection.get(where=where_filter)
            if results and results["ids"]:
                self.collection.delete(ids=results["ids"])
                return len(results["ids"])
        except Exception as e:
            print(f"Error deleting documents: {e}")
        
        return 0
    
    def list_documents(self, user_id: Optional[str] = None) -> List[Dict]:
        """
        List all documents in the collection
        
        Args:
            user_id: Optional user ID to filter results
            
        Returns:
            List of document metadata
        """
        try:
            where_filter = {"user_id": user_id} if user_id else None
            results = self.collection.get(where=where_filter)
            
            # Group by filename
            documents = {}
            if results and results["metadatas"]:
                for metadata in results["metadatas"]:
                    filename = metadata.get("filename", "Unknown")
                    if filename not in documents:
                        documents[filename] = {
                            "filename": filename,
                            "chunks": 0,
                            "file_type": metadata.get("file_type", ""),
                            "user_id": metadata.get("user_id", "")
                        }
                    documents[filename]["chunks"] += 1
            
            return list(documents.values())
        except Exception as e:
            print(f"Error listing documents: {e}")
            return []
    
    def get_collection_stats(self) -> Dict:
        """Get statistics about the collection"""
        try:
            count = self.collection.count()
            return {
                "collection_name": self.collection_name,
                "total_documents": count,
                "persist_directory": self.persist_directory
            }
        except Exception as e:
            print(f"Error getting stats: {e}")
            return {
                "collection_name": self.collection_name,
                "total_documents": 0,
                "persist_directory": self.persist_directory,
                "error": str(e)
            }
    
    def reset_collection(self):
        """Delete all documents from collection"""
        try:
            self.client.delete_collection(name=self.collection_name)
            self.collection = self.client.create_collection(
                name=self.collection_name,
                metadata={"description": "Document embeddings for RAG"}
            )
            print(f"Reset collection: {self.collection_name}")
        except Exception as e:
            print(f"Error resetting collection: {e}")
