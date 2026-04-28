import React, { useState } from 'react';

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
    typeof window !== 'undefined' && Boolean(sessionStorage.getItem('sentinel.apiKey'))
  );
  const [vaultReveal, setVaultReveal] = useState(null);

  // Email (IMAP) UI-only State
  const [showEmailVaultSetupModal, setShowEmailVaultSetupModal] = useState(false);
  const [emailVaultReady, setEmailVaultReady] = useState(
    typeof window !== 'undefined' && Boolean(sessionStorage.getItem('sentinel.emailVaultReady'))
  );
  const [showEmailSourceModal, setShowEmailSourceModal] = useState(false);
  const [emailSourceSaving, setEmailSourceSaving] = useState(false);
  const [emailSourceForm, setEmailSourceForm] = useState(() => {
    if (typeof window === 'undefined') {
      return { email: '', password: '', imapHost: '', imapPort: 993 };
    }
    try {
      const raw = sessionStorage.getItem('sentinel.lastEmailSource');
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

  // --- API: PING TEST ---
  const checkServerLink = async () => {
    setServerStatus('checking');
    try {
      const res = await fetch('http://localhost:3000/api/ping');
      const data = await res.json();
      if (data.status === 'online') {
        setServerStatus('online');
        setStatus({ msg: 'Server Link Established: System Ready', type: 'success' });
      }
    } catch (err) {
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

      sessionStorage.setItem('sentinel.apiKey', data.apiKey);
      sessionStorage.setItem('sentinel.userId', data.userId);

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
      const res = await fetch(`http://localhost:3000/api/link-bucket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, zone, ...formData })
      });
      const data = await res.json();
      setStatus({ 
        msg: data.message || `Integration Active: ${formData.username} linked.`, 
        type: 'success' 
      });
    } catch (err) {
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

  // Function Wrappers
  const onboardOrg = () => triggerAction('onboard-org', 'Initializing Org Hierarchy...');
  const initializeToday = () => triggerAction('init-today', 'Provisioning Date-Partition...');

  const triggerAction = async (endpoint, startMsg) => {
    setLoading(true);
    setStatus({ msg: startMsg, type: 'info' });
    try {
      const res = await fetch(`http://localhost:3000/api/${endpoint}`, {
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

  React.useEffect(() => {
    // 1. Create an AbortController to cancel pending requests if the component unmounts
    const controller = new AbortController();
    
    const fetchFeed = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/live-feed', { 
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

  const confirmEmailVaultSetup = () => {
    // UI-only: mark a one-time setup flag for this POC user.
    sessionStorage.setItem('sentinel.emailVaultReady', 'true');
    setEmailVaultReady(true);
    setShowEmailVaultSetupModal(false);
    setStatus({ msg: 'Email Vault Service ready (UI only).', type: 'success' });
  };

  const openEmailSourceFlow = () => {
    if (!emailVaultReady) {
      setShowEmailVaultSetupModal(true);
      setStatus({ msg: 'Email Vault setup required (one-time).', type: 'info' });
      return;
    }
    setShowEmailSourceModal(true);
  };

  const submitEmailSourceUiOnly = async (e) => {
    e.preventDefault();
    setEmailSourceSaving(true);
    setStatus({ msg: 'Saving Email Source (UI only)...', type: 'info' });
    try {
      if (!emailSourceForm.email?.trim() || !emailSourceForm.password?.trim() || !emailSourceForm.imapHost?.trim()) {
        throw new Error('Missing required fields: email/login, password, and IMAP host.');
      }

      const persisted = {
        orgId,
        email: emailSourceForm.email.trim(),
        imapHost: emailSourceForm.imapHost.trim(),
        imapPort: Number(emailSourceForm.imapPort) || 993,
      };
      sessionStorage.setItem('sentinel.lastEmailSource', JSON.stringify(persisted));

      setShowEmailSourceModal(false);
      setStatus({ msg: 'Email source saved (UI only). API integration coming next.', type: 'success' });
    } catch (err) {
      setStatus({ msg: `Email Setup Error: ${err.message}`, type: 'error' });
    } finally {
      setEmailSourceSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-8 lg:p-16 bg-sentinel-dark text-slate-200 font-sans">
      
      {/* Header Section */}
      <header className="max-w-6xl mx-auto mb-12 flex justify-between items-end border-b border-slate-700 pb-6">
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
            onClick={() => setShowVaultForm(true)}
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

      <main className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-8 relative">
        
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
              emailVaultReady
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}>
              {emailVaultReady ? 'VAULT_READY' : 'VAULT_REQUIRED'}
            </span>
          </div>

          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Onboard a monitored inbox. Credentials are secured in Vault and used to test IMAP connectivity (API wiring next).
          </p>

          <div className="space-y-3">
            <button
              disabled={emailVaultReady}
              onClick={() => setShowEmailVaultSetupModal(true)}
              className={`w-full py-3 px-4 font-bold rounded-xl transition-colors uppercase text-[11px] tracking-widest ${
                emailVaultReady
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
              }`}
            >
              {emailVaultReady ? 'Email Vault Service Ready' : 'Setup Email Vault Service'}
            </button>

            <button
              disabled={emailSourceSaving}
              onClick={openEmailSourceFlow}
              className={`w-full py-3 px-4 bg-sentinel-accent hover:bg-sky-400 text-slate-900 font-bold rounded-xl transition-colors disabled:opacity-50 ${
                emailSourceSaving ? 'cursor-wait' : ''
              }`}
            >
              {emailSourceSaving ? 'Opening...' : 'Add Email Source'}
            </button>
          </div>
        </div>

        {/* Card 2: Daily Operations */}
        <div className={`bg-sentinel-card border p-8 rounded-2xl shadow-xl transition-all text-left ${
          isOnboarded ? 'border-sentinel-success hover:border-emerald-400' : 'border-slate-700 opacity-70'
        }`}>
          <div className={`h-12 w-12 rounded-lg flex items-center justify-center mb-6 border ${
            isOnboarded ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-500/10 border-slate-500/20'
          }`}>
            <svg className={`w-6 h-6 ${isOnboarded ? 'text-sentinel-success' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-white mb-2 font-sans">Daily Operations</h2>
          
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            {isOnboarded 
              ? `Provision the partition for ${new Date().toISOString().split('T')[0]} to enable flow.`
              : `Awaiting External Ingress Configuration. Please link the bucket first.`}
          </p>

          <button 
            disabled={loading || !isOnboarded}
            onClick={initializeToday}
            className={`w-full py-3 px-4 font-bold rounded-xl transition-all uppercase text-[11px] tracking-widest ${
              isOnboarded 
                ? 'bg-sentinel-success hover:bg-emerald-400 text-slate-900' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}>
            {isOnboarded ? "Provision Today's Folder" : "System Locked"}
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
                <h3 className="text-2xl font-bold text-white">Vault API Key</h3>
                <p className="text-slate-400 text-xs font-mono tracking-tighter opacity-70">PROVISION: /api/v1/auth/provision</p>
              </div>

              {!vaultReveal ? (
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

                  <div className="flex gap-4 pt-4 border-t border-slate-700 mt-6">
                    <button type="button" onClick={() => setShowVaultForm(false)} className="flex-1 py-3 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">
                      Abort
                    </button>
                    <button type="submit" disabled={vaultLoading} className="flex-1 py-3 bg-sentinel-accent text-slate-900 font-bold rounded-xl hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20 uppercase tracking-widest text-xs italic disabled:opacity-50">
                      {vaultLoading ? 'Provisioning...' : 'Generate Vault Key'}
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
                      onClick={() => { setShowVaultForm(false); setVaultReveal(null); }}
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

        {/* --- EMAIL VAULT SETUP MODAL (UI ONLY) --- */}
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
                    <li>Marks Vault as ready for securing IMAP credentials (UI-only today).</li>
                    <li>Persists a local flag in this browser session.</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-slate-700 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEmailVaultSetupModal(false)}
                  className="flex-1 py-3 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest"
                >
                  Abort
                </button>
                <button
                  type="button"
                  onClick={confirmEmailVaultSetup}
                  className="flex-1 py-3 bg-sentinel-accent text-slate-900 font-bold rounded-xl hover:bg-sky-400 transition-colors shadow-lg shadow-sky-500/20 uppercase tracking-widest text-xs italic"
                >
                  Confirm Setup
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

              <form onSubmit={submitEmailSourceUiOnly} className="space-y-4">
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
      </main>
    {/* Live Activity Feed */}
    <section className="max-w-6xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1.5 w-1.5 rounded-full bg-sentinel-accent animate-pulse" />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Real-Time Ingress Monitor
              </h3>
            </div>
            
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
          </section>

      {/* Status Bar */}
      <footer className="max-w-6xl mx-auto mt-12">
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