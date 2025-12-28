const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { User } = require('../database/models');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const verifyGoogleToken = async (token) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload();
  } catch (error) {
    throw new Error('Invalid Google token');
  }
};

const googleAuth = async (req, res) => {
  try {
    const { googleToken, userType } = req.body;
    
    const googleUser = await verifyGoogleToken(googleToken);
    
    let user = await User.findByEmail(googleUser.email);
    
    if (!user) {
      user = await User.create({
        email: googleUser.email,
        full_name: googleUser.name,
        profile_image_url: googleUser.picture,
        user_type: userType || 'passenger',
        phone_number: null,
        is_verified: true
      });
    }
    
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, type: user.user_type },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        user_type: user.user_type,
        profile_image_url: user.profile_image_url
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = { googleAuth, verifyGoogleToken };