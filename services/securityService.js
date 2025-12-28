const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../database/connection');
const logger = require('./loggerService');

class SecurityService {
  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
    this.algorithm = 'aes-256-gcm';
  }

  // API Key Management
  async generateApiKey(userId, name, permissions = []) {
    try {
      const apiKey = 'sk_' + crypto.randomBytes(32).toString('hex');
      const hashedKey = await bcrypt.hash(apiKey, 12);
      
      const keyId = require('uuid').v4();
      
      await query(`
        INSERT INTO api_keys (id, user_id, name, key_hash, permissions, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
      `, [keyId, userId, name, hashedKey, JSON.stringify(permissions)]);

      logger.info('API key generated', { userId, keyId, name });
      
      return { keyId, apiKey: apiKey.substring(0, 8) + '...' }; // Return masked key
    } catch (error) {
      throw new Error(`API key generation failed: ${error.message}`);
    }
  }

  async validateApiKey(apiKey) {
    try {
      const result = await query(`
        SELECT ak.*, u.id as user_id, u.is_active as user_active
        FROM api_keys ak
        JOIN users u ON ak.user_id = u.id
        WHERE ak.is_active = true AND u.is_active = true
      `);

      for (const key of result.rows) {
        const isValid = await bcrypt.compare(apiKey, key.key_hash);
        if (isValid) {
          // Update last used
          await query(`
            UPDATE api_keys SET last_used_at = NOW() WHERE id = $1
          `, [key.id]);

          return {
            keyId: key.id,
            userId: key.user_id,
            permissions: key.permissions,
            name: key.name
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('API key validation failed', error);
      return null;
    }
  }

  async revokeApiKey(keyId, userId) {
    try {
      await query(`
        UPDATE api_keys SET is_active = false, revoked_at = NOW()
        WHERE id = $1 AND user_id = $2
      `, [keyId, userId]);

      logger.info('API key revoked', { keyId, userId });
      return { success: true };
    } catch (error) {
      throw new Error(`API key revocation failed: ${error.message}`);
    }
  }

  // Data Encryption
  encrypt(text) {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
      cipher.setAAD(Buffer.from('additional-data'));
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      logger.error('Encryption failed', error);
      throw new Error('Encryption failed');
    }
  }

  decrypt(encryptedData) {
    try {
      const { encrypted, iv, authTag } = encryptedData;
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
      
      decipher.setAAD(Buffer.from('additional-data'));
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', error);
      throw new Error('Decryption failed');
    }
  }

  // Secure data storage
  async encryptSensitiveData(data) {
    const sensitiveFields = ['ssn', 'license_number', 'phone_number', 'email'];
    const encrypted = { ...data };
    
    for (const field of sensitiveFields) {
      if (data[field]) {
        encrypted[field] = this.encrypt(data[field]);
      }
    }
    
    return encrypted;
  }

  async decryptSensitiveData(data) {
    const sensitiveFields = ['ssn', 'license_number', 'phone_number', 'email'];
    const decrypted = { ...data };
    
    for (const field of sensitiveFields) {
      if (data[field] && typeof data[field] === 'object') {
        decrypted[field] = this.decrypt(data[field]);
      }
    }
    
    return decrypted;
  }

  // Session Security
  generateSecureToken() {
    return crypto.randomBytes(64).toString('hex');
  }

  hashPassword(password) {
    return bcrypt.hash(password, 12);
  }

  verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  // Audit Logging
  async logSecurityEvent(event, userId, details = {}) {
    try {
      await query(`
        INSERT INTO security_audit_log (event_type, user_id, ip_address, user_agent, details, timestamp)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        event,
        userId,
        details.ip_address,
        details.user_agent,
        JSON.stringify(details)
      ]);

      logger.info('Security event logged', { event, userId, details });
    } catch (error) {
      logger.error('Security audit logging failed', error);
    }
  }

  // Data masking for logs
  maskSensitiveData(data) {
    const masked = { ...data };
    const sensitiveFields = ['password', 'ssn', 'license_number', 'phone_number', 'email'];
    
    for (const field of sensitiveFields) {
      if (masked[field]) {
        if (field === 'email') {
          const [local, domain] = masked[field].split('@');
          masked[field] = local.substring(0, 2) + '***@' + domain;
        } else if (field === 'phone_number') {
          masked[field] = '***-***-' + masked[field].slice(-4);
        } else {
          masked[field] = '***MASKED***';
        }
      }
    }
    
    return masked;
  }

  // Input sanitization
  sanitizeInput(input) {
    if (typeof input === 'string') {
      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }
    return input;
  }

  // Generate CSRF token
  generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Validate CSRF token
  validateCSRFToken(token, sessionToken) {
    return crypto.timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(sessionToken, 'hex')
    );
  }
}

module.exports = new SecurityService();