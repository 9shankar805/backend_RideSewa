const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { query } = require('../database/connection');

class PaymentService {
  static async createPaymentIntent(amount, currency = 'usd', metadata = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata,
        automatic_payment_methods: { enabled: true }
      });
      
      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      };
    } catch (error) {
      throw new Error(`Payment creation failed: ${error.message}`);
    }
  }

  static async confirmPayment(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent.status === 'succeeded';
    } catch (error) {
      throw new Error(`Payment confirmation failed: ${error.message}`);
    }
  }

  static async processRidePayment(rideId, amount, paymentMethod = 'card') {
    try {
      if (paymentMethod === 'cash') {
        await query(
          'UPDATE rides SET payment_status = $1 WHERE id = $2',
          ['pending', rideId]
        );
        return { success: true, method: 'cash' };
      }

      const paymentIntent = await this.createPaymentIntent(amount, 'usd', { rideId });
      
      await query(
        'UPDATE rides SET payment_status = $1, payment_intent_id = $2 WHERE id = $3',
        ['processing', paymentIntent.paymentIntentId, rideId]
      );

      return {
        success: true,
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.paymentIntentId
      };
    } catch (error) {
      throw new Error(`Ride payment failed: ${error.message}`);
    }
  }

  static async handleWebhook(event) {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          const rideId = paymentIntent.metadata.rideId;
          
          if (rideId) {
            await query(
              'UPDATE rides SET payment_status = $1 WHERE id = $2',
              ['paid', rideId]
            );
          }
          break;

        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object;
          const failedRideId = failedPayment.metadata.rideId;
          
          if (failedRideId) {
            await query(
              'UPDATE rides SET payment_status = $1 WHERE id = $2',
              ['failed', failedRideId]
            );
          }
          break;
      }
    } catch (error) {
      console.error('Webhook handling failed:', error);
    }
  }

  static async calculateCommission(amount, rate = 0.15) {
    const commission = amount * rate;
    const driverEarnings = amount - commission;
    
    return {
      grossAmount: amount,
      commission,
      driverEarnings
    };
  }
}

module.exports = PaymentService;