"""
Document Processor for RAG
Handles document ingestion, chunking, and preprocessing
"""

import os
from typing import List, Dict
from pathlib import Path
import PyPDF2
from docx import Document
import tiktoken

class DocumentProcessor:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        """
        Initialize document processor
        
        Args:
            chunk_size: Maximum size of each text chunk in tokens
            chunk_overlap: Overlap between chunks to maintain context
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.encoding = tiktoken.get_encoding("cl100k_base")
    
    def read_file(self, file_path: str) -> str:
        """
        Read content from various file types
        
        Args:
            file_path: Path to the file
            
        Returns:
            Extracted text content
        """
        file_extension = Path(file_path).suffix.lower()
        
        try:
            if file_extension == '.pdf':
                return self._read_pdf(file_path)
            elif file_extension == '.docx':
                return self._read_docx(file_path)
            elif file_extension == '.txt':
                return self._read_txt(file_path)
            else:
                raise ValueError(f"Unsupported file type: {file_extension}")
        except Exception as e:
            raise Exception(f"Error reading file {file_path}: {str(e)}")
    
    def _read_pdf(self, file_path: str) -> str:
        """Extract text from PDF file"""
        text = ""
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"
        except Exception as e:
            raise Exception(f"Error reading PDF: {str(e)}")
        return text
    
    def _read_docx(self, file_path: str) -> str:
        """Extract text from DOCX file"""
        try:
            doc = Document(file_path)
            text = "\n".join([paragraph.text for paragraph in doc.paragraphs if paragraph.text.strip()])
            return text
        except Exception as e:
            raise Exception(f"Error reading DOCX: {str(e)}")
    
    def _read_txt(self, file_path: str) -> str:
        """Read text file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                return file.read()
        except UnicodeDecodeError:
            # Try with different encoding if UTF-8 fails
            with open(file_path, 'r', encoding='latin-1') as file:
                return file.read()
    
    def chunk_text(self, text: str, metadata: Dict = None) -> List[Dict]:
        """
        Split text into overlapping chunks
        
        Args:
            text: Input text to chunk
            metadata: Optional metadata to attach to each chunk
            
        Returns:
            List of dictionaries containing chunks and metadata
        """
        if not text or not text.strip():
            return []
        
        # Encode text to tokens
        tokens = self.encoding.encode(text)
        chunks = []
        
        start = 0
        while start < len(tokens):
            # Get chunk of tokens
            end = min(start + self.chunk_size, len(tokens))
            chunk_tokens = tokens[start:end]
            
            # Decode back to text
            chunk_text = self.encoding.decode(chunk_tokens)
            
            # Create chunk with metadata
            chunk_data = {
                "text": chunk_text,
                "metadata": metadata.copy() if metadata else {},
                "chunk_index": len(chunks),
                "start_token": start,
                "end_token": end
            }
            
            chunks.append(chunk_data)
            
            # Move to next chunk with overlap
            start = end - self.chunk_overlap
            
            # Break if we've reached the end
            if end >= len(tokens):
                break
        
        return chunks
    
    def process_document(self, file_path: str, metadata: Dict = None) -> List[Dict]:
        """
        Process a document: read and chunk it
        
        Args:
            file_path: Path to the document
            metadata: Optional metadata to attach
            
        Returns:
            List of processed chunks with metadata
        """
        # Read file content
        text = self.read_file(file_path)
        
        if not text or not text.strip():
            raise ValueError(f"No text content extracted from {file_path}")
        
        # Add file info to metadata
        if metadata is None:
            metadata = {}
        
        metadata.update({
            "filename": Path(file_path).name,
            "file_path": file_path,
            "file_type": Path(file_path).suffix
        })
        
        # Chunk the text
        chunks = self.chunk_text(text, metadata)
        
        return chunks
    
    def count_tokens(self, text: str) -> int:
        """Count tokens in text"""
        return len(self.encoding.encode(text))
