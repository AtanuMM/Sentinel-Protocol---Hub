import React, { useEffect, useState } from 'react';

/** Split microservices: set `VITE_INGESTION_EMAIL_URL` (e.g. http://localhost:3001). Monolith: omit both (defaults to :3000). */
const ingestionFtpBase = (import.meta.env.VITE_INGESTION_FTP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const ingestionEmailBase = (
  import.meta.env.VITE_INGESTION_EMAIL_URL ?? import.meta.env.VITE_INGESTION_FTP_URL ?? 'http://localhost:3000'
).replace(/\/$/, '');

function App() {
  const [status, setStatus] = useState({ msg: 'System Standby', type: 'info' });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [serverStatus, setServerStatus] = useState('unknown'); 
  const [feed, setFeed] = useState([]);

  // Default context
  const orgId = 'NI-001';
  const zone = 'eu-central-1';

  // Form State
  const [formData, setFormData] = useState({
    username: '', 
    password: '', 
    bucketName: '',
    region: zone
  });

  // Vault API Key Provisioning State
  const [showVaultForm, setShowVaultForm] = useState(false);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultForm, setVaultForm] = useState({ keycloakId: '', email: '' });
  const [vaultActive, setVaultActive] = useState(
    typeof window !== 'undefined' && Boolean(localStorage.getItem('sentinel.apiKey'))
  );
  const [vaultReveal, setVaultReveal] = useState(null);
  const [vaultKeyMode, setVaultKeyMode] = useState('provision');
  const [existingApiKey, setExistingApiKey] = useState('');
  const [manualKeySaving, setManualKeySaving] = useState(false);

  const closeVaultModal = () => {
    setShowVaultForm(false);
    setVaultKeyMode('provision');
    setExistingApiKey('');
  };

  const submitExistingVaultApiKey = (e) => {
    e.preventDefault();
    const trimmed = existingApiKey.trim();
    if (!trimmed) {
      setStatus({ msg: 'API key is required.', type: 'error' });
      return;
    }
    setManualKeySaving(true);
    try {
      localStorage.setItem('sentinel.apiKey', trimmed);
      setVaultActive(true);
      setStatus({ msg: 'Existing Vault API key saved.', type: 'success' });
      closeVaultModal();
    } finally {
      setManualKeySaving(false);
    }
  };

  // Email (IMAP) add-source flow
  const [showEmailVaultSetupModal, setShowEmailVaultSetupModal] = useState(false);
  const [emailVaultConfirmLoading, setEmailVaultConfirmLoading] = useState(false);
  const [showEmailSourceModal, setShowEmailSourceModal] = useState(false);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [emailSourceSaving, setEmailSourceSaving] = useState(false);
  const [emailSourceForm, setEmailSourceForm] = useState(() => {
    if (typeof window === 'undefined') {
      return { email: '', password: '', imapHost: '', imapPort: 993 };
    }
    try {
      const raw = localStorage.getItem('sentinel.lastEmailSource');
      if (!raw) return { email: '', password: '', imapHost: '', imapPort: 993 };
      const parsed = JSON.parse(raw);
      return {
        email: parsed?.email ?? '',
        password: '',
        imapHost: parsed?.imapHost ?? '',
        imapPort: Number(parsed?.imapPort ?? 993) || 993,
      };
    } catch {
      return { email: '', password: '', imapHost: '', imapPort: 993 };
    }
  });

  const [emailSources, setEmailSources] = useState([]);
  const [emailSourcesLoading, setEmailSourcesLoading] = useState(false);
  const [emailSourcesError, setEmailSourcesError] = useState(null);
  const [emailSourcesReloadKey, setEmailSourcesReloadKey] = useState(0);

  const bumpEmailSourcesReload = () => setEmailSourcesReloadKey((k) => k + 1);

  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [pollResult, setPollResult] = useState(null);
  const [pollError, setPollError] = useState(null);
  const [pollLoading, setPollLoading] = useState(false);

  // --- API: PING TEST ---
  const checkServerLink = async () => {
    setServerStatus('checking');
    try {
      const res = await fetch(`${ingestionFtpBase}/api/ping`);
      const data = await res.json();
      if (data.status === 'online') {
        setServerStatus('online');
        setStatus({ msg: 'Server Link Established: System Ready', type: 'success' });
      }
    } catch {
      setServerStatus('offline');
      setStatus({ msg: 'Server Link Failed: Is the Backend running?', type: 'error' });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const submitVaultProvision = async (e) => {
    e.preventDefault();
    setVaultLoading(true);
    setStatus({ msg: 'Provisioning Vault API Key...', type: 'info' });

    try {
      const res = await fetch('http://localhost:8000/api/v1/auth/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keycloakId: vaultForm.keycloakId.trim(),
          email: vaultForm.email.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Provisioning failed');

      localStorage.setItem('sentinel.apiKey', data.apiKey);
      localStorage.setItem('sentinel.userId', data.userId);

      setVaultActive(true);
      setVaultReveal({ apiKey: data.apiKey, userId: data.userId });
      setStatus({ msg: data.message || 'Vault API Key provisioned.', type: 'success' });
    } catch (err) {
      setStatus({ msg: `Vault Error: ${err.message}`, type: 'error' });
    } finally {
      setVaultLoading(false);
    }
  };

  const submitIntegration = async (e) => {
    e.preventDefault();
    setShowForm(false);
    setLoading(true);
    setStatus({ msg: 'Syncing External Credentials...', type: 'info' });

    try {
      const res = await fetch(`${ingestionFtpBase}/api/link-bucket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, zone, ...formData })
      });
      const data = await res.json();
      setStatus({ 
        msg: data.message || `Integration Active: ${formData.username} linked.`, 
        type: 'success' 
      });
    } catch {
      setStatus({ msg: 'Integration Handshake Failed.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // const initializeToday = () => triggerAction('init-today', 'Provisioning Date-Partition...');

  // const triggerAction = async (endpoint, startMsg) => {
  //   setLoading(true);
  //   setStatus({ msg: startMsg, type: 'info' });
  //   try {
  //     const res = await fetch(`http://localhost:3000/api/${endpoint}`, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({ orgId, zone })
  //     });
      
  //     const data = await res.json();
  //     if (!res.ok) throw new Error(data.error || 'Server Error');

  //     setStatus({ 
  //       msg: data.message || (data.path ? `Path Active: ${data.path}` : 'Operation Verified'), 
  //       type: 'success' 
  //     });
  //   } catch (err) {
  //     setStatus({ msg: `Error: ${err.message}`, type: 'error' });
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // Find the specific record for our active Org from the live feed
  const currentChannel = feed.find(f => f.organisation_id === orgId);
  const isOnboarded = currentChannel?.is_onboarded || false;

  const vaultTokenForList =
    typeof window !== 'undefined' ? localStorage.getItem('sentinel.apiKey')?.trim() ?? '' : '';
  const canListEmailSources = vaultActive && Boolean(vaultTokenForList);

  const pollServiceId =
    typeof window !== 'undefined' ? localStorage.getItem('email-service-id')?.trim() ?? '' : '';
  let pollMailboxEmail = '';
  if (Array.isArray(emailSources) && emailSources.length > 0 && emailSources[0]?.email) {
    pollMailboxEmail = String(emailSources[0].email).trim();
  } else if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('sentinel.lastEmailSource');
      if (raw) {
        const parsed = JSON.parse(raw);
        pollMailboxEmail = String(parsed?.email ?? '').trim();
      }
    } catch {
      pollMailboxEmail = '';
    }
  }
  const canPollClaims = canListEmailSources && Boolean(pollServiceId) && Boolean(pollMailboxEmail);

  const closePollModal = () => {
    setPollModalOpen(false);
    setPollResult(null);
    setPollError(null);
    setPollLoading(false);
  };

  const runPollClaimEmails = async () => {
    const apiKey = typeof window !== 'undefined' ? localStorage.getItem('sentinel.apiKey')?.trim() : '';
    const serviceId =
      typeof window !== 'undefined' ? localStorage.getItem('email-service-id')?.trim() : '';
    let email = '';
    if (Array.isArray(emailSources) && emailSources.length > 0 && emailSources[0]?.email) {
      email = String(emailSources[0].email).trim();
    } else if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('sentinel.lastEmailSource');
        if (raw) {
          const parsed = JSON.parse(raw);
          email = String(parsed?.email ?? '').trim();
        }
      } catch {
        email = '';
      }
    }
    if (!apiKey || !serviceId || !email) {
      setPollResult(null);
      setPollError(
        'Poll requires Vault API key, email service id (set up Vault email service), and a mailbox email (register a source or load the email list).',
      );
      setPollModalOpen(true);
      return;
    }
    setPollError(null);
    setPollResult(null);
    setPollModalOpen(true);
    setPollLoading(true);
    try {
      const res = await fetch(`${ingestionEmailBase}/api/email-to-ftp/email-source/poll-claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vault-token': apiKey,
        },
        body: JSON.stringify({ email, serviceId }),
      });
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok || !data.success) {
        const detail = data.detail || data.message || data.error || `HTTP ${res.status}`;
        setPollError(typeof detail === 'string' ? detail : JSON.stringify(detail));
        return;
      }
      setPollResult(data);
      bumpEmailSourcesReload();
    } catch (err) {
      setPollError(err.message || 'Poll failed');
    } finally {
      setPollLoading(false);
    }
  };

  // Function Wrappers
  const initializeToday = () => triggerAction('init-today', 'Provisioning Date-Partition...');

  const triggerAction = async (endpoint, startMsg) => {
    setLoading(true);
    setStatus({ msg: startMsg, type: 'info' });
    try {
      const res = await fetch(`${ingestionFtpBase}/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, zone })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server Error');

      setStatus({ 
        msg: data.message || (data.path ? `Path Active: ${data.path}` : 'Operation Verified'), 
        type: 'success' 
      });
    } catch (err) {
      setStatus({ msg: `Error: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Create an AbortController to cancel pending requests if the component unmounts
    const controller = new AbortController();
    
    const fetchFeed = async () => {
      try {
        const res = await fetch(`${ingestionFtpBase}/api/live-feed`, { 
          signal: controller.signal 
        });
        
        if (!res.ok) throw new Error('Feed error');
        
        const data = await res.json();
        setFeed(Array.isArray(data) ? data : []);
      } catch (err) {
        // Only log errors that aren't caused by us cancelling the request
        if (err.name !== 'AbortError') {
          console.error("Feed sync failed", err);
        }
      }
    };
    
    fetchFeed();
    const interval = setInterval(fetchFeed, 5000);

    // 2. Cleanup function
    return () => {
      clearInterval(interval);
      controller.abort(); // Cancel the fetch if the user leaves the page
    };
  }, []); // orgId/zone omitted because they are constants in your current state

  // Email sources: includeConnectionStatus runs live IMAP per row — no 5s poll; mount + manual refresh + after registration.
  useEffect(() => {
    if (!vaultActive) {
      setEmailSources([]);
      setEmailSourcesLoading(false);
      setEmailSourcesError(null);
      return undefined;
    }
    const apiKey = typeof window !== 'undefined' ? localStorage.getItem('sentinel.apiKey')?.trim() : '';
    if (!apiKey) {
      setEmailSources([]);
      setEmailSourcesLoading(false);
      setEmailSourcesError(null);
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      setEmailSourcesLoading(true);
      setEmailSourcesError(null);
      try {
        const url = `${ingestionEmailBase}/api/email-to-ftp/email-sources?orgId=${encodeURIComponent(orgId)}&includeConnectionStatus=true`;
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'x-vault-token': apiKey },
        });
        let data = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }
        if (cancelled) return;
        if (!res.ok) {
          const msg = data.detail || data.message || data.error || `HTTP ${res.status}`;
          setEmailSourcesError(typeof msg === 'string' ? msg : JSON.stringify(msg));
          setEmailSources([]);
          return;
        }
        if (!data.success) {
          setEmailSourcesError(data.message || 'List email sources failed.');
          setEmailSources([]);
          return;
        }
        setEmailSources(Array.isArray(data.sources) ? data.sources : []);
      } catch (err) {
        if (cancelled || err.name === 'AbortError') return;
        setEmailSourcesError(err.message || 'Request failed');
        setEmailSources([]);
      } finally {
        if (!cancelled) setEmailSourcesLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [orgId, vaultActive, emailSourcesReloadKey]);

  const hasEmailServiceId =
    typeof window !== 'undefined' && Boolean(localStorage.getItem('email-service-id'));

  const confirmEmailVaultSetup = async () => {
    setEmailVaultConfirmLoading(true);
    setStatus({ msg: 'Creating email service in Vault...', type: 'info' });
    try {
      const apiKey = localStorage.getItem('sentinel.apiKey');
      if (!apiKey) {
        throw new Error(
          'Vault API key missing. Generate or add an existing key from the header first.',
        );
      }

      const res = await fetch('http://localhost:8000/api/v1/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vault-token': apiKey,
        },
        body: JSON.stringify({ name: 'email-to-FTP' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to create email service');
      }
      if (!data.id) {
        throw new Error('Invalid response: missing service id');
      }

      localStorage.setItem('email-service-id', data.id);
      localStorage.setItem('sentinel.emailVaultReady', 'true');
      setShowEmailVaultSetupModal(false);
      setStatus({
        msg: `Email Vault service created (${data.name}).`,
        type: 'success',
      });
    } catch (err) {
      setStatus({ msg: `Email Vault Setup Error: ${err.message}`, type: 'error' });
    } finally {
      setEmailVaultConfirmLoading(false);
    }
  };

  const openEmailSourceFlow = () => {
    if (!localStorage.getItem('email-service-id')) {
      setShowEmailVaultSetupModal(true);
      setStatus({ msg: 'Create the email-to-FTP service first (Setup Email Vault Service).', type: 'info' });
      return;
    }
    setShowEmailSourceModal(true);
  };

  const submitEmailSource = async (e) => {
    e.preventDefault();
    setEmailSourceSaving(true);
    setStatus({ msg: 'Saving Email Source...', type: 'info' });
    try {
      const apiKey = localStorage.getItem('sentinel.apiKey');
      if (!apiKey?.trim()) {
        throw new Error('Vault API key required (GENERATE_VAULT_KEY or Add Existing API Key).');
      }
      const serviceId = localStorage.getItem('email-service-id');
      if (!serviceId?.trim()) {
        throw new Error('Email Vault service id missing. Complete Setup Email Vault Service first.');
      }
      if (!emailSourceForm.email?.trim() || !emailSourceForm.password?.trim() || !emailSourceForm.imapHost?.trim()) {
        throw new Error('Missing required fields: email/login, password, and IMAP host.');
      }
      const imapPort = Number(emailSourceForm.imapPort) || 993;
      const res = await fetch(`${ingestionEmailBase}/api/email-to-ftp/email-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vault-token': apiKey.trim(),
        },
        body: JSON.stringify({
          orgId,
          serviceId: serviceId.trim(),
          zoneId: zone,
          email: emailSourceForm.email.trim(),
          password: emailSourceForm.password,
          imapHost: emailSourceForm.imapHost.trim(),
          imapPort,
        }),
      });
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        const detail = data.detail || data.message || data.error || `HTTP ${res.status}`;
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }
      const persisted = {
        orgId,
        email: emailSourceForm.email.trim(),
        imapHost: emailSourceForm.imapHost.trim(),
        imapPort,
      };
      localStorage.setItem('sentinel.lastEmailSource', JSON.stringify(persisted));
      setEmailSourceForm((prev) => ({
        ...prev,
        password: '',
      }));
      setShowEmailSourceModal(false);
      setStatus({
        msg: `Email source registered (${data.data?.email ?? persisted.email}).`,
        type: 'success',
      });
      bumpEmailSourcesReload();
    } catch (err) {
      setStatus({ msg: `Email Setup Error: ${err.message}`, type: 'error' });
    } finally {
      setEmailSourceSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-8 lg:p-16 bg-sentinel-dark text-slate-200 font-sans">
      
      {/* Header Section */}
      <header className="w-full mx-auto mb-12 flex justify-between items-end border-b border-slate-700 pb-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white italic">
            SENTINEL<span className="text-sentinel-accent">.PROTOCOL</span>
          </h1>
          <p className="text-slate-400 mt-2 font-mono text-sm uppercase tracking-widest text-[10px]">
            Control Plane v1.0.0-POC
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Connection Status Button */}
          <button 
            onClick={checkServerLink}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
              serverStatus === 'online' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' :
              serverStatus === 'offline' ? 'bg-rose-500/10 border-rose-500/50 text-rose-400' :
              'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <div className={`h-1.5 w-1.5 rounded-full ${
              serverStatus === 'online' ? 'bg-emerald-400' : 
              serverStatus === 'offline' ? 'bg-rose-400' : 'bg-slate-500'
            } ${serverStatus === 'checking' ? 'animate-ping' : ''}`} />
            {serverStatus === 'online' ? 'LINK_ACTIVE' : serverStatus === 'offline' ? 'LINK_DOWN' : 'CHECK_LINK'}
          </button>

          {/* Generate Vault API Key Button */}
          <button
            onClick={() => {
              setVaultKeyMode('provision');
              setExistingApiKey('');
              setShowVaultForm(true);
            }}
            disabled={vaultLoading}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
              vaultActive
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
            } ${vaultLoading ? 'opacity-60 cursor-wait' : ''}`}
          >
            <div className={`h-1.5 w-1.5 rounded-full ${vaultActive ? 'bg-emerald-400' : 'bg-slate-500'} ${vaultLoading ? 'animate-ping' : ''}`} />
            {vaultActive ? 'VAULT_KEY_ACTIVE' : 'GENERATE_VAULT_KEY'}
          </button>

          <div className="text-right font-mono">
            <span className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px] font-bold text-sentinel-accent tracking-tighter uppercase">
              ORG: {orgId} // {zone}
            </span>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-8 relative">
        
        {/* Card 1: Data Integration */}
        <div className="bg-sentinel-card border border-slate-700 p-8 rounded-2xl shadow-xl hover:border-sentinel-accent transition-all group relative overflow-hidden">
          <div className="h-12 w-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-6 border border-blue-500/20">
            <svg className="w-6 h-6 text-sentinel-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connect FTP server</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Configure the external store credentials to activate the automated harvester.
          </p>
          <button 
            disabled={loading}
            onClick={() => setShowForm(true)}
            className="w-full py-3 px-4 bg-sentinel-accent hover:bg-sky-400 text-slate-900 font-bold rounded-xl transition-colors disabled:opacity-50">
            Configure External Ingress
          </button>
        </div>

        {/* Card 2: Add Email (IMAP) */}
        <div className="bg-sentinel-card border border-slate-700 p-8 rounded-2xl shadow-xl hover:border-sentinel-accent transition-all group relative overflow-hidden">
          <div className="h-12 w-12 bg-fuchsia-500/10 rounded-lg flex items-center justify-center mb-6 border border-fuchsia-500/20">
            <svg className="w-6 h-6 text-fuchsia-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0l-8 5-8-5m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2" />
            </svg>
          </div>

          <div className="flex items-start justify-between gap-4 mb-2">
            <h2 className="text-xl font-bold text-white">Add Email (IMAP)</h2>
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-widest ${
              hasEmailServiceId
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}>
              {hasEmailServiceId ? 'VAULT_READY' : 'VAULT_REQUIRED'}
            </span>
          </div>

          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Onboard a monitored inbox. Credentials are secured in Vault and used to test IMAP connectivity (API wiring next).
          </p>

          <div className="space-y-3">
            <button
              type="button"
              disabled={hasEmailServiceId}
              onClick={() => setShowEmailVaultSetupModal(true)}
              className={`w-full py-3 px-4 font-bold rounded-xl transition-colors uppercase text-[11px] tracking-widest border ${
                hasEmailServiceId
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border-slate-700'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
              }`}
            >
              Setup Email Vault Service
            </button>

            <button
              type="button"
              disabled={!hasEmailServiceId || emailSourceSaving}
              onClick={openEmailSourceFlow}
              className={`w-full py-3 px-4 font-bold rounded-xl transition-colors disabled:opacity-50 ${
                hasEmailServiceId && !emailSourceSaving
                  ? 'bg-sentinel-accent hover:bg-sky-400 text-slate-900'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              } ${emailSourceSaving ? 'cursor-wait' : ''}`}
            >
              {emailSourceSaving ? 'Opening...' : 'Add Email Source'}
            </button>
          </div>
        </div>

        {/* Card 3: Add WhatsApp */}
        <div className="bg-sentinel-card border border-slate-700 p-8 rounded-2xl shadow-xl hover:border-sentinel-accent transition-all group relative overflow-hidden">
          <div className="h-12 w-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-6 border border-emerald-500/20">
            <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 20l1.6-4.8A9 9 0 1112 21a9 9 0 01-4.6-1.3L3 20z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Add WhatsApp</h2>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            Configure a WhatsApp source for ingestion workflows.
          </p>
          <button
            onClick={() => setShowWhatsappModal(true)}
            className="w-full py-3 px-4 bg-sentinel-accent hover:bg-sky-400 text-slate-900 font-bold rounded-xl transition-colors"
          >
            Add WhatsApp Source
          </button>
        </div>

        {/* --- CONFIGURATION MODAL --- */}
        {showForm && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-sentinel-card border border-slate-700 w-full max-w-lg rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white">Ingress Setup</h3>
                <p className="text-slate-400 text-xs font-mono tracking-tighter opacity-70">ENFORCE: /{orgId}/{zone}/[DATE]/</p>
              </div>

              <form onSubmit={submitIntegration} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">IAM Username</label>
                    <input name="username" value={formData.username} onChange={handleInputChange} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm focus:outline-none focus:border-sentinel-accent" placeholder="minioadmin" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">IAM Password</label>
                    <input type="password" name="password" value={formData.password} onChange={handleInputChange} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm focus:outline-none focus:border-sentinel-accent" placeholder="••••••••" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">External Bucket Name</label>
                  <input name="bucketName" value={formData.bucketName} onChange={handleInputChange} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm focus:outline-none focus:border-sentinel-accent" placeholder="e.g. tpa-inbound-data" />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Target Region</label>
                  <input name="region" value={formData.region} onChange={handleInputChange} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm focus:outline-none focus:border-sentinel-accent" placeholder="eu-central-1" />
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-700 mt-6">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">Abort</button>
                  <button type="submit" className="flex-1 py-3 bg-sentinel-accent text-slate-900 font-bold rounded-xl hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20 uppercase tracking-widest text-xs italic">Commit Handshake</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- VAULT API KEY MODAL --- */}
        {showVaultForm && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-sentinel-card border border-slate-700 w-full max-w-lg rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white">
                  {vaultReveal
                    ? 'Vault API Key'
                    : vaultKeyMode === 'manual'
                      ? 'Use Existing API Key'
                      : 'Vault API Key'}
                </h3>
                <p className="text-slate-400 text-xs font-mono tracking-tighter opacity-70">
                  {vaultReveal
                    ? 'Store credentials securely.'
                    : vaultKeyMode === 'manual'
                      ? 'Only the key is saved; userId stays as-is unless you provision separately.'
                      : 'PROVISION: /api/v1/auth/provision'}
                </p>
              </div>

              {!vaultReveal && vaultKeyMode === 'manual' ? (
                <form onSubmit={submitExistingVaultApiKey} className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">API Key</label>
                    <input
                      type="password"
                      name="existingApiKey"
                      value={existingApiKey}
                      onChange={(e) => setExistingApiKey(e.target.value)}
                      required
                      autoComplete="off"
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm focus:outline-none focus:border-sentinel-accent font-mono"
                      placeholder="sv_live_..."
                    />
                  </div>
                  <div className="flex flex-col gap-3 pt-4 border-t border-slate-700 mt-6">
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setVaultKeyMode('provision');
                          setExistingApiKey('');
                        }}
                        className="flex-1 py-3 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={manualKeySaving}
                        className="flex-1 py-3 bg-sentinel-accent text-slate-900 font-bold rounded-xl hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20 uppercase tracking-widest text-xs italic disabled:opacity-50 disabled:cursor-wait"
                      >
                        {manualKeySaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </form>
              ) : !vaultReveal ? (
                <form onSubmit={submitVaultProvision} className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Keycloak ID</label>
                    <input
                      name="keycloakId"
                      value={vaultForm.keycloakId}
                      onChange={(e) => setVaultForm({ ...vaultForm, keycloakId: e.target.value })}
                      required
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm focus:outline-none focus:border-sentinel-accent"
                      placeholder="atanu_dev_02"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={vaultForm.email}
                      onChange={(e) => setVaultForm({ ...vaultForm, email: e.target.value })}
                      required
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm focus:outline-none focus:border-sentinel-accent"
                      placeholder="atanu@example.com"
                    />
                  </div>

                  <div className="flex flex-col gap-3 pt-4 border-t border-slate-700 mt-6">
                    <div className="flex gap-4">
                      <button type="button" onClick={closeVaultModal} className="flex-1 py-3 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">
                        Abort
                      </button>
                      <button type="submit" disabled={vaultLoading} className="flex-1 py-3 bg-sentinel-accent text-slate-900 font-bold rounded-xl hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20 uppercase tracking-widest text-xs italic disabled:opacity-50">
                        {vaultLoading ? 'Provisioning...' : 'Generate Vault Key'}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVaultKeyMode('manual')}
                      className="w-full py-2.5 text-xs font-bold text-sentinel-accent border border-sentinel-accent/40 rounded-xl hover:bg-sky-400/10 transition-colors uppercase tracking-widest"
                    >
                      Add Existing API Key
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-300 text-xs font-mono">
                    Store the API key now. It will not be shown again.
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">User ID</label>
                    <code className="block w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs text-slate-200 break-all">{vaultReveal.userId}</code>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">API Key</label>
                    <code className="block w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs text-sentinel-accent break-all">{vaultReveal.apiKey}</code>
                  </div>
                  <div className="flex gap-4 pt-4 border-t border-slate-700 mt-6">
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(vaultReveal.apiKey)}
                      className="flex-1 py-3 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors uppercase tracking-widest"
                    >
                      Copy API Key
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVaultReveal(null);
                        closeVaultModal();
                      }}
                      className="flex-1 py-3 bg-sentinel-success text-slate-900 font-bold rounded-xl hover:bg-emerald-400 transition-colors uppercase tracking-widest text-xs italic"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- EMAIL VAULT SETUP MODAL --- */}
        {showEmailVaultSetupModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-sentinel-card border border-slate-700 w-full max-w-lg rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white">Email Vault Service</h3>
                <p className="text-slate-400 text-xs font-mono tracking-tighter opacity-70">
                  ONE-TIME SETUP (POC USER)
                </p>
              </div>

              <div className="space-y-4 text-sm text-slate-300">
                <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">What this does</div>
                  <ul className="list-disc pl-5 space-y-1 text-slate-400">
                    <li>Creates the <span className="font-mono text-slate-300">email-to-FTP</span> service in Vault (POST /api/v1/services).</li>
                    <li>
                      Saves the service id to{' '}
                      <span className="font-mono text-slate-300">localStorage/email-service-id</span>
                      {' '}
                      (enables <strong className="text-slate-300">Add Email Source</strong>). Also sets{' '}
                      <span className="font-mono text-slate-300">sentinel.emailVaultReady</span>
                      {' '}
                      in localStorage.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-700 mt-6">
                <button
                  type="button"
                  disabled={emailVaultConfirmLoading}
                  onClick={() => setShowEmailVaultSetupModal(false)}
                  className="flex-1 py-3 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest disabled:opacity-50"
                >
                  Abort
                </button>
                <button
                  type="button"
                  onClick={confirmEmailVaultSetup}
                  disabled={emailVaultConfirmLoading}
                  className="flex-1 py-3 bg-sentinel-accent text-slate-900 font-bold rounded-xl hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20 uppercase tracking-widest text-xs italic disabled:opacity-50 disabled:cursor-wait"
                >
                  {emailVaultConfirmLoading ? 'Creating…' : 'Confirm Setup'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- ADD EMAIL SOURCE MODAL (UI ONLY) --- */}
        {showEmailSourceModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-sentinel-card border border-slate-700 w-full max-w-lg rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white">Add Email Source</h3>
                <p className="text-slate-400 text-xs font-mono tracking-tighter opacity-70">
                  IMAP CONNECT (UI ONLY)
                </p>
              </div>

              <form onSubmit={submitEmailSource} className="space-y-4">
                <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Context</div>
                  <div className="text-xs font-mono text-slate-300">
                    ORG: <span className="text-sentinel-accent font-bold">{orgId}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Email / Login</label>
                  <input
                    value={emailSourceForm.email}
                    onChange={(e) => setEmailSourceForm({ ...emailSourceForm, email: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm focus:outline-none focus:border-sentinel-accent"
                    placeholder="claims@tpa.co.in (or login)"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Password</label>
                  <input
                    type="password"
                    value={emailSourceForm.password}
                    onChange={(e) => setEmailSourceForm({ ...emailSourceForm, password: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm focus:outline-none focus:border-sentinel-accent"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">IMAP Host</label>
                    <input
                      value={emailSourceForm.imapHost}
                      onChange={(e) => setEmailSourceForm({ ...emailSourceForm, imapHost: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm focus:outline-none focus:border-sentinel-accent"
                      placeholder="mail.tpa.co.in"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">IMAP Port</label>
                    <input
                      inputMode="numeric"
                      value={emailSourceForm.imapPort}
                      onChange={(e) => setEmailSourceForm({ ...emailSourceForm, imapPort: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm focus:outline-none focus:border-sentinel-accent"
                      placeholder="993"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-700 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowEmailSourceModal(false)}
                    className="flex-1 py-3 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest"
                  >
                    Abort
                  </button>
                  <button
                    type="submit"
                    disabled={emailSourceSaving}
                    className="flex-1 py-3 bg-sentinel-accent text-slate-900 font-bold rounded-xl hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20 uppercase tracking-widest text-xs italic disabled:opacity-50"
                  >
                    {emailSourceSaving ? 'Saving...' : 'Save Email Source'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- WHATSAPP MODAL --- */}
        {showWhatsappModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-sentinel-card border border-slate-700 w-full max-w-lg rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-white">Add WhatsApp Source</h3>
              </div>
              <p className="text-slate-300 text-sm">Feature coming soon.</p>
              <div className="flex gap-4 pt-4 border-t border-slate-700 mt-6">
                <button
                  type="button"
                  onClick={() => setShowWhatsappModal(false)}
                  className="w-full py-3 bg-sentinel-accent text-slate-900 font-bold rounded-xl hover:bg-sky-400 transition-colors uppercase tracking-widest text-xs italic"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {pollModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-sentinel-card border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white">
                  {pollResult?.email ? `Claims poll — ${pollResult.email}` : 'Claims email poll'}
                </h3>
                <p className="text-slate-400 text-xs font-mono tracking-tighter opacity-70 mt-1">
                  POST /api/email-to-ftp/email-source/poll-claims
                </p>
              </div>

              {pollLoading && (
                <p className="text-slate-400 text-sm font-mono mb-4">Polling…</p>
              )}

              {pollError && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-rose-300 text-sm mb-4">
                  {pollError}
                </div>
              )}

              {pollResult && !pollLoading && (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                        scanned_uids
                      </div>
                      <div className="font-mono text-sentinel-accent text-lg">{pollResult.scannedUids}</div>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                        claim_matches
                      </div>
                      <div className="font-mono text-sentinel-accent text-lg">{pollResult.claimKeywordMatches}</div>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                        pdfs_ingested
                      </div>
                      <div className="font-mono text-sentinel-accent text-lg">{pollResult.pdfsIngested}</div>
                    </div>
                  </div>
                  <p className="text-xs font-mono text-slate-400">
                    UID cursor:{' '}
                    <span className="text-slate-200">{pollResult.lastProcessedUidBefore}</span>
                    {' → '}
                    <span className="text-slate-200">{pollResult.lastProcessedUidAfter}</span>
                  </p>
                  <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 text-slate-300">
                    {pollResult.message}
                  </div>
                  {Array.isArray(pollResult.ingested) && pollResult.ingested.length > 0 ? (
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
                        Ingested artifacts
                      </div>
                      <div className="border border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-800/30 text-slate-500">
                              <th className="p-3 font-medium">FILE</th>
                              <th className="p-3 font-medium">TRACE_ID</th>
                              <th className="p-3 font-medium">LANDING_PATH</th>
                              <th className="p-3 font-medium">SHA256</th>
                              <th className="p-3 font-medium w-24">ACTION</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pollResult.ingested.map((row, idx) => (
                              <tr
                                key={`${row.traceId}-${idx}`}
                                className="border-b border-slate-800/50 hover:bg-white/5 transition-colors"
                              >
                                <td className="p-3 text-slate-200">{row.attachmentFilename}</td>
                                <td className="p-3 text-slate-400" title={row.traceId}>
                                  {row.traceId.slice(0, 8)}…
                                </td>
                                <td className="p-3 text-slate-500 max-w-[180px] truncate" title={row.landingPath}>
                                  {row.landingPath}
                                </td>
                                <td className="p-3 text-slate-500 max-w-[120px] truncate font-mono text-[10px]" title={row.pdfSha256}>
                                  {row.pdfSha256 && row.pdfSha256.length > 14
                                    ? `${row.pdfSha256.slice(0, 12)}…`
                                    : row.pdfSha256}
                                </td>
                                <td className="p-3">
                                  <button
                                    type="button"
                                    onClick={() => navigator.clipboard?.writeText(row.landingPath)}
                                    className="text-[10px] font-bold uppercase text-sentinel-accent hover:underline"
                                  >
                                    Copy path
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    !pollLoading &&
                    pollResult && (
                      <p className="text-slate-500 text-xs italic">
                        No landing artifacts in the `ingested` array for this run (see counts above).
                      </p>
                    )
                  )}
                </div>
              )}

              <div className="flex gap-4 pt-4 border-t border-slate-700 mt-6">
                <button
                  type="button"
                  onClick={closePollModal}
                  className="w-full py-3 bg-sentinel-accent text-slate-900 font-bold rounded-xl hover:bg-sky-400 transition-colors uppercase tracking-widest text-xs italic"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    {/* Live Activity Feed */}
    <section className="w-full mx-auto mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                disabled={pollLoading || !canPollClaims}
                title={
                  canPollClaims
                    ? 'Run one IMAP poll for claim PDFs'
                    : 'Requires Vault key, email service id, and a known mailbox email'
                }
                onClick={runPollClaimEmails}
                className={`py-2.5 px-4 font-bold rounded-xl transition-all uppercase text-[11px] tracking-widest ${
                  canPollClaims && !pollLoading
                    ? 'bg-sentinel-accent hover:bg-sky-400 text-slate-900'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {pollLoading ? 'Polling…' : 'Poll to Fetch Emails'}
              </button>
              <button
                type="button"
                disabled={loading || !isOnboarded}
                onClick={initializeToday}
                className={`py-2.5 px-4 font-bold rounded-xl transition-all uppercase text-[11px] tracking-widest ${
                  isOnboarded
                    ? 'bg-sentinel-success hover:bg-emerald-400 text-slate-900'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isOnboarded ? "Provision Today's Folder" : "System Locked"}
              </button>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1.5 w-1.5 rounded-full bg-sentinel-accent animate-pulse" />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Real-Time Ingress Monitor
              </h3>
            </div>

            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">
              FTP server connections
            </h4>
            
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/30 text-slate-500">
                    <th className="p-4 font-medium">TIMESTAMP</th>
                    <th className="p-4 font-medium">ORG_ID</th>
                    <th className="p-4 font-medium">TARGET_BUCKET</th>
                    <th className="p-4 font-medium">HIERARCHY_STATE</th>
                  </tr>
                </thead>    
                <tbody>
                  {feed.length > 0 ? feed.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-800/50 hover:bg-white/5 transition-colors">
                      <td className="p-4 text-slate-500">{new Date(item.updatedAt).toLocaleTimeString()}</td>
                      <td className="p-4 text-sentinel-accent font-bold">{item.organisation_id}</td>
                      <td className="p-4 text-slate-300">{item.source_bucket}</td>
                      <td className="p-4">
                        {item.is_onboarded ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] flex items-center gap-1.5 w-fit">
                            <span className="h-1 w-1 bg-emerald-500 rounded-full animate-pulse" />
                            PROVISIONED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] flex items-center gap-1.5 w-fit">
                            <span className="h-1 w-1 bg-amber-500 rounded-full" />
                            LINKED_AWAITING_INIT
                          </span>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-slate-600 italic">
                        Waiting for handshake signal...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-10 mb-2">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Email Sources Connections
              </h4>
              <button
                type="button"
                onClick={bumpEmailSourcesReload}
                disabled={!canListEmailSources || emailSourcesLoading}
                className="py-2 px-3 font-bold rounded-lg transition-all uppercase text-[10px] tracking-widest border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {emailSourcesLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/30 text-slate-500">
                    <th className="p-4 font-medium">EMAIL</th>
                    <th className="p-4 font-medium">SERVICE_ID</th>
                    <th className="p-4 font-medium">ZONE_ID</th>
                    <th className="p-4 font-medium">STATUS</th>
                    <th className="p-4 font-medium">IMAP_ACTIVE</th>
                    <th className="p-4 font-medium">LAST_PROCESSED_UID</th>
                    <th className="p-4 font-medium">UPDATED_AT</th>
                  </tr>
                </thead>
                <tbody>
                  {!canListEmailSources ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-600 italic">
                        Vault API key required to list email sources.
                      </td>
                    </tr>
                  ) : emailSourcesError ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-rose-400/90 text-xs">
                        {emailSourcesError}
                      </td>
                    </tr>
                  ) : emailSourcesLoading && emailSources.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-600 italic">
                        Loading…
                      </td>
                    </tr>
                  ) : emailSources.length > 0 ? (
                    emailSources.map((row) => (
                      <tr key={`${row.serviceId}-${row.email}`} className="border-b border-slate-800/50 hover:bg-white/5 transition-colors">
                        <td className="p-4 text-sentinel-accent font-bold">{row.email}</td>
                        <td className="p-4 text-slate-400 break-all max-w-[140px]" title={row.serviceId}>
                          {row.serviceId}
                        </td>
                        <td className="p-4 text-slate-300">{row.zoneId}</td>
                        <td className="p-4">
                          {row.isActive ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] flex items-center gap-1.5 w-fit">
                              <span className="h-1 w-1 bg-emerald-500 rounded-full animate-pulse" />
                              ACTIVE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] flex items-center gap-1.5 w-fit">
                              <span className="h-1 w-1 bg-rose-400 rounded-full" />
                              INACTIVE
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {row.imap == null ? (
                            <span className="text-slate-500">—</span>
                          ) : row.imap.active ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] w-fit inline-flex items-center gap-1.5">
                              <span className="h-1 w-1 bg-emerald-500 rounded-full" />
                              TRUE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] w-fit inline-flex items-center gap-1.5">
                              <span className="h-1 w-1 bg-amber-500 rounded-full" />
                              FALSE
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-slate-300">{String(row.lastProcessedUid ?? '')}</td>
                        <td className="p-4 text-slate-500">
                          {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-600 italic">
                        No email sources registered for this organisation.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

      {/* Status Bar */}
      <footer className="w-full mx-auto mt-12">
        <div className={`p-4 rounded-xl border flex items-center gap-4 transition-all duration-500 ${
          status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' :
          status.type === 'error' ? 'bg-rose-500/10 border-rose-500/50 text-rose-400' :
          'bg-slate-800 border-slate-700 text-slate-400 shadow-inner'
        }`}>
          <div className={`h-2 w-2 rounded-full ${
            status.type === 'success' ? 'bg-emerald-400' : status.type === 'error' ? 'bg-rose-400' : 'bg-sentinel-accent animate-pulse'
          }`} />
          <span className="text-[10px] font-mono uppercase tracking-tighter opacity-50">SYS_LOG:</span>
          <span className="text-sm font-mono tracking-tight">{status.msg}</span>
        </div>
      </footer>
    </div>
  );
}

export default App;