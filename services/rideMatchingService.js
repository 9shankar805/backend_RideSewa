const { DriverProfile, Ride, Bid, User } = require('../database/models');

class RideMatchingService {
  constructor(realTimeService) {
    this.realTimeService = realTimeService;
    this.SEARCH_RADIUS_KM = 15; // Search radius for drivers
    this.MAX_BIDS_PER_RIDE = 10; // Maximum bids allowed per ride
    this.BID_TIMEOUT_MINUTES = 5; // Bid timeout in minutes
  }

  // Create a new ride request
  async createRideRequest(rideData) {
    try {
      // Create ride in database
      const ride = await Ride.create(rideData);
      
      // Find nearby available drivers
      const nearbyDrivers = await DriverProfile.findNearbyDrivers(
        rideData.pickup_latitude,
        rideData.pickup_longitude,
        this.SEARCH_RADIUS_KM
      );

      console.log(`🚗 Found ${nearbyDrivers.length} nearby drivers for ride ${ride.id}`);

      // Emit ride to nearby drivers via WebSocket
      if (nearbyDrivers.length > 0) {
        this.realTimeService.emitNewRide(ride, nearbyDrivers);
        
        // Update ride status to bidding if drivers are available
        await Ride.updateStatus(ride.id, 'bidding');
      }

      return {
        ride,
        nearbyDriversCount: nearbyDrivers.length,
        nearbyDrivers: nearbyDrivers.slice(0, 5) // Return first 5 for display
      };

    } catch (error) {
      console.error('Error creating ride request:', error);
      throw error;
    }
  }

  // Driver submits a bid
  async submitBid(bidData) {
    try {
      const { ride_id, driver_id, proposed_fare, estimated_arrival_minutes, message } = bidData;

      // Check if ride exists and is accepting bids
      const ride = await Ride.findById(ride_id);
      if (!ride) {
        throw new Error('Ride not found');
      }

      if (!['searching', 'bidding'].includes(ride.status)) {
        throw new Error('Ride is no longer accepting bids');
      }

      // Check if driver already bid on this ride
      const existingBids = await Bid.findByRideId(ride_id);
      const driverAlreadyBid = existingBids.some(bid => bid.driver_id === driver_id);
      
      if (driverAlreadyBid) {
        throw new Error('Driver has already submitted a bid for this ride');
      }

      // Check maximum bids limit
      if (existingBids.length >= this.MAX_BIDS_PER_RIDE) {
        throw new Error('Maximum number of bids reached for this ride');
      }

      // Get driver details
      const driver = await User.findById(driver_id);
      const driverProfile = await DriverProfile.findByUserId(driver_id);

      if (!driver || !driverProfile) {
        throw new Error('Driver not found');
      }

      // Create bid
      const bid = await Bid.create({
        ride_id,
        driver_id,
        proposed_fare,
        estimated_arrival_minutes,
        message
      });

      // Update ride status to bidding after first bid
      if (existingBids.length === 0) {
        await Ride.updateStatus(ride_id, 'bidding');
      }

      // Prepare bid data with driver info
      const bidWithDriverInfo = {
        ...bid,
        driverName: driver.full_name,
        driverRating: driver.rating,
        vehicleModel: driverProfile.vehicle_model,
        vehicleColor: driverProfile.vehicle_color,
        vehiclePlate: driverProfile.vehicle_plate,
        eta: estimated_arrival_minutes
      };

      // Emit bid to passenger via WebSocket
      this.realTimeService.emitNewBid(ride_id, bidWithDriverInfo);

      console.log(`💰 New bid: ${driver.full_name} offered NPR ${proposed_fare} for ride ${ride_id}`);

      return bidWithDriverInfo;

    } catch (error) {
      console.error('Error submitting bid:', error);
      throw error;
    }
  }

