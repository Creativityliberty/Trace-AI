
import { SUPADATA_API_KEY } from '../constants';
import { TranscriptChunk } from '../types';

export const fetchTranscript = async (url: string): Promise<any> => {
  const response = await fetch(`https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(url)}&text=false`, {
    headers: { 'x-api-key': SUPADATA_API_KEY }
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Failed to fetch transcript');
  }
  
  return response.json();
};

export const pollJobStatus = async (jobId: string): Promise<any> => {
  const response = await fetch(`https://api.supadata.ai/v1/transcript/${jobId}`, {
    headers: { 'x-api-key': SUPADATA_API_KEY }
  });
  
  if (!response.ok) {
    throw new Error('Failed to check job status');
  }
  
  return response.json();
};
