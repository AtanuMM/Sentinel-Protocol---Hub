import { GCP_CREDENTIAL_KEYS } from '../types/ingressConfig.js';

/**
 * @param {Record<string, unknown>} raw
 * @returns {{ ok: true, credentials: import('../types/ingressConfig.js').GoogleApplicationCredentials } | { ok: false, error: string }}
 */
export function parseGoogleCredentials(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'Invalid JSON format.' };
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Credentials must be a JSON object.' };
  }

  /** @type {Record<string, string>} */
  const credentials = {};
  for (const key of GCP_CREDENTIAL_KEYS) {
    const value = /** @type {Record<string, unknown>} */ (parsed)[key];
    if (typeof value !== 'string' || !value.trim()) {
      return { ok: false, error: `Missing or invalid field: ${key}` };
    }
    credentials[key] = value;
  }

  return { ok: true, credentials: /** @type {import('../types/ingressConfig.js').GoogleApplicationCredentials} */ (credentials) };
}

/**
 * @param {import('../types/ingressConfig.js').IngressPayload} payload
 */
export function maskIngressPayloadForLog(payload) {
  const copy = structuredClone(payload);
  if ('password' in copy && copy.password) {
    copy.password = '***';
  }
  if ('google_application_credentials' in copy && copy.google_application_credentials) {
    copy.google_application_credentials = {
      ...copy.google_application_credentials,
      private_key: '***',
    };
  }
  return copy;
}

/**
 * @param {Record<string, unknown>} form
 * @returns {{ ok: true, payload: import('../types/ingressConfig.js').IngressPayload } | { ok: false, errors: Record<string, string> }}
 */
export function buildIngressPayload(form) {
  const common = {
    orgId: String(form.orgId ?? '').trim(),
    insurance_company_code: String(form.insurance_company_code ?? '').trim(),
    zone: String(form.zone ?? '').trim(),
    kmsServiceId: String(form.kmsServiceId ?? '').trim(),
  };

  /** @type {Record<string, string>} */
  const errors = {};
  for (const [key, value] of Object.entries(common)) {
    if (!value) errors[key] = 'This field is required.';
  }

  const provider = form.provider;

  if (provider === 'GCP') {
    const projectId = String(form.projectId ?? '').trim();
    const bucketName = String(form.bucketName ?? '').trim();
    const region = String(form.region ?? '').trim();
    if (!projectId) errors.projectId = 'This field is required.';
    if (!bucketName) errors.bucketName = 'This field is required.';
    if (!region) errors.region = 'This field is required.';

    let credentials = form.google_application_credentials;
    if (!credentials) {
      const parsed = parseGoogleCredentials(form.googleCredentialsJson ?? '');
      if (!parsed.ok) {
        errors.googleCredentials = parsed.error;
      } else {
        credentials = parsed.credentials;
      }
    }

    if (Object.keys(errors).length > 0) {
      return { ok: false, errors };
    }

    return {
      ok: true,
      payload: {
        ...common,
        provider: 'GCP',
        projectId,
        bucketName,
        region,
        google_application_credentials: credentials,
        ftpHost: 'storage.googleapis.com',
      },
    };
  }

  if (provider === 'S3') {
    const username = String(form.username ?? '').trim();
    const password = String(form.password ?? '');
    const bucketName = String(form.bucketName ?? '').trim();
    const region = String(form.region ?? '').trim();
    const sourcePath = String(form.sourcePath ?? '').trim();
    if (!username) errors.username = 'This field is required.';
    if (!password) errors.password = 'This field is required.';
    if (!bucketName) errors.bucketName = 'This field is required.';
    if (!region) errors.region = 'This field is required.';
    if (!sourcePath) errors.sourcePath = 'This field is required.';

    if (Object.keys(errors).length > 0) return { ok: false, errors };

    return {
      ok: true,
      payload: {
        ...common,
        username,
        password,
        bucketName,
        kmsServiceId: common.kmsServiceId,
        ftpHost: 'unused-for-s3',
        region,
        provider: 'S3',
        sourcePath,
      },
    };
  }

  if (provider === 'AZURE') {
    const username = String(form.username ?? '').trim();
    const password = String(form.password ?? '');
    const bucketName = String(form.bucketName ?? '').trim();
    const ftpHost = String(form.ftpHost ?? '').trim();
    const sourcePath = String(form.sourcePath ?? '').trim();
    if (!username) errors.username = 'This field is required.';
    if (!password) errors.password = 'This field is required.';
    if (!bucketName) errors.bucketName = 'This field is required.';
    if (!ftpHost) errors.ftpHost = 'This field is required.';
    if (!sourcePath) errors.sourcePath = 'This field is required.';

    if (Object.keys(errors).length > 0) return { ok: false, errors };

    return {
      ok: true,
      payload: {
        ...common,
        username,
        password,
        bucketName,
        kmsServiceId: common.kmsServiceId,
        ftpHost,
        provider: 'AZURE',
        sourcePath,
      },
    };
  }

  if (provider === 'FTP' || provider === 'SFTP') {
    const username = String(form.username ?? '').trim();
    const password = String(form.password ?? '');
    const ftpHost = String(form.ftpHost ?? '').trim();
    const sourcePath = String(form.sourcePath ?? '').trim();
    const portRaw = String(form.ftpPort ?? '').trim();
    const ftpPort = Number(portRaw);

    if (!username) errors.username = 'This field is required.';
    if (!password) errors.password = 'This field is required.';
    if (!ftpHost) errors.ftpHost = 'This field is required.';
    if (!sourcePath) errors.sourcePath = 'This field is required.';
    if (!portRaw || Number.isNaN(ftpPort) || ftpPort <= 0) {
      errors.ftpPort = 'Enter a valid port number.';
    }

    if (Object.keys(errors).length > 0) return { ok: false, errors };

    if (provider === 'FTP') {
      return {
        ok: true,
        payload: {
          ...common,
          username,
          password,
          ftpHost,
          ftpPort,
          secure: Boolean(form.secure),
          kmsServiceId: common.kmsServiceId,
          provider: 'FTP',
          sourcePath,
        },
      };
    }

    return {
      ok: true,
      payload: {
        ...common,
        username,
        password,
        ftpHost,
        ftpPort,
        kmsServiceId: common.kmsServiceId,
        provider: 'SFTP',
        sourcePath,
      },
    };
  }

  errors.provider = 'Select a provider.';
  return { ok: false, errors };
}

/** @returns {Record<string, unknown>} */
export function createEmptyIngressForm(provider = 'GCP') {
  return {
    provider,
    orgId: '',
    insurance_company_code: '',
    zone: '',
    kmsServiceId: '',
    projectId: '',
    bucketName: '',
    region: '',
    googleCredentialsJson: '',
    google_application_credentials: null,
    username: '',
    password: '',
    sourcePath: '',
    ftpHost: '',
    ftpPort: provider === 'SFTP' ? '22' : '21',
    secure: false,
  };
}

/**
 * @param {import('../types/ingressConfig.js').IngressPayload} payload
 */
export function onSubmitIngressConfig(payload) {
  const masked = maskIngressPayloadForLog(payload);
  // TODO: POST payload to ingress config API — never log raw secrets
  console.log('[IngressSetup] Submit config', masked);
}
