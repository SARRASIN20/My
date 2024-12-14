class SecurityManager {
  constructor() {
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
  }

  async encrypt(text) {
    const data = this.encoder.encode(text);
    const key = await this.getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return {
      data: Array.from(new Uint8Array(encryptedData)),
      iv: Array.from(iv)
    };
  }

  async decrypt(encryptedObj) {
    const key = await this.getEncryptionKey();
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(encryptedObj.iv) },
      key,
      new Uint8Array(encryptedObj.data)
    );

    return this.decoder.decode(decryptedData);
  }

  async getEncryptionKey() {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      this.encoder.encode(chrome.runtime.id),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: this.encoder.encode('Assistant IA Navigation'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
}

export const securityManager = new SecurityManager(); 