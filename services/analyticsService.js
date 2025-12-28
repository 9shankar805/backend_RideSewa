const { query } = require('../database/connection');

class AnalyticsService {
  async getDriverEarnings(driverId, period = 'week') {
    try {
      let dateFilter = '';
      switch (period) {
        case 'day':
          dateFilter = "AND DATE(r.completed_at) = CURRENT_DATE";
          break;
        case 'week':
          dateFilter = "AND r.completed_at >= CURRENT_DATE - INTERVAL '7 days'";
          break;
        case 'month':
          dateFilter = "AND r.completed_at >= CURRENT_DATE - INTERVAL '30 days'";
          break;
        case 'year':
          dateFilter = "AND r.completed_at >= CURRENT_DATE - INTERVAL '365 days'";
          break;
      }

      const result = await query(`
        SELECT 
          COUNT(*) as total_rides,
          SUM(r.final_fare) as gross_earnings,
          SUM(r.final_fare * 0.85) as net_earnings,
          SUM(r.final_fare * 0.15) as commission_paid,
          AVG(r.final_fare) as avg_fare,
          SUM(r.distance_km) as total_distance,
          AVG(EXTRACT(EPOCH FROM (r.completed_at - r.started_at))/60) as avg_ride_duration
        FROM rides r
        WHERE r.driver_id = $1 
        AND r.status = 'completed'
        ${dateFilter}
      `, [driverId]);

      return result.rows[0];
    } catch (error) {
      throw new Error(`Driver earnings calculation failed: ${error.message}`);
    }
  }

  async getRideAnalytics(period = 'week') {
    try {
      let dateFilter = '';
      switch (period) {
        case 'day':
          dateFilter = "WHERE DATE(created_at) = CURRENT_DATE";
          break;
        case 'week':
          dateFilter = "WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'";
          break;
        case 'month':
          dateFilter = "WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'";
          break;
      }

      const result = await query(`
        SELECT 
          COUNT(*) as total_rides,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_rides,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_rides,
          ROUND(COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2) as completion_rate,
          AVG(final_fare) as avg_fare,
          SUM(final_fare) as total_revenue,
          AVG(distance_km) as avg_distance,
          COUNT(DISTINCT passenger_id) as unique_passengers,
          COUNT(DISTINCT driver_id) as active_drivers
        FROM rides 
        ${dateFilter}
      `);

      return result.rows[0];
    } catch (error) {
      throw new Error(`Ride analytics calculation failed: ${error.message}`);
    }
  }

  async getPerformanceMetrics() {
    try {
      const result = await query(`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE user_type = 'passenger') as total_passengers,
          (SELECT COUNT(*) FROM users WHERE user_type = 'driver') as total_drivers,
          (SELECT COUNT(*) FROM driver_profiles WHERE is_online = true) as online_drivers,
          (SELECT COUNT(*) FROM rides WHERE status IN ('searching', 'bidding', 'accepted', 'in_progress')) as active_rides,
          (SELECT AVG(rating) FROM users WHERE user_type = 'driver') as avg_driver_rating,
          (SELECT COUNT(*) FROM rides WHERE created_at >= CURRENT_DATE) as today_rides
      `);

      return result.rows[0];
    } catch (error) {
      throw new Error(`Performance metrics calculation failed: ${error.message}`);
    }
  }

  async getHourlyRideData(date = new Date()) {
    try {
      const result = await query(`
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as ride_count,
          AVG(final_fare) as avg_fare
        FROM rides 
        WHERE DATE(created_at) = $1
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `, [date.toISOString().split('T')[0]]);

      return result.rows;
    } catch (error) {
      throw new Error(`Hourly ride data calculation failed: ${error.message}`);
    }
  }

  async getTopDrivers(limit = 10, period = 'month') {
    try {
      let dateFilter = '';
      switch (period) {
        case 'week':
          dateFilter = "AND r.completed_at >= CURRENT_DATE - INTERVAL '7 days'";
          break;
        case 'month':
          dateFilter = "AND r.completed_at >= CURRENT_DATE - INTERVAL '30 days'";
          break;
      }

      const result = await query(`
        SELECT 
          u.id,
          u.full_name,
          u.rating,
          COUNT(r.id) as total_rides,
          SUM(r.final_fare) as total_earnings,
          AVG(r.final_fare) as avg_fare
        FROM users u
        JOIN rides r ON u.id = r.driver_id
        WHERE u.user_type = 'driver' 
        AND r.status = 'completed'
        ${dateFilter}
        GROUP BY u.id, u.full_name, u.rating
        ORDER BY total_earnings DESC
        LIMIT $1
      `, [limit]);

      return result.rows;
    } catch (error) {
      throw new Error(`Top drivers calculation failed: ${error.message}`);
    }
  }

  async getRevenueAnalytics(period = 'month') {
    try {
      let dateFilter = '';
      let groupBy = '';
      
      switch (period) {
        case 'week':
          dateFilter = "WHERE completed_at >= CURRENT_DATE - INTERVAL '7 days'";
          groupBy = "DATE(completed_at)";
          break;
        case 'month':
          dateFilter = "WHERE completed_at >= CURRENT_DATE - INTERVAL '30 days'";
          groupBy = "DATE(completed_at)";
          break;
        case 'year':
          dateFilter = "WHERE completed_at >= CURRENT_DATE - INTERVAL '365 days'";
          groupBy = "DATE_TRUNC('month', completed_at)";
          break;
      }

      const result = await query(`
        SELECT 
          ${groupBy} as period,
          COUNT(*) as rides,
          SUM(final_fare) as gross_revenue,
          SUM(final_fare * 0.15) as commission_revenue,
          SUM(final_fare * 0.85) as driver_earnings
        FROM rides 
        ${dateFilter}
        AND status = 'completed'
        GROUP BY ${groupBy}
        ORDER BY period
      `);

      return result.rows;
    } catch (error) {
      throw new Error(`Revenue analytics calculation failed: ${error.message}`);
    }
  }
}

module.exports = AnalyticsService;