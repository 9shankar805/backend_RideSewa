const { query } = require('../database/connection');
const cacheService = require('./cacheService');

class AdvancedFeaturesService {
  async getRideHistory(userId, limit = 20, offset = 0) {
    try {
      const cacheKey = `ride_history:${userId}:${limit}:${offset}`;
      let cached = await cacheService.get(cacheKey);
      
      if (cached) return cached;

      const result = await query(`
        SELECT r.*, 
               u_driver.full_name as driver_name,
               u_passenger.full_name as passenger_name,
               dp.vehicle_model, dp.vehicle_color, dp.vehicle_plate
        FROM rides r
        LEFT JOIN users u_driver ON r.driver_id = u_driver.id
        LEFT JOIN users u_passenger ON r.passenger_id = u_passenger.id
        LEFT JOIN driver_profiles dp ON r.driver_id = dp.user_id
        WHERE r.passenger_id = $1 OR r.driver_id = $1
        ORDER BY r.created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);

      await cacheService.set(cacheKey, result.rows, 300); // Cache for 5 minutes
      return result.rows;
    } catch (error) {
      throw new Error(`Ride history fetch failed: ${error.message}`);
    }
  }

  async generateRideReceipt(rideId) {
    try {
      const result = await query(`
        SELECT r.*, 
               u_driver.full_name as driver_name, u_driver.phone_number as driver_phone,
               u_passenger.full_name as passenger_name, u_passenger.email as passenger_email,
               dp.vehicle_model, dp.vehicle_color, dp.vehicle_plate
        FROM rides r
        JOIN users u_driver ON r.driver_id = u_driver.id
        JOIN users u_passenger ON r.passenger_id = u_passenger.id
        JOIN driver_profiles dp ON r.driver_id = dp.user_id
        WHERE r.id = $1 AND r.status = 'completed'
      `, [rideId]);

      if (result.rows.length === 0) {
        throw new Error('Ride not found or not completed');
      }

      const ride = result.rows[0];
      const receipt = {
        rideId: ride.id,
        date: ride.completed_at,
        passenger: {
          name: ride.passenger_name,
          email: ride.passenger_email
        },
        driver: {
          name: ride.driver_name,
          phone: ride.driver_phone,
          vehicle: `${ride.vehicle_color} ${ride.vehicle_model} (${ride.vehicle_plate})`
        },
        trip: {
          from: ride.pickup_address,
          to: ride.destination_address,
          distance: `${ride.distance_km} km`,
          duration: `${Math.round((new Date(ride.completed_at) - new Date(ride.started_at)) / 60000)} minutes`
        },
        payment: {
          fare: ride.final_fare,
          paymentMethod: ride.payment_method,
          status: ride.payment_status
        }
      };

      return receipt;
    } catch (error) {
      throw new Error(`Receipt generation failed: ${error.message}`);
    }
  }

  async addFavoriteLocation(userId, name, address, latitude, longitude, type = 'other') {
    try {
      const favoriteId = require('uuid').v4();
      
      await query(`
        INSERT INTO favorite_locations (id, user_id, name, address, latitude, longitude, type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [favoriteId, userId, name, address, latitude, longitude, type]);

      // Clear user's favorite locations cache
      await cacheService.del(`favorites:${userId}`);

      return { favoriteId, success: true };
    } catch (error) {
      throw new Error(`Add favorite location failed: ${error.message}`);
    }
  }

  async getFavoriteLocations(userId) {
    try {
      const cacheKey = `favorites:${userId}`;
      let cached = await cacheService.get(cacheKey);
      
      if (cached) return cached;

      const result = await query(`
        SELECT * FROM favorite_locations 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `, [userId]);

      await cacheService.set(cacheKey, result.rows, 1800); // Cache for 30 minutes
      return result.rows;
    } catch (error) {
      throw new Error(`Favorite locations fetch failed: ${error.message}`);
    }
  }

  async setDriverPreferences(userId, preferences) {
    try {
      await query(`
        INSERT INTO driver_preferences (user_id, preferences)
        VALUES ($1, $2)
        ON CONFLICT (user_id) 
        DO UPDATE SET preferences = $2, updated_at = NOW()
      `, [userId, JSON.stringify(preferences)]);

      await cacheService.del(`driver_prefs:${userId}`);
      return { success: true };
    } catch (error) {
      throw new Error(`Driver preferences update failed: ${error.message}`);
    }
  }

  async getDriverPreferences(userId) {
    try {
      const cacheKey = `driver_prefs:${userId}`;
      let cached = await cacheService.get(cacheKey);
      
      if (cached) return cached;

      const result = await query(`
        SELECT preferences FROM driver_preferences WHERE user_id = $1
      `, [userId]);

      const prefs = result.rows[0]?.preferences || {};
      await cacheService.set(cacheKey, prefs, 3600); // Cache for 1 hour
      return prefs;
    } catch (error) {
      throw new Error(`Driver preferences fetch failed: ${error.message}`);
    }
  }

  async calculateSurgePrice(baseFare, location, timeOfDay) {
    try {
      // Get demand data for the area
      const demandResult = await query(`
        SELECT COUNT(*) as active_rides
        FROM rides 
        WHERE status IN ('searching', 'bidding')
        AND (
          (6371 * acos(cos(radians($1)) * cos(radians(pickup_latitude)) * 
           cos(radians(pickup_longitude) - radians($2)) + 
           sin(radians($1)) * sin(radians(pickup_latitude)))) < 5
        )
      `, [location.lat, location.lng]);

      // Get available drivers in the area
      const driverResult = await query(`
        SELECT COUNT(*) as available_drivers
        FROM driver_profiles dp
        WHERE dp.is_online = true AND dp.is_available = true
        AND (
          (6371 * acos(cos(radians($1)) * cos(radians(dp.current_latitude)) * 
           cos(radians(dp.current_longitude) - radians($2)) + 
           sin(radians($1)) * sin(radians(dp.current_latitude)))) < 5
        )
      `, [location.lat, location.lng]);

      const activeRides = parseInt(demandResult.rows[0].active_rides);
      const availableDrivers = parseInt(driverResult.rows[0].available_drivers);
      
      let surgeMultiplier = 1.0;
      
      // Demand-supply ratio
      if (availableDrivers > 0) {
        const demandRatio = activeRides / availableDrivers;
        if (demandRatio > 2) surgeMultiplier = 2.0;
        else if (demandRatio > 1.5) surgeMultiplier = 1.8;
        else if (demandRatio > 1) surgeMultiplier = 1.5;
        else if (demandRatio > 0.5) surgeMultiplier = 1.2;
      } else if (activeRides > 0) {
        surgeMultiplier = 2.5; // No drivers available
      }

      // Time-based surge
      const hour = new Date().getHours();
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
        surgeMultiplier *= 1.2; // Rush hour
      }

      const surgePrice = Math.round(baseFare * surgeMultiplier * 100) / 100;
      
      return {
        baseFare,
        surgeMultiplier,
        surgePrice,
        demandLevel: activeRides > 10 ? 'high' : activeRides > 5 ? 'medium' : 'low'
      };
    } catch (error) {
      throw new Error(`Surge price calculation failed: ${error.message}`);
    }
  }

