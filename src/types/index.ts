export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error' | 'streaming';
}

export interface Document {
  id: string;
  name: string;
  size: number;
  uploadedAt: Date;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  extractedText?: string;
  storageUrl?: string;
}

export interface Thread {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessagePreview?: string;
}

export interface DealSnapshot {
  propertyName: string;
  address: string;
  askingPrice: number;
  noi: number;
  capRate: number;
  occupancy: number;
  totalUnits?: number;
  yearBuilt?: number;
  propertyType: string;
  highlights: string[];
  risks: string[];
}