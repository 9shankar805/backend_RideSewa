const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { query } = require('../database/connection');

class CommunicationService {
  constructor() {
    // Email transporter - only initialize if credentials are provided
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      this.emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });
      this.emailEnabled = true;
    } else {
      console.log('⚠️  Email not configured - email notifications disabled');
      this.emailEnabled = false;
    }

    // Twilio client - only initialize if credentials are provided
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      this.smsEnabled = true;
    } else {
      console.log('⚠️  Twilio not configured - SMS notifications disabled');
      this.smsEnabled = false;
    }
  }

  async sendSMS(phoneNumber, message) {
    try {
      if (!this.smsEnabled) {
        console.log('SMS disabled - message stored only:', message);
        return { success: true, method: 'disabled' };
      }

      const result = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      return { success: true, messageId: result.sid };
    } catch (error) {
      throw new Error(`SMS sending failed: ${error.message}`);
    }
  }

  async sendEmail(to, subject, html, text = null) {
    try {
      if (!this.emailEnabled) {
        console.log('Email disabled - message stored only:', subject);
        return { success: true, method: 'disabled' };
      }

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, '')
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  async sendRideConfirmationSMS(phoneNumber, rideDetails) {
    const message = `Ride confirmed! Driver: ${rideDetails.driverName}, Vehicle: ${rideDetails.vehicleModel} (${rideDetails.vehiclePlate}). ETA: ${rideDetails.eta} minutes.`;
    return await this.sendSMS(phoneNumber, message);
  }

  async sendDriverArrivalSMS(phoneNumber, driverName) {
    const message = `Your driver ${driverName} has arrived at the pickup location.`;
    return await this.sendSMS(phoneNumber, message);
  }

  async sendRideCompletedEmail(email, rideDetails) {
    const html = `
      <h2>Ride Completed</h2>
      <p>Thank you for using our service!</p>
      <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0;">
        <h3>Ride Details</h3>
        <p><strong>From:</strong> ${rideDetails.pickupAddress}</p>
        <p><strong>To:</strong> ${rideDetails.destinationAddress}</p>
        <p><strong>Distance:</strong> ${rideDetails.distance} km</p>
        <p><strong>Duration:</strong> ${rideDetails.duration} minutes</p>
        <p><strong>Fare:</strong> $${rideDetails.fare}</p>
        <p><strong>Driver:</strong> ${rideDetails.driverName}</p>
      </div>
      <p>We hope you had a great experience!</p>
    `;

    return await this.sendEmail(email, 'Ride Completed - Receipt', html);
  }

  async sendDriverVerificationEmail(email, driverName, status) {
    const statusMessages = {
      approved: 'Congratulations! Your driver application has been approved.',
      rejected: 'Unfortunately, your driver application has been rejected.',
      pending: 'Your driver application is under review.'
    };

    const html = `
      <h2>Driver Application Update</h2>
      <p>Hello ${driverName},</p>
      <p>${statusMessages[status]}</p>
      ${status === 'approved' ? '<p>You can now start accepting ride requests!</p>' : ''}
      ${status === 'rejected' ? '<p>Please contact support for more information.</p>' : ''}
    `;

    return await this.sendEmail(email, 'Driver Application Status', html);
  }

  async createSupportTicket(userId, subject, message, priority = 'medium') {
    try {
      const ticketId = require('uuid').v4();
      
      await query(`
        INSERT INTO support_tickets (id, user_id, subject, message, priority, status)
        VALUES ($1, $2, $3, $4, $5, 'open')
      `, [ticketId, userId, subject, message, priority]);

      // Send confirmation email
      const user = await query('SELECT email, full_name FROM users WHERE id = $1', [userId]);
      if (user.rows[0]?.email) {
        await this.sendEmail(
          user.rows[0].email,
          `Support Ticket Created - ${ticketId.substring(0, 8)}`,
          `
            <h2>Support Ticket Created</h2>
            <p>Hello ${user.rows[0].full_name},</p>
            <p>Your support ticket has been created successfully.</p>
            <p><strong>Ticket ID:</strong> ${ticketId.substring(0, 8)}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p>We will respond to your inquiry within 24 hours.</p>
          `
        );
      }

      return { ticketId, success: true };
    } catch (error) {
      throw new Error(`Support ticket creation failed: ${error.message}`);
    }
  }

  async sendInAppMessage(fromUserId, toUserId, message, rideId = null) {
    try {
      const messageId = require('uuid').v4();
      
      await query(`
        INSERT INTO messages (id, from_user_id, to_user_id, message, ride_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [messageId, fromUserId, toUserId, message, rideId]);

      return { messageId, success: true };
    } catch (error) {
      throw new Error(`In-app message sending failed: ${error.message}`);
    }
  }

  async getRideMessages(rideId) {
    try {
      const result = await query(`
        SELECT m.*, u.full_name as sender_name
        FROM messages m
        JOIN users u ON m.from_user_id = u.id
        WHERE m.ride_id = $1
        ORDER BY m.created_at ASC
      `, [rideId]);

      return result.rows;
    } catch (error) {
      throw new Error(`Fetching ride messages failed: ${error.message}`);
    }
  }

  async getUserMessages(userId, limit = 50) {
    try {
      const result = await query(`
        SELECT m.*, u.full_name as sender_name
        FROM messages m
        JOIN users u ON m.from_user_id = u.id
        WHERE m.to_user_id = $1
        ORDER BY m.created_at DESC
        LIMIT $2
      `, [userId, limit]);

      return result.rows;
    } catch (error) {
      throw new Error(`Fetching user messages failed: ${error.message}`);
    }
  }
}

module.exports = CommunicationService;