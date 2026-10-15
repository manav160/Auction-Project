const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { cloudinary } = require('../middleware/uploadMiddleware');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

const formatUserResponse = (user) => ({
  _id: user.id || user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  token: generateToken(user._id || user.id),
});

const extractCloudinaryPublicId = (url) => {
  if (!url) return null;
  try {
    const parts = url.split('/upload/');
    return parts.length >= 2 ? parts[1].replace(/^v\d+\//, '').replace(/\.[^/.]+$/, '') : null;
  } catch {
    return null;
  }
};

// @desc    Register new user
// @route   POST /api/auth/register
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please add all fields' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({ name, email, password: hashedPassword, role: 'user' });
    res.status(201).json(formatUserResponse(user));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (user && (await bcrypt.compare(password, user.password))) {
      return res.json(formatUserResponse(user));
    }

    res.status(400).json({ message: 'Invalid credentials' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user data
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  res.status(200).json(req.user);
};

// @desc    Upload profile photo
// @route   POST /api/auth/avatar
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Please upload an image file' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.avatar) {
      const publicId = extractCloudinaryPublicId(user.avatar);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId).catch((err) =>
          console.error('Failed to delete old avatar:', err.message)
        );
      }
    }

    user.avatar = req.file.path;
    await user.save();

    res.json({ success: true, message: 'Profile photo updated successfully', avatar: user.avatar });
  } catch (error) {
    console.error('Upload Avatar Error:', error);
    res.status(500).json({ message: error.message || 'Failed to upload profile photo' });
  }
};

// @desc    Remove profile photo
// @route   DELETE /api/auth/avatar
const removeAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.avatar) return res.status(400).json({ message: 'No profile photo to remove' });

    const publicId = extractCloudinaryPublicId(user.avatar);
    if (publicId) {
      await cloudinary.uploader.destroy(publicId).catch((err) =>
        console.error('Failed to delete avatar:', err.message)
      );
    }

    user.avatar = null;
    await user.save();

    res.json({ success: true, message: 'Profile photo removed', avatar: null });
  } catch (error) {
    console.error('Remove Avatar Error:', error);
    res.status(500).json({ message: error.message || 'Failed to remove profile photo' });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, email } = req.body;

    if (email && email !== user.email) {
      const emailTaken = await User.findOne({ email });
      if (emailTaken) return res.status(400).json({ message: 'Email is already in use' });
      user.email = email;
    }

    if (name) user.name = name;
    await user.save();

    res.json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Email is already in use' });
    console.error('Update Profile Error:', error);
    res.status(500).json({ message: error.message || 'Failed to update profile' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  uploadAvatar,
  removeAvatar,
  updateProfile,
};
