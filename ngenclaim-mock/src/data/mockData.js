// src/data/mockData.js

export const channelStats = [
  { id: 'whatsapp', label: 'WhatsApp', count: 30, color: 'bg-green-500' },
  { id: 'email', label: 'Email', count: 50, color: 'bg-blue-500' },
  { id: 'ftp', label: 'FTP Server', count: 200, color: 'bg-purple-500' }
];

export const fileQueue = [
  { id: 'F-1001', channel: 'whatsapp', status: 'processed_clean', title: 'Claim_Doc_A.pdf' },
  { id: 'F-1002', channel: 'email', status: 'in_progress', title: 'Invoice_Hospital_XYZ.pdf' },
  { id: 'F-1003', channel: 'ftp', status: 'processed_issue', title: 'Batch_Upload_09.zip' },
  { id: 'F-1004', channel: 'whatsapp', status: 'waiting', title: 'Patient_ID_Card.jpg' },
];

export const dummyUsers = [
  {
    id: 'u-1',
    email: 'admin@ngenclaim.ai',
    password: 'password123',
    name: 'Alex Rivera',
    role: 'System Admin',
    tenant: 'Ngenclaim HQ',
    avatar: 'https://i.pravatar.cc/150?u=alex'
  },
  {
    id: 'u-2',
    email: 'sarah.m@metlife.com',
    password: 'password123',
    name: 'Sarah Miller',
    role: 'Tenant Admin',
    tenant: 'MetLife Insurance',
    avatar: 'https://i.pravatar.cc/150?u=sarah'
  },
  {
    id: 'u-3',
    email: 'james.d@hospital.com',
    password: 'password123',
    name: 'James Donovan',
    role: 'Claims Adjuster',
    tenant: 'City General Hospital',
    avatar: 'https://i.pravatar.cc/150?u=james'
  }
];