  async addLoyaltyPoints(userId, points, reason, rideId = null) {
    try {
      await query(`
        INSERT INTO loyalty_points (user_id, points, reason, ride_id)
        VALUES ($1, $2, $3, $4)
      `, [userId, points, reason, rideId]);

      // Update user's total points
      await query(`
        UPDATE users SET loyalty_points = loyalty_points + $1 WHERE id = $2
      `, [points, userId]);

      await cacheService.del(`user:${userId}`);
      return { success: true, pointsAdded: points };
    } catch (error) {
      throw new Error(`Loyalty points addition failed: ${error.message}`);
    }
  }

  async getLoyaltyStatus(userId) {
    try {
      const result = await query(`
        SELECT 
          u.loyalty_points,
          COUNT(lp.id) as total_transactions,
          SUM(CASE WHEN lp.points > 0 THEN lp.points ELSE 0 END) as points_earned,
          SUM(CASE WHEN lp.points < 0 THEN ABS(lp.points) ELSE 0 END) as points_redeemed
        FROM users u
        LEFT JOIN loyalty_points lp ON u.id = lp.user_id
        WHERE u.id = $1
        GROUP BY u.id, u.loyalty_points
      `, [userId]);

      const loyalty = result.rows[0];
      let tier = 'Bronze';
      
      if (loyalty.loyalty_points >= 10000) tier = 'Platinum';
      else if (loyalty.loyalty_points >= 5000) tier = 'Gold';
      else if (loyalty.loyalty_points >= 1000) tier = 'Silver';

      return {
        currentPoints: loyalty.loyalty_points || 0,
        tier,
        totalEarned: loyalty.points_earned || 0,
        totalRedeemed: loyalty.points_redeemed || 0,
        totalTransactions: loyalty.total_transactions || 0
      };
    } catch (error) {
      throw new Error(`Loyalty status fetch failed: ${error.message}`);
    }
  }

  async createReferralCode(userId) {
    try {
      const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      await query(`
        INSERT INTO referral_codes (user_id, code)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET code = $2
      `, [userId, referralCode]);

      return { referralCode, success: true };
    } catch (error) {
      throw new Error(`Referral code creation failed: ${error.message}`);
    }
  }

  async processReferral(newUserId, referralCode) {
    try {
      // Find referrer
      const referrerResult = await query(`
        SELECT user_id FROM referral_codes WHERE code = $1
      `, [referralCode]);

      if (referrerResult.rows.length === 0) {
        throw new Error('Invalid referral code');
      }

      const referrerId = referrerResult.rows[0].user_id;

      // Record referral
      await query(`
        INSERT INTO referrals (referrer_id, referred_id, referral_code)
        VALUES ($1, $2, $3)
      `, [referrerId, newUserId, referralCode]);

      // Award points to both users
      await this.addLoyaltyPoints(referrerId, 500, 'Referral bonus');
      await this.addLoyaltyPoints(newUserId, 200, 'Welcome bonus');

      return { success: true, referrerId };
    } catch (error) {
      throw new Error(`Referral processing failed: ${error.message}`);
    }
  }
}

module.exports = AdvancedFeaturesService;