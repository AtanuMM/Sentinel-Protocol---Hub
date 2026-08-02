/** @typedef {'GCP' | 'S3' | 'AZURE' | 'FTP' | 'SFTP'} IngressProvider */

/**
 * @typedef {Object} GoogleApplicationCredentials
 * @property {string} type
 * @property {string} project_id
 * @property {string} private_key_id
 * @property {string} private_key
 * @property {string} client_email
 * @property {string} client_id
 * @property {string} auth_uri
 * @property {string} token_uri
 * @property {string} auth_provider_x509_cert_url
 * @property {string} client_x509_cert_url
 * @property {string} universe_domain
 */

/**
 * @typedef {Object} GcpIngressPayload
 * @property {string} orgId
 * @property {string} insurance_company_code
 * @property {string} zone
 * @property {string} kmsServiceId
 * @property {'GCP'} provider
 * @property {string} projectId
 * @property {string} bucketName
 * @property {string} region
 * @property {GoogleApplicationCredentials} google_application_credentials
 * @property {'storage.googleapis.com'} ftpHost
 */

/**
 * @typedef {Object} S3IngressPayload
 * @property {string} orgId
 * @property {string} insurance_company_code
 * @property {string} zone
 * @property {string} username
 * @property {string} password
 * @property {string} bucketName
 * @property {string} kmsServiceId
 * @property {'unused-for-s3'} ftpHost
 * @property {string} region
 * @property {'S3'} provider
 * @property {string} sourcePath
 */

/**
 * @typedef {Object} AzureIngressPayload
 * @property {string} orgId
 * @property {string} insurance_company_code
 * @property {string} zone
 * @property {string} username
 * @property {string} password
 * @property {string} bucketName
 * @property {string} kmsServiceId
 * @property {string} ftpHost
 * @property {'AZURE'} provider
 * @property {string} sourcePath
 */

/**
 * @typedef {Object} FtpIngressPayload
 * @property {string} orgId
 * @property {string} insurance_company_code
 * @property {string} zone
 * @property {string} username
 * @property {string} password
 * @property {string} ftpHost
 * @property {number} ftpPort
 * @property {boolean} secure
 * @property {string} kmsServiceId
 * @property {'FTP'} provider
 * @property {string} sourcePath
 */

/**
 * @typedef {Object} SftpIngressPayload
 * @property {string} orgId
 * @property {string} insurance_company_code
 * @property {string} zone
 * @property {string} username
 * @property {string} password
 * @property {string} ftpHost
 * @property {number} ftpPort
 * @property {string} kmsServiceId
 * @property {'SFTP'} provider
 * @property {string} sourcePath
 */

/** @typedef {GcpIngressPayload | S3IngressPayload | AzureIngressPayload | FtpIngressPayload | SftpIngressPayload} IngressPayload */

export const INGRESS_PROVIDERS = ['GCP', 'S3', 'AZURE', 'FTP', 'SFTP'];

export const GCP_CREDENTIAL_KEYS = [
  'type',
  'project_id',
  'private_key_id',
  'private_key',
  'client_email',
  'client_id',
  'auth_uri',
  'token_uri',
  'auth_provider_x509_cert_url',
  'client_x509_cert_url',
  'universe_domain',
];
