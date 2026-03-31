// src/data/mockData.js

export const channelStats = [
  { 
    id: 'whatsapp', 
    title: 'WhatsApp', 
    count: 30, 
    description: 'Encrypted messaging gateway for instant claim submission.',
    status: 'PROCESSING',
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-400',
    hexColor: '#34d399' 
  },
  { 
    id: 'email', 
    title: 'Email', 
    count: 50, 
    description: 'Corporate relay for batch PDF processing and TPA sync.',
    status: 'SYNCING',
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-400',
    hexColor: '#60a5fa' 
  },
  { 
    id: 'ftp', 
    title: 'FTP Server', 
    count: 200, 
    description: 'Direct hospital portal bridge for high-volume claim datasets.',
    status: 'STANDBY',
    colorClass: 'text-purple-400',
    bgClass: 'bg-purple-400',
    hexColor: '#c084fc' 
  }
];

// New Data for the Bar Chart
export const processingTrendsData = [
  { time: '08:00', volume: 40 },
  { time: '12:00', volume: 65 },
  { time: '16:00', volume: 85 },
  { time: '20:00', volume: 110 },
  { time: '00:00', volume: 55 },
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