const { query } = require('../database/connection');
const cacheService = require('./cacheService');

class AdminService {
  async getDashboardStats() {
    try {
      const cacheKey = 'admin_dashboard_stats';
      let cached = await cacheService.get(cacheKey);
      
      if (cached) return cached;

      const stats = await query(`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE user_type = 'passenger') as total_passengers,
          (SELECT COUNT(*) FROM users WHERE user_type = 'driver') as total_drivers,
          (SELECT COUNT(*) FROM driver_profiles WHERE is_online = true) as online_drivers,
          (SELECT COUNT(*) FROM rides WHERE status IN ('searching', 'bidding', 'accepted', 'in_progress')) as active_rides,
          (SELECT COUNT(*) FROM rides WHERE DATE(created_at) = CURRENT_DATE) as today_rides,
          (SELECT SUM(final_fare) FROM rides WHERE status = 'completed' AND DATE(completed_at) = CURRENT_DATE) as today_revenue,
          (SELECT COUNT(*) FROM support_tickets WHERE status = 'open') as open_tickets,
          (SELECT COUNT(*) FROM driver_applications WHERE status = 'pending') as pending_applications
      `);

      await cacheService.set(cacheKey, stats.rows[0], 60); // Cache for 1 minute
      return stats.rows[0];
    } catch (error) {
      throw new Error(`Dashboard stats fetch failed: ${error.message}`);
    }
  }

  async getUserManagement(page = 1, limit = 20, userType = null, status = null) {
    try {
      const offset = (page - 1) * limit;
      let whereClause = '';
      const params = [limit, offset];
      let paramCount = 2;

      if (userType) {
        whereClause += ` WHERE u.user_type = $${++paramCount}`;
        params.push(userType);
      }

      if (status) {
        whereClause += userType ? ' AND' : ' WHERE';
        whereClause += ` u.is_active = $${++paramCount}`;
        params.push(status === 'active');
      }

      const result = await query(`
        SELECT u.*, 
               dp.verification_status,
               dp.is_online,
               COUNT(r.id) as total_rides,
               AVG(r.final_fare) as avg_fare
        FROM users u
        LEFT JOIN driver_profiles dp ON u.id = dp.user_id
        LEFT JOIN rides r ON u.id = r.driver_id OR u.id = r.passenger_id
        ${whereClause}
        GROUP BY u.id, dp.verification_status, dp.is_online
        ORDER BY u.created_at DESC
        LIMIT $1 OFFSET $2
      `, params);

      return result.rows;
    } catch (error) {
      throw new Error(`User management fetch failed: ${error.message}`);
    }
  }

  async updateUserStatus(userId, isActive, reason = '') {
    try {
      await query(`
        UPDATE users SET is_active = $1 WHERE id = $2
      `, [isActive, userId]);

      // Log the action
      await query(`
        INSERT INTO admin_actions (user_id, action, reason, performed_at)
        VALUES ($1, $2, $3, NOW())
      `, [userId, isActive ? 'activate_user' : 'deactivate_user', reason]);

      await cacheService.del(`user:${userId}`);
      return { success: true };
    } catch (error) {
      throw new Error(`User status update failed: ${error.message}`);
    }
  }

  async getFinancialReports(period = 'month') {
    try {
      const cacheKey = `financial_report:${period}`;
      let cached = await cacheService.get(cacheKey);
      
      if (cached) return cached;

      let dateFilter = '';
      switch (period) {
        case 'week':
          dateFilter = "WHERE completed_at >= CURRENT_DATE - INTERVAL '7 days'";
          break;
        case 'month':
          dateFilter = "WHERE completed_at >= CURRENT_DATE - INTERVAL '30 days'";
          break;
        case 'year':
          dateFilter = "WHERE completed_at >= CURRENT_DATE - INTERVAL '365 days'";
          break;
      }

      const result = await query(`
        SELECT 
          COUNT(*) as total_rides,
          SUM(final_fare) as gross_revenue,
          SUM(final_fare * 0.15) as commission_revenue,
          SUM(final_fare * 0.85) as driver_payouts,
          AVG(final_fare) as avg_ride_value,
          COUNT(DISTINCT driver_id) as active_drivers,
          COUNT(DISTINCT passenger_id) as active_passengers
        FROM rides 
        ${dateFilter}
        AND status = 'completed'
      `);

      await cacheService.set(cacheKey, result.rows[0], 300); // Cache for 5 minutes
      return result.rows[0];
    } catch (error) {
      throw new Error(`Financial reports fetch failed: ${error.message}`);
    }
  }

