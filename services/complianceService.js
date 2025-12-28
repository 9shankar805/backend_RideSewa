const { query } = require('../database/connection');
const logger = require('./loggerService');
const securityService = require('./securityService');

class ComplianceService {
  // GDPR Consent Management
  async recordConsent(userId, consentType, granted, ipAddress, userAgent) {
    try {
      await query(`
        INSERT INTO user_consents (user_id, consent_type, granted, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, consent_type) 
        DO UPDATE SET granted = $2, updated_at = NOW(), ip_address = $4, user_agent = $5
      `, [userId, consentType, granted, ipAddress, userAgent]);

      logger.info('Consent recorded', { userId, consentType, granted });
      return { success: true };
    } catch (error) {
      throw new Error(`Consent recording failed: ${error.message}`);
    }
  }

  async getConsentStatus(userId) {
    try {
      const result = await query(`
        SELECT consent_type, granted, updated_at
        FROM user_consents 
        WHERE user_id = $1
      `, [userId]);

      const consents = {};
      result.rows.forEach(row => {
        consents[row.consent_type] = {
          granted: row.granted,
          updatedAt: row.updated_at
        };
      });

      return consents;
    } catch (error) {
      throw new Error(`Consent status fetch failed: ${error.message}`);
    }
  }

  // Data Export (Right to Data Portability)
  async exportUserData(userId) {
    try {
      // Get user basic data
      const userData = await query(`
        SELECT id, email, full_name, phone_number, user_type, created_at, rating
        FROM users WHERE id = $1
      `, [userId]);

      // Get ride history
      const rideData = await query(`
        SELECT id, pickup_address, destination_address, distance_km, final_fare, 
               status, created_at, completed_at
        FROM rides 
        WHERE passenger_id = $1 OR driver_id = $1
        ORDER BY created_at DESC
      `, [userId]);

      // Get driver profile if applicable
      const driverData = await query(`
        SELECT vehicle_model, vehicle_color, verification_status, created_at
        FROM driver_profiles WHERE user_id = $1
      `, [userId]);

      // Get loyalty points
      const loyaltyData = await query(`
        SELECT points, reason, created_at
        FROM loyalty_points WHERE user_id = $1
        ORDER BY created_at DESC
      `, [userId]);

      const exportData = {
        user: userData.rows[0],
        rides: rideData.rows,
        driverProfile: driverData.rows[0] || null,
        loyaltyHistory: loyaltyData.rows,
        exportedAt: new Date().toISOString(),
        dataRetentionPolicy: 'Data is retained for 7 years as per legal requirements'
      };

      // Log data export
      await securityService.logSecurityEvent('data_export', userId, {
        exportedAt: new Date().toISOString()
      });

      return exportData;
    } catch (error) {
      throw new Error(`Data export failed: ${error.message}`);
    }
  }

  // Data Deletion (Right to be Forgotten)
  async deleteUserData(userId, reason = 'user_request') {
    try {
      // Start transaction for data deletion
      await query('BEGIN');

      // Anonymize rides instead of deleting (for business records)
      await query(`
        UPDATE rides SET 
          pickup_address = 'DELETED',
          destination_address = 'DELETED'
        WHERE passenger_id = $1 OR driver_id = $1
      `, [userId]);

      // Delete personal data
      await query('DELETE FROM user_consents WHERE user_id = $1', [userId]);
      await query('DELETE FROM favorite_locations WHERE user_id = $1', [userId]);
      await query('DELETE FROM loyalty_points WHERE user_id = $1', [userId]);
      await query('DELETE FROM messages WHERE from_user_id = $1 OR to_user_id = $1', [userId]);
      await query('DELETE FROM driver_profiles WHERE user_id = $1', [userId]);
      await query('DELETE FROM api_keys WHERE user_id = $1', [userId]);

      // Anonymize user record
      await query(`
        UPDATE users SET 
          email = 'deleted_' || id || '@deleted.com',
          full_name = 'Deleted User',
          phone_number = NULL,
          profile_image_url = NULL,
          is_active = false
        WHERE id = $1
      `, [userId]);

      // Record deletion
      await query(`
        INSERT INTO data_deletions (user_id, reason, deleted_at)
        VALUES ($1, $2, NOW())
      `, [userId, reason]);

      await query('COMMIT');

      logger.info('User data deleted', { userId, reason });
      return { success: true };
    } catch (error) {
      await query('ROLLBACK');
      throw new Error(`Data deletion failed: ${error.message}`);
    }
  }

