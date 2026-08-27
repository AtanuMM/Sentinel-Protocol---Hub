import React, { useState } from 'react';
import {
  Link2,
  Key,
  FolderUp,
  Mail,
  MessageCircle,
} from 'lucide-react';
import IngressMonitorTable from '../components/ui/IngressMonitorTable';
import NgModal from '../components/ui/NgModal';
import NgFormField from '../components/ui/NgFormField';
import NgChannelCard from '../components/ui/NgChannelCard';
import NgToast from '../components/ui/NgToast';
import IngressSetupModal from '../components/ingress/IngressSetupModal';
import { useFTPConnections, useEmailSourceConnections } from '../hooks/useIngressConnections';
import { loadFacebookSdk } from '../utils/facebookSdk.js';

const ORG_LABEL = 'ORG: NI-001';
/** @type {string} Org ID derived from ORG_LABEL display value */
const ORG_ID = ORG_LABEL.replace(/^ORG:\s*/, '');
/** PLACEHOLDER — replace with real KMS/vault serviceId before connecting a live client */
const WHATSAPP_KMS_SERVICE_ID = '00000000-0000-0000-0000-000000000000';
/** PLACEHOLDER — replace with the organisation's deployment zone before production */
const WHATSAPP_ZONE_ID = 'eu-central-1';

/** @typedef {'idle' | 'connecting' | 'finalizing' | 'success' | 'error'} WhatsappFlowState */

const WHATSAPP_ACTION_BTN =
  'w-full py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all';
const VAULT_PROVISION_PATH = '/api/v1/auth/provision';
const EMPTY_VAULT_FORM = { keycloakId: '', email: '' };

const VAULT_ACTION_BTN =
  'w-full py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all';

const FTP_COLUMNS = [
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'orgId', label: 'Org ID' },
  { key: 'targetBucket', label: 'Target Bucket' },
  { key: 'hierarchyState', label: 'Hierarchy State' },
];

const EMAIL_COLUMNS = [
  { key: 'email', label: 'Email' },
  { key: 'serviceId', label: 'Service ID' },
  { key: 'zoneId', label: 'Zone ID' },
  { key: 'status', label: 'Status' },
  { key: 'imapActive', label: 'IMAP Active' },
  { key: 'lastProcessedUid', label: 'Last Processed UID' },
  { key: 'updatedAt', label: 'Updated At' },
];

