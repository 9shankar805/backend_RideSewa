const admin = require('firebase-admin');
const { Notification } = require('../database/models');

class NotificationService {
  constructor() {
    // Only initialize Firebase if credentials are provided
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          }),
        });
      }
      this.firebaseEnabled = true;
    } else {
      console.log('⚠️  Firebase not configured - notifications will be stored in database only');
      this.firebaseEnabled = false;
    }
  }

  async sendToUser(userId, notification, data = {}) {
    try {
      // Store notification in database
      await Notification.create({
        user_id: userId,
        title: notification.title,
        message: notification.body,
        type: data.type || 'general',
        data
      });

      // Send push notification only if Firebase is enabled
      if (this.firebaseEnabled) {
        const message = {
          notification,
          data: {
            ...data,
            userId,
            timestamp: new Date().toISOString()
          },
          topic: `user_${userId}` // Mobile app subscribes to this topic
        };

        const response = await admin.messaging().send(message);
        console.log('Notification sent:', response);
        return response;
      } else {
        console.log('Notification stored in database (Firebase disabled)');
        return { success: true, method: 'database_only' };
      }
    } catch (error) {
      console.error('Notification failed:', error);
      throw error;
    }
  }

  async sendRideUpdate(rideId, userId, status, additionalData = {}) {
    const notifications = {
      searching: {
        title: 'Looking for drivers',
        body: 'We are finding the best drivers for your ride'
      },
      bidding: {
        title: 'Drivers are bidding',
        body: 'Multiple drivers are interested in your ride'
      },
      accepted: {
        title: 'Ride confirmed!',
        body: 'Your driver is on the way'
      },
      driver_arriving: {
        title: 'Driver arriving',
        body: 'Your driver will arrive in 2-3 minutes'
      },
      in_progress: {
        title: 'Ride started',
        body: 'Enjoy your ride! You can track your journey'
      },
      completed: {
        title: 'Ride completed',
        body: 'Thank you for riding with us!'
      },
      cancelled: {
        title: 'Ride cancelled',
        body: 'Your ride has been cancelled'
      }
    };

    const notification = notifications[status];
    if (notification) {
      await this.sendToUser(userId, notification, {
        type: 'ride_update',
        rideId,
        status,
        ...additionalData
      });
    }
  }

  async sendDriverNotification(driverId, type, data = {}) {
    const notifications = {
      new_ride: {
        title: 'New ride request',
        body: 'A passenger is looking for a ride nearby'
      },
      bid_accepted: {
        title: 'Bid accepted!',
        body: 'Your bid was accepted. Head to pickup location'
      },
      ride_cancelled: {
        title: 'Ride cancelled',
        body: 'The passenger cancelled the ride'
      }
    };

    const notification = notifications[type];
    if (notification) {
      await this.sendToUser(driverId, notification, {
        type: 'driver_notification',
        notificationType: type,
        ...data
      });
    }
  }

  async sendPromotionalNotification(userIds, title, body, data = {}) {
    try {
      const promises = userIds.map(userId => 
        this.sendToUser(userId, { title, body }, {
          type: 'promotional',
          ...data
        })
      );
      
      await Promise.all(promises);
      return { success: true, sent: userIds.length };
    } catch (error) {
      throw new Error(`Promotional notification failed: ${error.message}`);
    }
  }
}

module.exports = NotificationService;