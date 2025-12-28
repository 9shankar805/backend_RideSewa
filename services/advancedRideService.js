const { Ride, User } = require('../database/models');
const { query } = require('../database/connection');
const MapsService = require('./mapsService');

class AdvancedRideService {
  constructor() {
    this.mapsService = new MapsService();
  }

  async createScheduledRide(rideData, scheduledTime) {
    try {
      const ride = await Ride.create({
        ...rideData,
        scheduled_time: scheduledTime,
        status: 'scheduled'
      });

      // Schedule notification 30 minutes before
      const notifyTime = new Date(scheduledTime.getTime() - 30 * 60 * 1000);
      // In production, use a job queue like Bull for this
      
      return ride;
    } catch (error) {
      throw new Error(`Scheduled ride creation failed: ${error.message}`);
    }
  }

  async createMultiStopRide(rideData, stops) {
    try {
      // Calculate total route through all stops
      let totalDistance = 0;
      let totalDuration = 0;
      const waypoints = [];

      for (let i = 0; i < stops.length - 1; i++) {
        const route = await this.mapsService.calculateRoute(
          { lat: stops[i].latitude, lng: stops[i].longitude },
          { lat: stops[i + 1].latitude, lng: stops[i + 1].longitude }
        );
        totalDistance += route.distance;
        totalDuration += route.duration;
        waypoints.push(stops[i]);
      }

      const estimatedFare = this.mapsService.estimateFare(totalDistance) * 1.2; // 20% markup for multi-stop

      const ride = await Ride.create({
        ...rideData,
        distance_km: totalDistance,
        estimated_duration_minutes: totalDuration,
        estimated_fare: estimatedFare,
        ride_type: 'multi_stop',
        waypoints: JSON.stringify(waypoints)
      });

      return { ride, totalDistance, totalDuration, waypoints };
    } catch (error) {
      throw new Error(`Multi-stop ride creation failed: ${error.message}`);
    }
  }

  async createSharedRide(rideData, maxPassengers = 4) {
    try {
      const estimatedFare = this.mapsService.estimateFare(rideData.distance_km) * 0.7; // 30% discount for sharing

      const ride = await Ride.create({
        ...rideData,
        ride_type: 'shared',
        max_passengers: maxPassengers,
        estimated_fare: estimatedFare,
        current_passengers: 1
      });

      return ride;
    } catch (error) {
      throw new Error(`Shared ride creation failed: ${error.message}`);
    }
  }

  calculateDynamicPricing(baseFare, factors = {}) {
    let multiplier = 1.0;
    
    // Demand factor (1.0 - 2.0)
    if (factors.demand) {
      multiplier *= Math.min(2.0, 1.0 + (factors.demand - 1) * 0.5);
    }

    // Weather factor (1.0 - 1.5)
    if (factors.weather === 'bad') {
      multiplier *= 1.3;
    }

    // Time factor (rush hours)
    const hour = new Date().getHours();
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      multiplier *= 1.2;
    }

    // Supply factor (fewer drivers available)
    if (factors.driverAvailability < 0.3) {
      multiplier *= 1.4;
    }

    return Math.round(baseFare * multiplier * 100) / 100;
  }

  async implementCancellationPolicy(rideId, userId, reason) {
    try {
      const ride = await Ride.findById(rideId);
      if (!ride) throw new Error('Ride not found');

      const now = new Date();
      const rideTime = ride.scheduled_time || ride.created_at;
      const timeDiff = (rideTime - now) / (1000 * 60); // minutes

      let cancellationFee = 0;
      
      // Cancellation policy
      if (ride.status === 'accepted' || ride.status === 'driver_arriving') {
        if (timeDiff < 5) { // Less than 5 minutes
          cancellationFee = ride.estimated_fare * 0.2; // 20% fee
        } else if (timeDiff < 15) { // Less than 15 minutes
          cancellationFee = ride.estimated_fare * 0.1; // 10% fee
        }
      }

      await Ride.updateStatus(rideId, 'cancelled', {
        cancellation_reason: reason,
        cancellation_fee: cancellationFee
      });

      return { cancellationFee, refundAmount: ride.estimated_fare - cancellationFee };
    } catch (error) {
      throw new Error(`Cancellation failed: ${error.message}`);
    }
  }

  async findNearbySharedRides(pickup, destination, maxDetour = 2) {
    try {
      const result = await query(`
        SELECT r.*, u.full_name as passenger_name
        FROM rides r
        JOIN users u ON r.passenger_id = u.id
        WHERE r.ride_type = 'shared' 
        AND r.status IN ('searching', 'accepted')
        AND r.current_passengers < r.max_passengers
        AND (
          (6371 * acos(cos(radians($1)) * cos(radians(r.pickup_latitude)) * 
           cos(radians(r.pickup_longitude) - radians($2)) + 
           sin(radians($1)) * sin(radians(r.pickup_latitude)))) < $3
        )
        ORDER BY 
          (6371 * acos(cos(radians($1)) * cos(radians(r.pickup_latitude)) * 
           cos(radians(r.pickup_longitude) - radians($2)) + 
           sin(radians($1)) * sin(radians(r.pickup_latitude))))
      `, [pickup.lat, pickup.lng, maxDetour]);

      return result.rows;
    } catch (error) {
      throw new Error(`Shared ride search failed: ${error.message}`);
    }
  }

  async joinSharedRide(rideId, passengerId) {
    try {
      const ride = await Ride.findById(rideId);
      if (!ride || ride.current_passengers >= ride.max_passengers) {
        throw new Error('Ride not available for sharing');
      }

      await query(
        'UPDATE rides SET current_passengers = current_passengers + 1 WHERE id = $1',
        [rideId]
      );

      // Create passenger-ride relationship
      await query(
        'INSERT INTO ride_passengers (ride_id, passenger_id) VALUES ($1, $2)',
        [rideId, passengerId]
      );

      return { success: true, currentPassengers: ride.current_passengers + 1 };
    } catch (error) {
      throw new Error(`Join shared ride failed: ${error.message}`);
    }
  }
}

module.exports = AdvancedRideService;