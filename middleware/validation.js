const Joi = require('joi');

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details[0].message
      });
    }
    next();
  };
};

const schemas = {
  googleAuth: Joi.object({
    googleToken: Joi.string().required(),
    userType: Joi.string().valid('passenger', 'driver').default('passenger')
  }),

  createRide: Joi.object({
    pickup_latitude: Joi.number().min(-90).max(90).required(),
    pickup_longitude: Joi.number().min(-180).max(180).required(),
    pickup_address: Joi.string().required(),
    destination_latitude: Joi.number().min(-90).max(90).required(),
    destination_longitude: Joi.number().min(-180).max(180).required(),
    destination_address: Joi.string().required(),
    proposed_fare: Joi.number().min(0).required(),
    ride_type: Joi.string().valid('standard', 'premium', 'shared').default('standard')
  }),

  driverLocation: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
  }),

  submitBid: Joi.object({
    proposedFare: Joi.number().min(0).required(),
    eta: Joi.number().min(1).max(60).required(),
    message: Joi.string().max(200).optional()
  })
};

module.exports = { validateRequest, schemas };