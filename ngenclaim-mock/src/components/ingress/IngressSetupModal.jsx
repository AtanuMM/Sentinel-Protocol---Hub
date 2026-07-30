import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { INGRESS_PROVIDERS } from '../../types/ingressConfig.js';
import {
  buildIngressPayload,
  createEmptyIngressForm,
  onSubmitIngressConfig,
} from '../../utils/ingressPayload.js';
import {
  NgIngressField,
  NgIngressPasswordField,
  NgIngressTextArea,
} from '../ui/NgIngressField.jsx';

/**
 * @param {{ open: boolean, onClose: () => void, onSuccess?: () => void }} props
 */
export default function IngressSetupModal({ open, onClose, onSuccess }) {
  const titleId = useId();
  const dialogRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [form, setForm] = useState(() => createEmptyIngressForm());
  /** @type {[Record<string, string>, React.Dispatch<React.SetStateAction<Record<string, string>>>]} */
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    dialogRef.current?.focus();

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  /** @param {string} field @param {unknown} value */
  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  /** @param {typeof INGRESS_PROVIDERS[number]} provider */
  const handleProviderChange = (provider) => {
    setForm(createEmptyIngressForm(provider));
    setErrors({});
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const result = buildIngressPayload(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    // TODO: wire to real ingress config API
    onSubmitIngressConfig(result.payload);
    onSuccess?.();
    onClose();
  };

  const provider = form.provider;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative bg-[#0B1224] border border-white/10 w-full max-w-xl max-h-[90vh] rounded-xl shadow-xl flex flex-col outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-white/5 shrink-0">
          <div>
            <h2 id={titleId} className="text-xl font-bold text-white tracking-tight">
              Ingress Setup
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Configure external storage or transfer credentials for claims ingestion.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-sm text-gray-400">Provider</legend>
            <div className="flex flex-wrap gap-2">
              {INGRESS_PROVIDERS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleProviderChange(option)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    provider === option
                      ? 'bg-[var(--color-ng-primary)]/15 border-[var(--color-ng-primary)]/40 text-[var(--color-ng-primary)]'
                      : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            {errors.provider && <p className="text-xs text-red-400">{errors.provider}</p>}
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <NgIngressField
              label="Org ID"
              id="ingress-org-id"
              value={String(form.orgId ?? '')}
              onChange={(e) => setField('orgId', e.target.value)}
              placeholder="NI-001"
              error={errors.orgId}
            />
            <NgIngressField
              label="Insurance company code"
              id="ingress-insurance-code"
              value={String(form.insurance_company_code ?? '')}
              onChange={(e) => setField('insurance_company_code', e.target.value)}
              placeholder="NI-Z001"
              error={errors.insurance_company_code}
            />
            <NgIngressField
              label="Zone"
              id="ingress-zone"
              value={String(form.zone ?? '')}
              onChange={(e) => setField('zone', e.target.value)}
              placeholder="ap-south-1"
              error={errors.zone}
            />
            <NgIngressField
              label="KMS service ID"
              id="ingress-kms-id"
              value={String(form.kmsServiceId ?? '')}
              onChange={(e) => setField('kmsServiceId', e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              error={errors.kmsServiceId}
            />
          </div>

          {provider === 'GCP' && (
            <div className="space-y-4 pt-1 border-t border-white/5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NgIngressField
                  label="Project ID"
                  id="ingress-gcp-project"
                  value={String(form.projectId ?? '')}
                  onChange={(e) => setField('projectId', e.target.value)}
                  error={errors.projectId}
                />
                <NgIngressField
                  label="Bucket name"
                  id="ingress-gcp-bucket"
                  value={String(form.bucketName ?? '')}
                  onChange={(e) => setField('bucketName', e.target.value)}
                  error={errors.bucketName}
                />
                <NgIngressField
                  label="Region"
                  id="ingress-gcp-region"
                  value={String(form.region ?? '')}
                  onChange={(e) => setField('region', e.target.value)}
                  placeholder="asia-south1"
                  error={errors.region}
                />
                <NgIngressField
                  label="FTP host"
                  id="ingress-gcp-host"
                  value="storage.googleapis.com"
                  disabled
                  hint="Auto-filled for GCP"
                />
              </div>

              <NgIngressTextArea
                label="Google application credentials"
                id="ingress-gcp-json"
                value={String(form.googleCredentialsJson ?? '')}
                onChange={(e) => {
                  setField('googleCredentialsJson', e.target.value);
                  setField('google_application_credentials', null);
                }}
                placeholder='Paste service account JSON here, e.g. {"type":"service_account","project_id":"..."}'
                error={errors.googleCredentials}
                rows={8}
              />
            </div>
          )}

          {provider === 'S3' && (
            <div className="space-y-4 pt-1 border-t border-white/5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NgIngressPasswordField
                  label="Access key ID"
                  id="ingress-s3-username"
                  value={String(form.username ?? '')}
                  onChange={(e) => setField('username', e.target.value)}
                  error={errors.username}
                />
                <NgIngressPasswordField
                  label="Secret access key"
                  id="ingress-s3-password"
                  value={String(form.password ?? '')}
                  onChange={(e) => setField('password', e.target.value)}
                  error={errors.password}
                />
                <NgIngressField
                  label="Bucket name"
                  id="ingress-s3-bucket"
                  value={String(form.bucketName ?? '')}
                  onChange={(e) => setField('bucketName', e.target.value)}
                  error={errors.bucketName}
                />
                <NgIngressField
                  label="Region"
                  id="ingress-s3-region"
                  value={String(form.region ?? '')}
                  onChange={(e) => setField('region', e.target.value)}
                  placeholder="ap-south-1"
                  error={errors.region}
                />
                <NgIngressField
                  label="Source path"
                  id="ingress-s3-path"
                  value={String(form.sourcePath ?? '')}
                  onChange={(e) => setField('sourcePath', e.target.value)}
                  placeholder="NI-001/NI-Z001/claims/"
                  error={errors.sourcePath}
                />
              </div>
            </div>
          )}

          {provider === 'AZURE' && (
            <div className="space-y-4 pt-1 border-t border-white/5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NgIngressField
                  label="Storage account name"
                  id="ingress-azure-username"
                  value={String(form.username ?? '')}
                  onChange={(e) => setField('username', e.target.value)}
                  error={errors.username}
                />
                <NgIngressPasswordField
                  label="Account key"
                  id="ingress-azure-password"
                  value={String(form.password ?? '')}
                  onChange={(e) => setField('password', e.target.value)}
                  error={errors.password}
                />
                <NgIngressField
                  label="Container name"
                  id="ingress-azure-bucket"
                  value={String(form.bucketName ?? '')}
                  onChange={(e) => setField('bucketName', e.target.value)}
                  error={errors.bucketName}
                />
                <NgIngressField
                  label="Blob endpoint"
                  id="ingress-azure-host"
                  value={String(form.ftpHost ?? '')}
                  onChange={(e) => setField('ftpHost', e.target.value)}
                  placeholder="accountname.blob.core.windows.net"
                  error={errors.ftpHost}
                />
                <NgIngressField
                  label="Source path"
                  id="ingress-azure-path"
                  value={String(form.sourcePath ?? '')}
                  onChange={(e) => setField('sourcePath', e.target.value)}
                  error={errors.sourcePath}
                />
              </div>
            </div>
          )}

          {provider === 'FTP' && (
            <div className="space-y-4 pt-1 border-t border-white/5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NgIngressField
                  label="Username"
                  id="ingress-ftp-username"
                  value={String(form.username ?? '')}
                  onChange={(e) => setField('username', e.target.value)}
                  error={errors.username}
                />
                <NgIngressPasswordField
                  label="Password"
                  id="ingress-ftp-password"
                  value={String(form.password ?? '')}
                  onChange={(e) => setField('password', e.target.value)}
                  error={errors.password}
                />
                <NgIngressField
                  label="FTP host"
                  id="ingress-ftp-host"
                  value={String(form.ftpHost ?? '')}
                  onChange={(e) => setField('ftpHost', e.target.value)}
                  placeholder="192.168.1.10"
                  error={errors.ftpHost}
                />
                <NgIngressField
                  label="FTP port"
                  id="ingress-ftp-port"
                  type="number"
                  value={String(form.ftpPort ?? '')}
                  onChange={(e) => setField('ftpPort', e.target.value)}
                  placeholder="21"
                  error={errors.ftpPort}
                />
                <NgIngressField
                  label="Source path"
                  id="ingress-ftp-path"
                  value={String(form.sourcePath ?? '')}
                  onChange={(e) => setField('sourcePath', e.target.value)}
                  error={errors.sourcePath}
                />
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(form.secure)}
                      onChange={(e) => setField('secure', e.target.checked)}
                      className="rounded border-white/20 bg-[#0F172A] text-[var(--color-ng-primary)] focus:ring-[var(--color-ng-primary)]/30"
                    />
                    Secure (FTPS)
                  </label>
                </div>
              </div>
            </div>
          )}

          {provider === 'SFTP' && (
            <div className="space-y-4 pt-1 border-t border-white/5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NgIngressField
                  label="Username"
                  id="ingress-sftp-username"
                  value={String(form.username ?? '')}
                  onChange={(e) => setField('username', e.target.value)}
                  error={errors.username}
                />
                <NgIngressPasswordField
                  label="Password"
                  id="ingress-sftp-password"
                  value={String(form.password ?? '')}
                  onChange={(e) => setField('password', e.target.value)}
                  error={errors.password}
                />
                <NgIngressField
                  label="FTP host"
                  id="ingress-sftp-host"
                  value={String(form.ftpHost ?? '')}
                  onChange={(e) => setField('ftpHost', e.target.value)}
                  placeholder="sftp.example.com"
                  error={errors.ftpHost}
                />
                <NgIngressField
                  label="FTP port"
                  id="ingress-sftp-port"
                  type="number"
                  value={String(form.ftpPort ?? '')}
                  onChange={(e) => setField('ftpPort', e.target.value)}
                  placeholder="22"
                  error={errors.ftpPort}
                />
                <NgIngressField
                  label="Source path"
                  id="ingress-sftp-path"
                  value={String(form.sourcePath ?? '')}
                  onChange={(e) => setField('sourcePath', e.target.value)}
                  error={errors.sourcePath}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 border border-white/10 hover:bg-white/5 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[var(--color-ng-primary)] text-[#050810] hover:shadow-[0_0_15px_rgba(0,209,255,0.25)] transition-all"
            >
              Save &amp; Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