  // Data Retention Management
  async cleanupExpiredData() {
    try {
      const retentionPeriod = process.env.DATA_RETENTION_DAYS || 2555; // 7 years default

      // Delete old audit logs
      await query(`
        DELETE FROM security_audit_log 
        WHERE timestamp < NOW() - INTERVAL '${retentionPeriod} days'
      `);

      // Delete old location updates
      await query(`
        DELETE FROM location_updates 
        WHERE created_at < NOW() - INTERVAL '90 days'
      `);

      // Delete old notifications
      await query(`
        DELETE FROM notifications 
        WHERE created_at < NOW() - INTERVAL '365 days'
      `);

      logger.info('Expired data cleaned up');
      return { success: true };
    } catch (error) {
      throw new Error(`Data cleanup failed: ${error.message}`);
    }
  }

  // Privacy Policy Management
  async getPrivacyPolicy(version = 'current') {
    try {
      const result = await query(`
        SELECT content, version, effective_date, created_at
        FROM privacy_policies 
        WHERE version = $1 OR ($1 = 'current' AND is_current = true)
        ORDER BY created_at DESC
        LIMIT 1
      `, [version]);

      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Privacy policy fetch failed: ${error.message}`);
    }
  }

  async updatePrivacyPolicy(content, version, adminId) {
    try {
      // Mark current policy as not current
      await query(`UPDATE privacy_policies SET is_current = false`);

      // Insert new policy
      await query(`
        INSERT INTO privacy_policies (content, version, is_current, created_by)
        VALUES ($1, $2, true, $3)
      `, [content, version, adminId]);

      logger.info('Privacy policy updated', { version, adminId });
      return { success: true };
    } catch (error) {
      throw new Error(`Privacy policy update failed: ${error.message}`);
    }
  }

  // Terms of Service Management
  async getTermsOfService(version = 'current') {
    try {
      const result = await query(`
        SELECT content, version, effective_date, created_at
        FROM terms_of_service 
        WHERE version = $1 OR ($1 = 'current' AND is_current = true)
        ORDER BY created_at DESC
        LIMIT 1
      `, [version]);

      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Terms of service fetch failed: ${error.message}`);
    }
  }

  // Data Processing Activities Log
  async logDataProcessing(activity, userId, purpose, legalBasis, dataTypes) {
    try {
      await query(`
        INSERT INTO data_processing_log (activity, user_id, purpose, legal_basis, data_types)
        VALUES ($1, $2, $3, $4, $5)
      `, [activity, userId, purpose, legalBasis, JSON.stringify(dataTypes)]);

      return { success: true };
    } catch (error) {
      logger.error('Data processing logging failed', error);
    }
  }

  // Cookie Consent Management
  async recordCookieConsent(userId, cookieTypes, granted, ipAddress) {
    try {
      await query(`
        INSERT INTO cookie_consents (user_id, cookie_types, granted, ip_address)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) 
        DO UPDATE SET cookie_types = $2, granted = $3, updated_at = NOW()
      `, [userId, JSON.stringify(cookieTypes), granted, ipAddress]);

      return { success: true };
    } catch (error) {
      throw new Error(`Cookie consent recording failed: ${error.message}`);
    }
  }

  // Data Breach Notification
  async reportDataBreach(description, affectedUsers, severity, reportedBy) {
    try {
      const breachId = require('uuid').v4();
      
      await query(`
        INSERT INTO data_breaches (id, description, affected_users, severity, reported_by, status)
        VALUES ($1, $2, $3, $4, $5, 'reported')
      `, [breachId, description, affectedUsers, severity, reportedBy]);

      // Log critical security event
      logger.error('Data breach reported', {
        breachId,
        affectedUsers,
        severity,
        reportedBy
      });

      return { breachId, success: true };
    } catch (error) {
      throw new Error(`Data breach reporting failed: ${error.message}`);
    }
  }

  // Generate compliance report
  async generateComplianceReport(startDate, endDate) {
    try {
      const report = {
        period: { startDate, endDate },
        consentMetrics: {},
        dataRequests: {},
        breaches: {},
        generatedAt: new Date().toISOString()
      };

      // Consent metrics
      const consentStats = await query(`
        SELECT consent_type, 
               COUNT(*) as total,
               COUNT(CASE WHEN granted = true THEN 1 END) as granted
        FROM user_consents 
        WHERE updated_at BETWEEN $1 AND $2
        GROUP BY consent_type
      `, [startDate, endDate]);

      report.consentMetrics = consentStats.rows;

      // Data requests
      const dataRequests = await query(`
        SELECT COUNT(*) as exports FROM data_processing_log 
        WHERE activity = 'data_export' AND created_at BETWEEN $1 AND $2
      `, [startDate, endDate]);

      const deletions = await query(`
        SELECT COUNT(*) as deletions FROM data_deletions 
        WHERE deleted_at BETWEEN $1 AND $2
      `, [startDate, endDate]);

      report.dataRequests = {
        exports: dataRequests.rows[0].exports,
        deletions: deletions.rows[0].deletions
      };

      return report;
    } catch (error) {
      throw new Error(`Compliance report generation failed: ${error.message}`);
    }
  }
}

module.exports = ComplianceService;