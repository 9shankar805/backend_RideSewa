const { query, transaction } = require('./connection');
const { v4: uuidv4 } = require('uuid');

// User Model
class User {
  static async create(userData) {
    const { phone_number, email, full_name, user_type, profile_image_url } = userData;
    const id = uuidv4();
    
    const result = await query(
      `INSERT INTO users (id, phone_number, email, full_name, user_type, profile_image_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, phone_number, email, full_name, user_type, profile_image_url]
    );
    
    return result.rows[0];
  }

  static async findByEmail(email) {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  }

  static async findByPhone(phone_number) {
    const result = await query('SELECT * FROM users WHERE phone_number = $1', [phone_number]);
    return result.rows[0];
  }

  static async findById(id) {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async updateRating(userId, newRating) {
    await query(
      `UPDATE users SET 
       rating = (rating * total_ratings + $2) / (total_ratings + 1),
       total_ratings = total_ratings + 1
       WHERE id = $1`,
      [userId, newRating]
    );
  }
}

// Driver Profile Model
class DriverProfile {
  static async create(driverData) {
    const {
      user_id, license_number, license_expiry, license_image_url,
      vehicle_registration, vehicle_model, vehicle_color, vehicle_plate,
      vehicle_year, vehicle_image_url, insurance_number, insurance_expiry
    } = driverData;
    
    const id = uuidv4();
    
    const result = await query(
      `INSERT INTO driver_profiles (
        id, user_id, license_number, license_expiry, license_image_url,
        vehicle_registration, vehicle_model, vehicle_color, vehicle_plate,
        vehicle_year, vehicle_image_url, insurance_number, insurance_expiry
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [id, user_id, license_number, license_expiry, license_image_url,
       vehicle_registration, vehicle_model, vehicle_color, vehicle_plate,
       vehicle_year, vehicle_image_url, insurance_number, insurance_expiry]
    );
    
    return result.rows[0];
  }

  static async findByUserId(user_id) {
    const result = await query('SELECT * FROM driver_profiles WHERE user_id = $1', [user_id]);
    return result.rows[0];
  }

  static async updateLocation(user_id, latitude, longitude) {
    await query(
      `UPDATE driver_profiles SET 
       current_latitude = $2, 
       current_longitude = $3, 
       last_location_update = NOW()
       WHERE user_id = $1`,
      [user_id, latitude, longitude]
    );
  }

  static async updateStatus(user_id, is_online, is_available) {
    await query(
      `UPDATE driver_profiles SET 
       is_online = $2, 
       is_available = $3
       WHERE user_id = $1`,
      [user_id, is_online, is_available]
    );
  }

  static async findNearbyDrivers(latitude, longitude, radius_km = 10) {
    const result = await query(
      `SELECT dp.*, u.full_name, u.rating, u.profile_image_url,
       (6371 * acos(cos(radians($1)) * cos(radians(dp.current_latitude)) * 
        cos(radians(dp.current_longitude) - radians($2)) + 
        sin(radians($1)) * sin(radians(dp.current_latitude)))) AS distance
       FROM driver_profiles dp
       JOIN users u ON dp.user_id = u.id
       WHERE dp.is_online = true AND dp.is_available = true
       AND dp.current_latitude IS NOT NULL AND dp.current_longitude IS NOT NULL
       HAVING distance < $3
       ORDER BY distance`,
      [latitude, longitude, radius_km]
    );
    
    return result.rows;
  }
}

// Ride Model
class Ride {
  static async create(rideData) {
    const {
      passenger_id, pickup_latitude, pickup_longitude, pickup_address,
      destination_latitude, destination_longitude, destination_address,
      proposed_fare, distance_km, estimated_duration_minutes, ride_type
    } = rideData;
    
    const id = uuidv4();
    
    const result = await query(
      `INSERT INTO rides (
        id, passenger_id, pickup_latitude, pickup_longitude, pickup_address,
        destination_latitude, destination_longitude, destination_address,
        proposed_fare, distance_km, estimated_duration_minutes, ride_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [id, passenger_id, pickup_latitude, pickup_longitude, pickup_address,
       destination_latitude, destination_longitude, destination_address,
       proposed_fare, distance_km, estimated_duration_minutes, ride_type]
    );
    
    return result.rows[0];
  }

  static async findById(id) {
    const result = await query('SELECT * FROM rides WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async updateStatus(id, status, additional_data = {}) {
    const fields = ['status = $2'];
    const values = [id, status];
    let paramCount = 2;

    if (additional_data.driver_id) {
      fields.push(`driver_id = $${++paramCount}`);
      values.push(additional_data.driver_id);
    }

    if (additional_data.final_fare) {
      fields.push(`final_fare = $${++paramCount}`);
      values.push(additional_data.final_fare);
    }

    if (status === 'in_progress') {
      fields.push(`started_at = NOW()`);
    } else if (status === 'completed') {
      fields.push(`completed_at = NOW()`);
    } else if (status === 'cancelled') {
      fields.push(`cancelled_at = NOW()`);
      if (additional_data.cancellation_reason) {
        fields.push(`cancellation_reason = $${++paramCount}`);
        values.push(additional_data.cancellation_reason);
      }
    }

    await query(
      `UPDATE rides SET ${fields.join(', ')} WHERE id = $1`,
      values
    );
  }

  static async findActiveRides() {
    const result = await query(
      `SELECT r.*, u.full_name as passenger_name, u.phone_number as passenger_phone
       FROM rides r
       JOIN users u ON r.passenger_id = u.id
       WHERE r.status IN ('searching', 'bidding')
       ORDER BY r.created_at DESC`
    );
    
    return result.rows;
  }
}

// Bid Model
class Bid {
  static async create(bidData) {
    const {
      ride_id, driver_id, proposed_fare, estimated_arrival_minutes, message
    } = bidData;
    
    const id = uuidv4();
    
    const result = await query(
      `INSERT INTO bids (id, ride_id, driver_id, proposed_fare, estimated_arrival_minutes, message)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, ride_id, driver_id, proposed_fare, estimated_arrival_minutes, message]
    );
    