export default function AddChannels() {
  const [ingressModalOpen, setIngressModalOpen] = useState(false);
  const [ingressModalKey, setIngressModalKey] = useState(0);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  /** @type {[WhatsappFlowState, React.Dispatch<React.SetStateAction<WhatsappFlowState>>]} */
  const [whatsappFlowState, setWhatsappFlowState] = useState('idle');
  const [whatsappError, setWhatsappError] = useState('');
  /** @type {[import('../types/whatsappChannel.js').ConnectWhatsappChannelData | null, React.Dispatch<React.SetStateAction<import('../types/whatsappChannel.js').ConnectWhatsappChannelData | null>>]} */
  const [whatsappSuccess, setWhatsappSuccess] = useState(null);
  const [vaultModalOpen, setVaultModalOpen] = useState(false);
  const [vaultForm, setVaultForm] = useState(EMPTY_VAULT_FORM);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const { connections: ftpConnections } = useFTPConnections();
  const { connections: emailConnections, refresh: refreshEmailSources } =
    useEmailSourceConnections();

  const onCheckLink = () => {
    // TODO: wire to link health-check API
    console.log('[AddChannels] Check Link');
  };

  const onGenerateVaultKey = () => {
    setVaultForm(EMPTY_VAULT_FORM);
    setVaultModalOpen(true);
  };

  const onVaultAbort = () => {
    setVaultModalOpen(false);
  };

  const onVaultSubmit = () => {
    // TODO: POST /api/v1/auth/provision with keycloakId + email
    console.log('[AddChannels] Generate Vault Key', vaultForm);
    setVaultModalOpen(false);
  };

  const onAddExistingApiKey = () => {
    // TODO: wire to existing API key import flow
    console.log('[AddChannels] Add Existing API Key — TODO');
  };

  const onConnectFTP = () => {
    setIngressModalKey((key) => key + 1);
    setIngressModalOpen(true);
  };

  const handleIngressSuccess = () => {
    setToastMessage('Ingress configuration saved successfully.');
    setToastVisible(true);
  };

  const onSetupEmailVault = () => {
    // TODO: wire to email vault service setup API
    console.log('[AddChannels] Setup Email Vault Service');
  };

  const resetWhatsappModal = () => {
    setWhatsappFlowState('idle');
    setWhatsappError('');
    setWhatsappSuccess(null);
  };

  const onCloseWhatsappModal = () => {
    setWhatsappModalOpen(false);
    resetWhatsappModal();
  };

  const onAddWhatsApp = () => {
    resetWhatsappModal();
    setWhatsappModalOpen(true);
  };

  const handleConnectWhatsApp = async () => {
    const appId = import.meta.env.VITE_META_APP_ID?.trim();
    const configId = import.meta.env.VITE_META_LOGIN_CONFIG_ID?.trim();
    const vaultToken = import.meta.env.VITE_VAULT_TOKEN?.trim();
    const ingestionBase = (
      import.meta.env.VITE_WHATSAPP_INGESTION_URL ?? 'http://localhost:3002'
    ).replace(/\/$/, '');

    if (!appId || !configId) {
      setWhatsappFlowState('error');
      setWhatsappError('Meta App ID and Login Configuration ID must be set in environment variables.');
      return;
    }

    if (!vaultToken) {
      setWhatsappFlowState('error');
      setWhatsappError('VITE_VAULT_TOKEN is not configured.');
      return;
    }

    setWhatsappFlowState('connecting');
    setWhatsappError('');

    try {
      const FB = await loadFacebookSdk(appId);

      const authorizationCode = await new Promise((resolve) => {
        // Requires this domain (localhost:5173 for dev) to be allowlisted in Meta App Settings >
        // Facebook Login for Business > Settings > Allowed Domains for the JS SDK. Also requires
        // HTTPS in production — Meta permits localhost as an exception for local dev.
        FB.login(
          (response) => {
            resolve(response.authResponse?.code ?? null);
          },
          {
            config_id: configId,
            response_type: 'code',
            override_default_response_type: true,
            extras: {
              setup: {},
              featureType: '',
              sessionInfoVersion: '3',
            },
          },
        );
      });

      if (!authorizationCode) {
        setWhatsappFlowState('error');
        setWhatsappError('Signup was cancelled or did not complete.');
        return;
      }

      setWhatsappFlowState('finalizing');

      /** @type {import('../types/whatsappChannel.js').ConnectWhatsappChannelRequest} */
      const payload = {
        orgId: ORG_ID,
        serviceId: WHATSAPP_KMS_SERVICE_ID,
        zoneId: WHATSAPP_ZONE_ID,
        authorizationCode,
      };

      const res = await fetch(`${ingestionBase}/api/v1/whatsapp-to-ftp/whatsapp-channel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-vault-token': vaultToken,
        },
        body: JSON.stringify(payload),
      });

      /** @type {import('../types/whatsappChannel.js').ConnectWhatsappChannelResponse | import('../types/whatsappChannel.js').ConnectWhatsappChannelErrorResponse} */
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok || !data.success) {
        const message =
          data.message ||
          data.error ||
          data.detail ||
          `Failed to connect WhatsApp channel (${res.status}).`;
        setWhatsappFlowState('error');
        setWhatsappError(typeof message === 'string' ? message : 'Failed to connect WhatsApp channel.');
        return;
      }

      setWhatsappSuccess(data.data ?? null);
      setWhatsappFlowState('success');
    } catch (err) {
      setWhatsappFlowState('error');
      setWhatsappError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  const onRefreshEmailSources = () => {
    // TODO: wire to email sources list API (requires vault key)
    console.log('[AddChannels] Refresh email sources');
    refreshEmailSources();
  };

  const onPollEmails = () => {
    // TODO: wire to email poll trigger API
    console.log('[AddChannels] Poll to Fetch Emails');
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-4xl font-black text-white tracking-tight">Add Channels</h1>
            <span className="w-2 h-2 rounded-full bg-[var(--color-ng-primary)] shadow-[0_0_8px_var(--color-ng-primary)]" />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Configure ingestion sources for claims data
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onCheckLink}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-gray-300 uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"
          >
            <Link2 size={14} />
            Check Link
          </button>
          <button
            type="button"
            onClick={onGenerateVaultKey}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-gray-300 uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"
          >
            <Key size={14} />
            Generate Vault Key
          </button>
          <span className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-gray-500 uppercase tracking-widest">
            {ORG_LABEL}
          </span>
        </div>
      </div>

      {/* Channel cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <NgChannelCard
          icon={<FolderUp size={22} className="text-[var(--color-ng-secondary)]" strokeWidth={2} />}
          iconBgClass="bg-[var(--color-ng-secondary)]/15"
          title="Connect FTP server"
          description="Configure ingress sources for claims data."
          primaryLabel="Configure External Ingress"
          onPrimaryClick={onConnectFTP}
          primaryVariant="cyan"
        />
        <NgChannelCard
          icon={<Mail size={22} className="text-purple-400" strokeWidth={2} />}
          iconBgClass="bg-purple-500/15"
          title="Add Email (IMAP)"
          badge="Vault required"
          highlighted
          description="Secure IMAP ingestion via vault-backed credentials."
          primaryLabel="Setup Email Vault Service"
          onPrimaryClick={onSetupEmailVault}
          primaryVariant="blue"
          secondaryLabel="Add Email source"
          onSecondaryClick={() => console.log('[AddChannels] Add Email source — TODO')}
          secondaryDisabled
        />
        <NgChannelCard
          icon={<MessageCircle size={22} className="text-emerald-400" strokeWidth={2} />}
          iconBgClass="bg-emerald-500/15"
          title="Add WhatsApp"
          description="Connect messaging channel for claim submissions."
          primaryLabel="Add WhatsApp Source"
          onPrimaryClick={onAddWhatsApp}
          primaryVariant="blue"
        />
      </div>

      {/* Ingress monitor section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
            Real-Time Ingress Monitor
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ng-primary)]" />
        </div>

        <div className="space-y-6">
          <IngressMonitorTable
            title="FTP Server Connections"
            columns={FTP_COLUMNS}
            data={ftpConnections}
            emptyMessage="Waiting for handshake signal..."
          />
          <IngressMonitorTable
            title="Email Sources Connections"
            columns={EMAIL_COLUMNS}
            data={emailConnections}
            emptyMessage="Vault API key required to list email sources."
            onRefresh={onRefreshEmailSources}
          />
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-4 px-5 bg-[#0B1224]/60 border border-white/5 rounded-2xl">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gray-500" />
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            System Standby
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onPollEmails}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"
          >
            Poll to Fetch Emails
          </button>
          <button
            type="button"
            disabled
            className="px-4 py-2 bg-white/[0.02] border border-white/5 rounded-full text-[10px] font-black text-gray-600 uppercase tracking-widest cursor-not-allowed opacity-60"
          >
            System Locked
          </button>
        </div>
      </div>

      <NgModal
        open={vaultModalOpen}
        onClose={onVaultAbort}
        title="Vault API Key"
        subtitle={`PROVISION: ${VAULT_PROVISION_PATH}`}
        subtitleMono
        centered
        bodyAlign="left"
        maxWidth="max-w-md"
        footer={
          <div className="border-t border-white/5 px-10 py-8 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onVaultAbort}
                className={`${VAULT_ACTION_BTN} bg-[var(--color-ng-error)] text-[#050810] hover:shadow-[0_0_20px_rgba(239,68,68,0.35)]`}
              >
                Abort
              </button>
              <button
                type="button"
                onClick={onVaultSubmit}
                className={`${VAULT_ACTION_BTN} bg-[var(--color-ng-primary)] text-[#050810] hover:shadow-[0_0_20px_rgba(0,209,255,0.35)]`}
              >
                Generate Vault Key
              </button>
            </div>
            <button
              type="button"
              onClick={onAddExistingApiKey}
              className="w-full py-3.5 rounded-xl border border-[var(--color-ng-primary)]/30 text-[var(--color-ng-primary)] text-[10px] font-black uppercase tracking-widest hover:bg-[var(--color-ng-primary)]/5 transition-all"
            >
              Add Existing API Key
            </button>
          </div>
        }
      >
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 space-y-6">
          <NgFormField
            label="Keycloak ID"
            id="vault-keycloak-id"
            value={vaultForm.keycloakId}
            onChange={(e) => setVaultForm((prev) => ({ ...prev, keycloakId: e.target.value }))}
            placeholder="admin"
          />
          <NgFormField
            label="Email"
            id="vault-email"
            type="email"
            value={vaultForm.email}
            onChange={(e) => setVaultForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="admin@ngenclaim.ai"
          />
        </div>
      </NgModal>

      <IngressSetupModal
        key={ingressModalKey}
        open={ingressModalOpen}
        onClose={() => setIngressModalOpen(false)}
        onSuccess={handleIngressSuccess}
      />

      <NgToast
        message={toastMessage}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />

      <NgModal
        open={whatsappModalOpen}
        onClose={onCloseWhatsappModal}
        title="Add WhatsApp Source"
        subtitle={
          whatsappFlowState === 'success'
            ? 'Channel connected'
            : 'Meta WhatsApp Embedded Signup'
        }
        bodyAlign="left"
        centered={false}
        showCloseIcon
        maxWidth="max-w-lg"
        footer={
          whatsappFlowState === 'success' ? (
            <div className="border-t border-white/5 px-10 py-8">
              <button
                type="button"
                onClick={onCloseWhatsappModal}
                className={`${WHATSAPP_ACTION_BTN} bg-[var(--color-ng-primary)] text-[#050810] hover:shadow-[0_0_20px_rgba(0,209,255,0.4)]`}
              >
                Done
              </button>
            </div>
          ) : whatsappFlowState === 'error' ? (
            <div className="border-t border-white/5 px-10 py-8 space-y-3">
              <button
                type="button"
                onClick={handleConnectWhatsApp}
                className={`${WHATSAPP_ACTION_BTN} bg-[var(--color-ng-primary)] text-[#050810] hover:shadow-[0_0_20px_rgba(0,209,255,0.4)]`}
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={onCloseWhatsappModal}
                className={`${WHATSAPP_ACTION_BTN} bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10`}
              >
                Close
              </button>
            </div>
          ) : whatsappFlowState === 'idle' ? (
            <div className="border-t border-white/5 px-10 py-8 space-y-3">
              <button
                type="button"
                onClick={handleConnectWhatsApp}
                className={`${WHATSAPP_ACTION_BTN} bg-[#1877F2] text-white hover:shadow-[0_0_20px_rgba(24,119,242,0.35)]`}
              >
                Connect with Facebook
              </button>
              <button
                type="button"
                onClick={onCloseWhatsappModal}
                className={`${WHATSAPP_ACTION_BTN} bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10`}
              >
                Cancel
              </button>
            </div>
          ) : null
        }
      >
        {whatsappFlowState === 'idle' && (
          <div className="space-y-4">
            <p>
              Connect your WhatsApp Business Account through Meta&apos;s secure signup flow.
              A Facebook login popup will open — complete onboarding there, then this app
              will finalize the channel on the backend.
            </p>
            <p className="text-xs text-gray-500">
              Organisation: <span className="font-mono text-gray-400">{ORG_ID}</span>
            </p>
          </div>
        )}

        {whatsappFlowState === 'connecting' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-8 h-8 border-2 border-[var(--color-ng-primary)]/30 border-t-[var(--color-ng-primary)] rounded-full animate-spin" />
            <p className="text-white font-medium">Connecting to Meta...</p>
            <p className="text-xs text-gray-500">Complete signup in the Facebook popup window.</p>
          </div>
        )}

        {whatsappFlowState === 'finalizing' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-8 h-8 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
            <p className="text-white font-medium">Finalizing setup...</p>
            <p className="text-xs text-gray-500">Registering your WhatsApp channel with Sentinel.</p>
          </div>
        )}

        {whatsappFlowState === 'success' && whatsappSuccess && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300 text-sm">
              WhatsApp channel connected successfully.
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-[10px] font-black uppercase tracking-widest text-gray-500">Phone Number</dt>
                <dd className="font-mono text-white mt-1">{whatsappSuccess.phoneNumber}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-black uppercase tracking-widest text-gray-500">WABA ID</dt>
                <dd className="font-mono text-white mt-1">{whatsappSuccess.wabaId}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-black uppercase tracking-widest text-gray-500">Organisation</dt>
                <dd className="font-mono text-white mt-1">{whatsappSuccess.orgId}</dd>
              </div>
            </dl>
          </div>
        )}

        {whatsappFlowState === 'error' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
              {whatsappError || 'Something went wrong. Please try again.'}
            </div>
            {whatsappError === 'Signup was cancelled or did not complete.' && (
              <p className="text-xs text-gray-500">
                No changes were made. You can retry when ready.
              </p>
            )}
          </div>
        )}
      </NgModal>
    </div>
  );
}
