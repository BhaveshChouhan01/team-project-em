/**
 * API Route for uploading documents to RAG system
 * POST /api/rag/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

export async function POST(request: NextRequest) {
  try {
    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['.pdf', '.docx', '.txt'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(fileExtension)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `File type ${fileExtension} not supported. Allowed types: ${allowedTypes.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Create upload directory if it doesn't exist
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Save file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${sanitizedFilename}`;
    const filepath = join(UPLOAD_DIR, filename);
    
    await writeFile(filepath, buffer);
    console.log(`File saved: ${filepath}`);

    // Call Python backend to ingest document
    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
    
    try {
      const ingestResponse = await fetch(`${pythonBackendUrl}/api/rag/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_path: filepath,
          user_id: userId || 'default_user',
          metadata: {
            original_filename: file.name,
            upload_timestamp: timestamp,
            file_size: file.size
          }
        })
      });

      if (!ingestResponse.ok) {
        const errorText = await ingestResponse.text();
        let errorDetail;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetail = errorJson.detail || errorJson.error || 'Failed to ingest document';
        } catch {
          errorDetail = errorText || 'Failed to ingest document';
        }
        throw new Error(errorDetail);
      }

      const ingestResult = await ingestResponse.json();

      return NextResponse.json({
        success: true,
        message: 'Document uploaded and ingested successfully',
        data: {
          filename: file.name,
          filepath: filepath,
          size: file.size,
          chunks_created: ingestResult.chunks_created,
          document_ids: ingestResult.document_ids
        }
      });

    } catch (fetchError: any) {
      console.error('Backend ingestion error:', fetchError);
      
      // Return partial success - file was uploaded but not ingested
      return NextResponse.json({
        success: false,
        error: `File uploaded but ingestion failed: ${fetchError.message}`,
        data: {
          filename: file.name,
          filepath: filepath,
          size: file.size
        }
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to upload document' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get list of uploaded documents
    const pythonBackendUrl = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
    const response = await fetch(`${pythonBackendUrl}/api/rag/stats`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }
    
    const stats = await response.json();
    return NextResponse.json(stats);
    
  } catch (error: any) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