    return result.rows[0];
  }

  static async findByRideId(ride_id) {
    const result = await query(
      `SELECT b.*, u.full_name as driver_name, u.rating as driver_rating,
       dp.vehicle_model, dp.vehicle_color, dp.vehicle_plate
       FROM bids b
       JOIN users u ON b.driver_id = u.id
       JOIN driver_profiles dp ON u.id = dp.user_id
       WHERE b.ride_id = $1 AND b.status = 'pending'
       ORDER BY b.created_at ASC`,
      [ride_id]
    );
    
    return result.rows;
  }

  static async updateStatus(id, status) {
    await query('UPDATE bids SET status = $2 WHERE id = $1', [id, status]);
  }

  static async findById(id) {
    const result = await query('SELECT * FROM bids WHERE id = $1', [id]);
    return result.rows[0];
  }
}

// Location Update Model
class LocationUpdate {
  static async create(locationData) {
    const {
      user_id, ride_id, latitude, longitude, heading, speed_kmh, accuracy_meters
    } = locationData;
    
    const id = uuidv4();
    
    await query(
      `INSERT INTO location_updates (
        id, user_id, ride_id, latitude, longitude, heading, speed_kmh, accuracy_meters
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, user_id, ride_id, latitude, longitude, heading, speed_kmh, accuracy_meters]
    );
  }

  static async getLatestByRide(ride_id) {
    const result = await query(
      `SELECT * FROM location_updates 
       WHERE ride_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [ride_id]
    );
    
    return result.rows;
  }
}

// Notification Model
class Notification {
  static async create(notificationData) {
    const { user_id, title, message, type, data } = notificationData;
    const id = uuidv4();
    
    const result = await query(
      `INSERT INTO notifications (id, user_id, title, message, type, data)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, user_id, title, message, type, JSON.stringify(data)]
    );
    
    return result.rows[0];
  }

  static async findByUserId(user_id, limit = 50) {
    const result = await query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [user_id, limit]
    );
    
    return result.rows;
  }

  static async markAsRead(id) {
    await query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
  }
}

module.exports = {
  User,
  DriverProfile,
  Ride,
  Bid,
  LocationUpdate,
  Notification
};