  async resolveDispute(disputeId, resolution, adminId) {
    try {
      await query(`
        UPDATE disputes 
        SET status = 'resolved', resolution = $1, resolved_by = $2, resolved_at = NOW()
        WHERE id = $3
      `, [resolution, adminId, disputeId]);

      // Get dispute details for notification
      const dispute = await query(`
        SELECT d.*, r.passenger_id, r.driver_id
        FROM disputes d
        JOIN rides r ON d.ride_id = r.id
        WHERE d.id = $1
      `, [disputeId]);

      return { success: true, dispute: dispute.rows[0] };
    } catch (error) {
      throw new Error(`Dispute resolution failed: ${error.message}`);
    }
  }

  async getSystemConfiguration() {
    try {
      const result = await query(`
        SELECT * FROM system_config ORDER BY category, key
      `);

      const config = {};
      result.rows.forEach(row => {
        if (!config[row.category]) {
          config[row.category] = {};
        }
        config[row.category][row.key] = {
          value: row.value,
          description: row.description,
          updatedAt: row.updated_at
        };
      });

      return config;
    } catch (error) {
      throw new Error(`System configuration fetch failed: ${error.message}`);
    }
  }

  async updateSystemConfiguration(category, key, value, adminId) {
    try {
      await query(`
        INSERT INTO system_config (category, key, value, updated_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (category, key) 
        DO UPDATE SET value = $3, updated_by = $4, updated_at = NOW()
      `, [category, key, value, adminId]);

      // Clear related caches
      await cacheService.clearPattern(`config:${category}:*`);

      return { success: true };
    } catch (error) {
      throw new Error(`System configuration update failed: ${error.message}`);
    }
  }

  async getDriverApprovalQueue() {
    try {
      const result = await query(`
        SELECT da.*, u.full_name, u.email, u.phone_number, u.created_at as user_created
        FROM driver_applications da
        JOIN users u ON da.user_id = u.id
        WHERE da.status = 'pending'
        ORDER BY da.submitted_at ASC
      `);

      return result.rows;
    } catch (error) {
      throw new Error(`Driver approval queue fetch failed: ${error.message}`);
    }
  }

  async bulkApproveDrivers(applicationIds, adminId) {
    try {
      const results = [];
      
      for (const appId of applicationIds) {
        await query(`
          UPDATE driver_applications 
          SET status = 'approved', reviewer_id = $1, reviewed_at = NOW()
          WHERE id = $2
        `, [adminId, appId]);

        // Update driver profile
        const app = await query(`
          SELECT user_id FROM driver_applications WHERE id = $1
        `, [appId]);

        if (app.rows[0]) {
          await query(`
            UPDATE driver_profiles 
            SET verification_status = 'verified'
            WHERE user_id = $1
          `, [app.rows[0].user_id]);
        }

        results.push({ applicationId: appId, status: 'approved' });
      }

      return { success: true, results };
    } catch (error) {
      throw new Error(`Bulk driver approval failed: ${error.message}`);
    }
  }

  async getRevenueAnalytics(period = 'month') {
    try {
      const cacheKey = `revenue_analytics:${period}`;
      let cached = await cacheService.get(cacheKey);
      
      if (cached) return cached;

      let groupBy = '';
      let dateFilter = '';
      
      switch (period) {
        case 'week':
          groupBy = "DATE(completed_at)";
          dateFilter = "WHERE completed_at >= CURRENT_DATE - INTERVAL '7 days'";
          break;
        case 'month':
          groupBy = "DATE(completed_at)";
          dateFilter = "WHERE completed_at >= CURRENT_DATE - INTERVAL '30 days'";
          break;
        case 'year':
          groupBy = "DATE_TRUNC('month', completed_at)";
          dateFilter = "WHERE completed_at >= CURRENT_DATE - INTERVAL '365 days'";
          break;
      }

      const result = await query(`
        SELECT 
          ${groupBy} as period,
          COUNT(*) as rides,
          SUM(final_fare) as revenue,
          AVG(final_fare) as avg_fare,
          COUNT(DISTINCT driver_id) as active_drivers
        FROM rides 
        ${dateFilter}
        AND status = 'completed'
        GROUP BY ${groupBy}
        ORDER BY period
      `);

      await cacheService.set(cacheKey, result.rows, 300); // Cache for 5 minutes
      return result.rows;
    } catch (error) {
      throw new Error(`Revenue analytics fetch failed: ${error.message}`);
    }
  }
}

module.exports = AdminService;