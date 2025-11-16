"""
RAG Service - Main orchestrator for Retrieval-Augmented Generation
Combines document processing, vector search, and LLM generation
"""

from typing import List, Dict, Optional
import os
import sys

# Add current directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from documentProcessor import DocumentProcessor
from vectorStore import VectorStore

class RAGService:
    def __init__(self, 
                 vector_store: VectorStore = None,
                 doc_processor: DocumentProcessor = None):
        """
        Initialize RAG Service
        
        Args:
            vector_store: VectorStore instance (creates new if None)
            doc_processor: DocumentProcessor instance (creates new if None)
        """
        self.vector_store = vector_store or VectorStore()
        self.doc_processor = doc_processor or DocumentProcessor()
    
    def ingest_document(self, 
                       file_path: str, 
                       user_id: Optional[str] = None,
                       metadata: Optional[Dict] = None) -> Dict:
        """
        Ingest a document into the RAG system
        
        Args:
            file_path: Path to the document file
            user_id: Optional user ID
            metadata: Optional additional metadata
            
        Returns:
            Dictionary with ingestion results
        """
        try:
            # Check if file exists
            if not os.path.exists(file_path):
                return {
                    "success": False,
                    "error": f"File not found: {file_path}",
                    "chunks_created": 0
                }
            
            # Process document into chunks
            print(f"Processing document: {file_path}")
            chunks = self.doc_processor.process_document(file_path, metadata)
            
            if not chunks:
                return {
                    "success": False,
                    "error": "No content extracted from document",
                    "chunks_created": 0
                }
            
            # Add chunks to vector store
            print(f"Adding {len(chunks)} chunks to vector store")
            doc_ids = self.vector_store.add_documents(chunks, user_id)
            
            return {
                "success": True,
                "filename": os.path.basename(file_path),
                "chunks_created": len(chunks),
                "document_ids": doc_ids,
                "user_id": user_id
            }
            
        except Exception as e:
            print(f"Error ingesting document: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "chunks_created": 0
            }
    
    def retrieve_context(self, 
                        query: str, 
                        n_results: int = 5,
                        user_id: Optional[str] = None) -> List[Dict]:
        """
        Retrieve relevant context for a query
        
        Args:
            query: User query
            n_results: Number of relevant chunks to retrieve
            user_id: Optional user ID to filter results
            
        Returns:
            List of relevant document chunks
        """
        try:
            results = self.vector_store.search(
                query=query,
                n_results=n_results,
                user_id=user_id
            )
            return results
        except Exception as e:
            print(f"Error retrieving context: {str(e)}")
            return []
    
    def generate_rag_prompt(self, 
                           query: str, 
                           context_docs: List[Dict],
                           system_prompt: Optional[str] = None) -> str:
        """
        Generate an augmented prompt with retrieved context
        
        Args:
            query: User query
            context_docs: Retrieved context documents
            system_prompt: Optional custom system prompt
            
        Returns:
            Augmented prompt string
        """
        if not context_docs:
            return query
        
        # Build context section
        context_parts = []
        for i, doc in enumerate(context_docs, 1):
            source = doc.get("metadata", {}).get("filename", "Unknown source")
            text = doc.get("text", "")
            context_parts.append(f"[Source {i}: {source}]\n{text}")
        
        context_text = "\n\n".join(context_parts)
        
        # Default system prompt for RAG
        if not system_prompt:
            system_prompt = """You are a helpful AI assistant. Answer the user's question based on the provided context.
If the context doesn't contain relevant information, say so clearly.
Always cite your sources by mentioning [Source X] when using information from the context."""
        
        # Build final prompt
        augmented_prompt = f"""{system_prompt}

CONTEXT:
{context_text}

USER QUESTION:
{query}

Please provide a helpful answer based on the context above. If the context doesn't contain relevant information, acknowledge this and provide a general response if possible."""
        
        return augmented_prompt
    
    def query(self, 
             user_query: str,
             user_id: Optional[str] = None,
             n_results: int = 5,
             include_sources: bool = True) -> Dict:
        """
        Main RAG query function
        
        Args:
            user_query: The user's question
            user_id: Optional user ID for filtering
            n_results: Number of context chunks to retrieve
            include_sources: Whether to include source information
            
        Returns:
            Dictionary containing context and augmented prompt
        """
        try:
            # Retrieve relevant context
            context_docs = self.retrieve_context(
                query=user_query,
                n_results=n_results,
                user_id=user_id
            )
            
            # Generate augmented prompt
            augmented_prompt = self.generate_rag_prompt(
                query=user_query,
                context_docs=context_docs
            )
            
            # Format sources for response
            sources = []
            if include_sources:
                for doc in context_docs:
                    metadata = doc.get("metadata", {})
                    text_preview = doc.get("text", "")[:200]
                    if len(doc.get("text", "")) > 200:
                        text_preview += "..."
                    
                    sources.append({
                        "filename": metadata.get("filename", "Unknown"),
                        "chunk_index": metadata.get("chunk_index", 0),
                        "text_preview": text_preview,
                        "distance": doc.get("distance")
                    })
            
            return {
                "success": True,
                "augmented_prompt": augmented_prompt,
                "context_docs": context_docs,
                "sources": sources,
                "num_sources": len(sources),
                "has_context": len(context_docs) > 0
            }
        except Exception as e:
            print(f"Error in query: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "augmented_prompt": user_query,
                "context_docs": [],
                "sources": [],
                "num_sources": 0,
                "has_context": False
            }
    
    def delete_document(self, 
                       filename: str, 
                       user_id: Optional[str] = None) -> Dict:
        """
        Delete a document from the vector store
        
        Args:
            filename: Name of the file to delete
            user_id: Optional user ID
            
        Returns:
            Deletion result
        """
        try:
            deleted_count = self.vector_store.delete_by_filename(filename, user_id)
            return {
                "success": deleted_count > 0,
                "deleted_count": deleted_count,
                "filename": filename
            }
        except Exception as e:
            print(f"Error deleting document: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "deleted_count": 0,
                "filename": filename
            }
    
    def list_documents(self, user_id: Optional[str] = None) -> Dict:
        """
        List all documents in the system
        
        Args:
            user_id: Optional user ID to filter results
            
        Returns:
            List of documents with metadata
        """
        try:
            documents = self.vector_store.list_documents(user_id)
            return {
                "success": True,
                "documents": documents,
                "total": len(documents)
            }
        except Exception as e:
            print(f"Error listing documents: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "documents": [],
                "total": 0
            }
    
    def get_stats(self) -> Dict:
        """Get RAG system statistics"""
        try:
            stats = self.vector_store.get_collection_stats()
            return {
                "success": True,
                **stats
            }
        except Exception as e:
            print(f"Error getting stats: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }


# Singleton instance
_rag_service_instance = None

def get_rag_service() -> RAGService:
    """Get or create RAG service singleton"""
    global _rag_service_instance
    if _rag_service_instance is None:
        _rag_service_instance = RAGService()
    return _rag_service_instance    
