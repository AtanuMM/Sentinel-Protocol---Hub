/**
 * @typedef {Object} ConnectWhatsappChannelRequest
 * @property {string} orgId
 * @property {string} serviceId
 * @property {string} zoneId
 * @property {string} authorizationCode
 */

/**
 * @typedef {Object} ConnectWhatsappChannelData
 * @property {string} phoneNumber
 * @property {string} orgId
 * @property {string} wabaId
 */

/**
 * @typedef {Object} ConnectWhatsappChannelResponse
 * @property {true} success
 * @property {string} message
 * @property {ConnectWhatsappChannelData} data
 */

/**
 * @typedef {Object} ConnectWhatsappChannelErrorResponse
 * @property {boolean} [success]
 * @property {string} [message]
 * @property {string} [error]
 * @property {string} [detail]
 */

export {};
