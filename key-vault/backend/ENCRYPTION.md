Here is the comprehensive technical specification for the **Sentinel Vault Encryption Engine**.

🛡️ Sentinel Vault: Technical Specification (v1.0)
==================================================

1\. High-Level Architecture
---------------------------

Sentinel Vault utilizes **Envelope Encryption**, a security standard used by major providers like AWS KMS and Google Cloud KMS. Instead of using one single key to encrypt the entire database, we use a hierarchy of keys to isolate data and minimize the impact of a potential leak.

### Key Hierarchy

1.  **Master Root Key ($K\_m$):** A 256-bit static key stored in the environment (.env). It never touches the database. Its only job is to "wrap" (encrypt) other keys.
    
2.  **Data Encryption Key ($K\_d$):** A unique, randomly generated 256-bit key created for **every single secret**. It is used to encrypt the actual payload.
    

2\. The Encryption Logic (The "Wrap" Process)
---------------------------------------------

When a user submits a secret, the CryptoService performs the following cryptographic operations:

### Step A: Data Encryption

1.  Generate a unique **Data Encryption Key ($K\_d$)**.
    
2.  Generate a 12-byte **Initialization Vector ($IV$)** to ensure the ciphertext is unique even if the secret is identical to another.
    
3.  $$C = \\text{Encrypt}(P, K\_d, IV)$$
    
4.  Generate an **Authentication Tag** ($T\_{data}$) to ensure data integrity (prevents tampering).
    

### Step B: Key Wrapping (The Envelope)

We cannot store $K\_d$ in plain text. We must "wrap" it using the Master Key.

1.  Generate a secondary **DEK Initialization Vector** ($IV\_{dek}$).
    
2.  $$W\_k = \\text{Encrypt}(K\_d, K\_m, IV\_{dek})$$
    
3.  Generate an **Authentication Tag** ($T\_{dek}$) for the key itself.
    

3\. Database Schema Mapping
---------------------------

The resulting "Envelope" is stored in the Secret table. Here is how the cryptographic outputs map to your columns:

| Column        | Technical Name    | Purpose                                 |
| ------------- | ----------------- | --------------------------------------- |
| encryptedBlob | Ciphertext (C)    | The encrypted secret payload.           |
| authTag       | Tag (Tdata​)      | Verification for the secret payload.    |
| iv            | IV                | Random nonce for the secret encryption. |
| wrappedDek    | Wrapped Key (Wk​) | The Kd​, encrypted by the Master Key.   |
| dekIv         | IVdek​            | Random nonce for the key encryption.    |
| dekTag        | Tag (Tdek​)       | Verification for the wrapped key.       |

4\. The Decryption Logic (The "Unwrap" Process)
-----------------------------------------------

To retrieve the secret, the process is reversed. If the Master Key in .env does not match the one used during encryption, the process fails at Step 1.

1.  **Unwrap the DEK:** Use the $K\_m$ + dekIv + dekTag to decrypt the wrappedDek back into the original Data Encryption Key ($K\_d$).
    
2.  **Decrypt the Payload:** Use the newly recovered $K\_d$ + iv + authTag to decrypt the encryptedBlob back into the original plaintext $P$.
    
3.  **Integrity Check:** If the authTag fails at any point (meaning even 1 bit of the hex string was changed in the DB), the library throws an error and refuses to return the data.
    

5\. Security Benefits
---------------------

*   **Key Rotation Readiness:** You can re-encrypt the wrappedDek columns with a new Master Key without ever having to touch or re-encrypt the actual secret data (the encryptedBlob).
    
*   **Compromise Isolation:** If one row's $K\_d$ is somehow cracked, only that **one secret** is exposed. The rest of the database remains secure.
    
*   **Zero Plaintext Storage:** At no point is the Master Key, the raw Data Encryption Key, or the Secret Plaintext stored in the database.
    

6\. Implementation Checklist
----------------------------

*   **Algorithm:** aes-256-gcm
    
*   **Key Strength:** 256-bit (32 bytes)
    
*   **IV Length:** 96-bit (12 bytes)
    
*   **Encoding:** All storage is handled as hex strings.