  // Passenger accepts a bid
  async acceptBid(rideId, bidId, passengerId) {
    try {
      // Verify ride belongs to passenger
      const ride = await Ride.findById(rideId);
      if (!ride || ride.passenger_id !== passengerId) {
        throw new Error('Unauthorized or ride not found');
      }

      if (ride.status !== 'bidding') {
        throw new Error('Ride is not in bidding status');
      }

      // Get bid details
      const bid = await Bid.findById(bidId);
      if (!bid || bid.ride_id !== rideId) {
        throw new Error('Bid not found');
      }

      // Update bid status to accepted
      await Bid.updateStatus(bidId, 'accepted');

      // Reject all other bids for this ride
      const allBids = await Bid.findByRideId(rideId);
      for (const otherBid of allBids) {
        if (otherBid.id !== bidId) {
          await Bid.updateStatus(otherBid.id, 'rejected');
        }
      }

      // Update ride with driver and final fare
      await Ride.updateStatus(rideId, 'accepted', {
        driver_id: bid.driver_id,
        final_fare: bid.proposed_fare
      });

      // Get driver details for response
      const driver = await User.findById(bid.driver_id);
      const driverProfile = await DriverProfile.findByUserId(bid.driver_id);

      // Emit ride status update to all participants
      this.realTimeService.emitRideStatusUpdate(rideId, 'accepted', {
        driverId: bid.driver_id,
        driverName: driver.full_name,
        finalFare: bid.proposed_fare
      });

      console.log(`✅ Bid accepted: ${driver.full_name} for ride ${rideId} at NPR ${bid.proposed_fare}`);

      return {
        ride: await Ride.findById(rideId),
        driver: {
          id: driver.id,
          name: driver.full_name,
          rating: driver.rating,
          phone: driver.phone_number,
          vehicle: {
            model: driverProfile.vehicle_model,
            color: driverProfile.vehicle_color,
            plate: driverProfile.vehicle_plate
          }
        },
        finalFare: bid.proposed_fare
      };

    } catch (error) {
      console.error('Error accepting bid:', error);
      throw error;
    }
  }

  // Get active bids for a ride
  async getRideBids(rideId) {
    try {
      const bids = await Bid.findByRideId(rideId);
      return bids;
    } catch (error) {
      console.error('Error getting ride bids:', error);
      throw error;
    }
  }

  // Cancel a ride
  async cancelRide(rideId, userId, reason) {
    try {
      const ride = await Ride.findById(rideId);
      if (!ride) {
        throw new Error('Ride not found');
      }

      // Check if user is authorized to cancel
      if (ride.passenger_id !== userId && ride.driver_id !== userId) {
        throw new Error('Unauthorized to cancel this ride');
      }

      // Update ride status
      await Ride.updateStatus(rideId, 'cancelled', {
        cancellation_reason: reason
      });

      // Reject all pending bids
      const bids = await Bid.findByRideId(rideId);
      for (const bid of bids) {
        if (bid.status === 'pending') {
          await Bid.updateStatus(bid.id, 'rejected');
        }
      }

      // Emit cancellation to all participants
      this.realTimeService.emitRideStatusUpdate(rideId, 'cancelled', {
        reason,
        cancelledBy: userId
      });

      console.log(`❌ Ride cancelled: ${rideId} by user ${userId}`);

      return { success: true, reason };

    } catch (error) {
      console.error('Error cancelling ride:', error);
      throw error;
    }
  }

  // Start ride (driver arrived and trip begins)
  async startRide(rideId, driverId) {
    try {
      const ride = await Ride.findById(rideId);
      if (!ride || ride.driver_id !== driverId) {
        throw new Error('Unauthorized or ride not found');
      }

      if (ride.status !== 'accepted') {
        throw new Error('Ride cannot be started from current status');
      }

      // Update ride status
      await Ride.updateStatus(rideId, 'in_progress');

      // Emit status update
      this.realTimeService.emitRideStatusUpdate(rideId, 'in_progress');

      console.log(`🚀 Ride started: ${rideId}`);

      return { success: true };

    } catch (error) {
      console.error('Error starting ride:', error);
      throw error;
    }
  }

  // Complete ride
  async completeRide(rideId, driverId, completionData = {}) {
    try {
      const ride = await Ride.findById(rideId);
      if (!ride || ride.driver_id !== driverId) {
        throw new Error('Unauthorized or ride not found');
      }

      if (ride.status !== 'in_progress') {
        throw new Error('Ride is not in progress');
      }

      // Update ride status
      await Ride.updateStatus(rideId, 'completed', completionData);

      // Emit completion
      this.realTimeService.emitRideStatusUpdate(rideId, 'completed', completionData);

      console.log(`🏁 Ride completed: ${rideId}`);

      return { success: true };

    } catch (error) {
      console.error('Error completing ride:', error);
      throw error;
    }
  }

  // Get ride statistics
  async getRideStats() {
    try {
      // This would typically involve complex queries
      // For now, return basic stats
      return {
        totalRides: 0,
        activeRides: 0,
        completedToday: 0,
        averageWaitTime: 0,
        averageRating: 0
      };
    } catch (error) {
      console.error('Error getting ride stats:', error);
      throw error;
    }
  }
}

module.exports = RideMatchingService;