const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { USER_ROLES } = require('../models/User');
const VerificationToken = require('../models/VerificationToken');
const nodemailer = require('nodemailer');

let transporter;
const getTransporter = async () => {
  if (transporter) return transporter;
  // Use environment variables if provided, otherwise Ethereal for testing
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log("Using Ethereal testing account:", testAccount.user);
  }
  return transporter;
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// @desc    Send verification code to email
// @route   POST /api/auth/send-verification-code
exports.sendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide an email' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Remove existing token for this email if any
    await VerificationToken.deleteOne({ email });

    // Save new token
    await VerificationToken.create({ email, token: code });

    // Send email
    const mailTransporter = await getTransporter();
    
    const emailHtml = `
      <div style="font-family: 'Courier New', Courier, monospace; background-color: #F5F5F0; padding: 40px; text-align: center; color: #141414;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border: 4px solid #141414; padding: 40px; text-align: center;">
          <h1 style="font-family: Arial, sans-serif; font-weight: 900; margin-bottom: 5px; text-transform: uppercase;">
            <span style="background-color: #E63946; color: #ffffff; padding: 4px 8px; display: inline-block;">MANGA</span>
            <span style="font-style: italic; margin-left: 5px;">STUDIO</span>
          </h1>
          <p style="font-size: 11px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; color: #666; margin-top: 0;">Creation & Publication Workflow</p>
          
          <div style="margin: 40px 0; border-top: 2px dashed #141414; border-bottom: 2px dashed #141414; padding: 30px 0;">
            <p style="font-weight: bold; margin-bottom: 15px; font-size: 14px;">YOUR VERIFICATION CODE:</p>
            <div style="font-size: 42px; font-weight: 900; letter-spacing: 8px; color: #E63946; margin-left: 8px;">${code}</div>
          </div>
          
          <p style="font-size: 13px; font-weight: bold; font-family: Arial, sans-serif;">⚠️ This code will expire in 10 minutes.</p>
          <p style="font-size: 11px; color: #888; margin-top: 30px; font-family: Arial, sans-serif;">If you did not request this registration, please ignore this email.</p>
        </div>
      </div>
    `;

    const info = await mailTransporter.sendMail({
      from: '"Manga Studio" <noreply@mangaka.com>',
      to: email,
      subject: "Manga Studio - Registration Verification Code",
      text: `Your verification code is: ${code}. It will expire in 10 minutes.`,
      html: emailHtml,
    });

    console.log("Message sent: %s", info.messageId);
    if (!process.env.EMAIL_USER) {
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    }

    res.status(200).json({
      success: true,
      message: 'Verification code sent to email',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, verificationCode } = req.body;
    const publicRoles = USER_ROLES;

    if (!publicRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: `Public registration only supports: ${publicRoles.join(', ')}`,
      });
    }


    if (!verificationCode) {
      return res.status(400).json({
        success: false,
        message: 'Verification code is required',
      });
    }

    // Verify token
    const tokenRecord = await VerificationToken.findOne({ email, token: verificationCode });
    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
      });
    }

    const user = await User.create({ name, email, password, role });
    
    // Delete verification token after successful registration
    await VerificationToken.deleteOne({ email });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || '',
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }
    if (user.isActive === false || user.deletedAt) {
      return res.status(403).json({
        success: false,
        message: 'This account is inactive',
      });
    }


    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || '',
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
