const { query } = require('../database/connection');
const CommunicationService = require('./communicationService');

class DriverVerificationService {
  constructor() {
    this.communicationService = new CommunicationService();
  }

  async submitDriverApplication(userId, documents) {
    try {
      const applicationId = require('uuid').v4();
      
      await query(`
        INSERT INTO driver_applications (
          id, user_id, license_url, insurance_url, vehicle_registration_url,
          vehicle_image_url, status, submitted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
      `, [
        applicationId,
        userId,
        documents.license_url,
        documents.insurance_url,
        documents.vehicle_registration_url,
        documents.vehicle_image_url
      ]);

      return { applicationId, status: 'pending' };
    } catch (error) {
      throw new Error(`Driver application submission failed: ${error.message}`);
    }
  }

  async reviewDriverApplication(applicationId, reviewerId, decision, notes = '') {
    try {
      await query(`
        UPDATE driver_applications 
        SET status = $1, reviewer_id = $2, review_notes = $3, reviewed_at = NOW()
        WHERE id = $4
      `, [decision, reviewerId, notes, applicationId]);

      // Get application details
      const app = await query(`
        SELECT da.*, u.email, u.full_name
        FROM driver_applications da
        JOIN users u ON da.user_id = u.id
        WHERE da.id = $1
      `, [applicationId]);

      if (app.rows[0]) {
        const application = app.rows[0];
        
        // Update driver profile if approved
        if (decision === 'approved') {
          await query(`
            UPDATE driver_profiles 
            SET verification_status = 'verified'
            WHERE user_id = $1
          `, [application.user_id]);
        }

        // Send notification email
        await this.communicationService.sendDriverVerificationEmail(
          application.email,
          application.full_name,
          decision
        );
      }

      return { success: true, decision };
    } catch (error) {
      throw new Error(`Driver application review failed: ${error.message}`);
    }
  }

  async checkDocumentExpiry() {
    try {
      const result = await query(`
        SELECT dp.*, u.email, u.full_name
        FROM driver_profiles dp
        JOIN users u ON dp.user_id = u.id
        WHERE (
          dp.license_expiry <= CURRENT_DATE + INTERVAL '30 days' OR
          dp.insurance_expiry <= CURRENT_DATE + INTERVAL '30 days'
        )
        AND dp.verification_status = 'verified'
      `);

      for (const driver of result.rows) {
        const expiringDocs = [];
        
        if (new Date(driver.license_expiry) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
          expiringDocs.push('Driver License');
        }
        
        if (new Date(driver.insurance_expiry) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
          expiringDocs.push('Insurance');
        }

        if (expiringDocs.length > 0) {
          await this.communicationService.sendEmail(
            driver.email,
            'Document Expiry Warning',
            `
              <h2>Document Expiry Warning</h2>
              <p>Hello ${driver.full_name},</p>
              <p>The following documents are expiring soon:</p>
              <ul>
                ${expiringDocs.map(doc => `<li>${doc}</li>`).join('')}
              </ul>
              <p>Please update your documents to continue driving.</p>
            `
          );
        }
      }

      return { checked: result.rows.length, notified: result.rows.length };
    } catch (error) {
      throw new Error(`Document expiry check failed: ${error.message}`);
    }
  }

  async getDriverApplications(status = null, limit = 50) {
    try {
      let whereClause = '';
      const params = [limit];
      
      if (status) {
        whereClause = 'WHERE da.status = $2';
        params.push(status);
      }

      const result = await query(`
        SELECT da.*, u.full_name, u.email, u.phone_number
        FROM driver_applications da
        JOIN users u ON da.user_id = u.id
        ${whereClause}
        ORDER BY da.submitted_at DESC
        LIMIT $1
      `, params);

      return result.rows;
    } catch (error) {
      throw new Error(`Fetching driver applications failed: ${error.message}`);
    }
  }

  async performBackgroundCheck(userId, checkType = 'basic') {
    try {
      // Simulate background check (integrate with actual service in production)
      const checkId = require('uuid').v4();
      
      await query(`
        INSERT INTO background_checks (id, user_id, check_type, status, initiated_at)
        VALUES ($1, $2, $3, 'in_progress', NOW())
      `, [checkId, userId, checkType]);

      // Simulate async processing
      setTimeout(async () => {
        const result = Math.random() > 0.1 ? 'passed' : 'failed'; // 90% pass rate
        
        await query(`
          UPDATE background_checks 
          SET status = $1, completed_at = NOW()
          WHERE id = $2
        `, [result, checkId]);
      }, 5000);

      return { checkId, status: 'in_progress' };
    } catch (error) {
      throw new Error(`Background check initiation failed: ${error.message}`);
    }
  }

  async scheduleVehicleInspection(userId, inspectionDate, location) {
    try {
      const inspectionId = require('uuid').v4();
      
      await query(`
        INSERT INTO vehicle_inspections (
          id, user_id, scheduled_date, location, status
        ) VALUES ($1, $2, $3, $4, 'scheduled')
      `, [inspectionId, userId, inspectionDate, location]);

      // Send confirmation
      const user = await query('SELECT email, full_name FROM users WHERE id = $1', [userId]);
      if (user.rows[0]) {
        await this.communicationService.sendEmail(
          user.rows[0].email,
          'Vehicle Inspection Scheduled',
          `
            <h2>Vehicle Inspection Scheduled</h2>
            <p>Hello ${user.rows[0].full_name},</p>
            <p>Your vehicle inspection has been scheduled:</p>
            <p><strong>Date:</strong> ${new Date(inspectionDate).toLocaleDateString()}</p>
            <p><strong>Location:</strong> ${location}</p>
            <p>Please arrive 15 minutes early with all required documents.</p>
          `
        );
      }

      return { inspectionId, status: 'scheduled' };
    } catch (error) {
      throw new Error(`Vehicle inspection scheduling failed: ${error.message}`);
    }
  }
}

module.exports = DriverVerificationService;