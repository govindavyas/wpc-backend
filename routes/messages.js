const express = require('express');
const { body, query } = require('express-validator');
const Message = require('../models/Message');
const { protect, authorize } = require('../middleware/auth');
const { validate, asyncHandler } = require('../middleware/helpers');

const router = express.Router();

/**
 * @route   POST /api/v1/messages
 * @desc    Create a new message (from contact form)
 * @access  Public
 */
router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').trim().isEmail().withMessage('Valid email is required'),
    body('subject').trim().notEmpty().withMessage('Subject is required').isLength({ max: 200 }),
    body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 5000 })
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, email, subject, message } = req.body;
    
    // Get IP and user agent for tracking
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    const newMessage = await Message.create({
      name,
      email,
      subject,
      message,
      ipAddress,
      userAgent
    });
    
    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        id: newMessage._id
      }
    });
  })
);

/**
 * @route   GET /api/v1/messages
 * @desc    Get all messages (admin)
 * @access  Private (Admin/Editor)
 */
router.get('/',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      filter = 'all', // all, unread, read, starred, archived
      sort = '-createdAt',
      search
    } = req.query;
    
    // Build query
    const queryObj = {};
    
    switch (filter) {
      case 'unread':
        queryObj.isRead = false;
        queryObj.isArchived = false;
        break;
      case 'read':
        queryObj.isRead = true;
        queryObj.isArchived = false;
        break;
      case 'starred':
        queryObj.isStarred = true;
        queryObj.isArchived = false;
        break;
      case 'archived':
        queryObj.isArchived = true;
        break;
      default:
        queryObj.isArchived = false;
    }
    
    if (search) {
      queryObj.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [messages, total, unreadCount] = await Promise.all([
      Message.find(queryObj)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('readBy', 'name'),
      Message.countDocuments(queryObj),
      Message.getUnreadCount()
    ]);
    
    res.json({
      success: true,
      count: messages.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      unreadCount,
      data: messages
    });
  })
);

/**
 * @route   GET /api/v1/messages/unread-count
 * @desc    Get unread message count
 * @access  Private (Admin/Editor)
 */
router.get('/unread-count',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    const count = await Message.getUnreadCount();
    const recentUnread = await Message.getRecentUnread(5);
    
    res.json({
      success: true,
      data: {
        count,
        recent: recentUnread
      }
    });
  })
);

/**
 * @route   GET /api/v1/messages/:id
 * @desc    Get single message
 * @access  Private (Admin/Editor)
 */
router.get('/:id',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    const message = await Message.findById(req.params.id).populate('readBy', 'name');
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    // Mark as read if not already
    if (!message.isRead) {
      message.isRead = true;
      message.readAt = new Date();
      message.readBy = req.user._id;
      await message.save();
    }
    
    res.json({
      success: true,
      data: message
    });
  })
);

/**
 * @route   PUT /api/v1/messages/:id/read
 * @desc    Mark message as read/unread
 * @access  Private (Admin/Editor)
 */
router.put('/:id/read',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    message.isRead = !message.isRead;
    if (message.isRead) {
      message.readAt = new Date();
      message.readBy = req.user._id;
    } else {
      message.readAt = null;
      message.readBy = null;
    }
    await message.save();
    
    res.json({
      success: true,
      data: message
    });
  })
);

/**
 * @route   PUT /api/v1/messages/:id/star
 * @desc    Toggle star on message
 * @access  Private (Admin/Editor)
 */
router.put('/:id/star',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    message.isStarred = !message.isStarred;
    await message.save();
    
    res.json({
      success: true,
      data: message
    });
  })
);

/**
 * @route   PUT /api/v1/messages/:id/archive
 * @desc    Toggle archive on message
 * @access  Private (Admin/Editor)
 */
router.put('/:id/archive',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    message.isArchived = !message.isArchived;
    await message.save();
    
    res.json({
      success: true,
      data: message
    });
  })
);

/**
 * @route   PUT /api/v1/messages/:id/notes
 * @desc    Update notes on message
 * @access  Private (Admin/Editor)
 */
router.put('/:id/notes',
  protect,
  authorize('admin', 'editor'),
  [
    body('notes').trim().isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { notes: req.body.notes },
      { new: true, runValidators: true }
    );
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    res.json({
      success: true,
      data: message
    });
  })
);

/**
 * @route   PUT /api/v1/messages/mark-all-read
 * @desc    Mark all messages as read
 * @access  Private (Admin/Editor)
 */
router.put('/mark-all-read',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    await Message.updateMany(
      { isRead: false },
      { 
        isRead: true, 
        readAt: new Date(), 
        readBy: req.user._id 
      }
    );
    
    res.json({
      success: true,
      message: 'All messages marked as read'
    });
  })
);

/**
 * @route   DELETE /api/v1/messages/:id
 * @desc    Delete message
 * @access  Private (Admin only)
 */
router.delete('/:id',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }
    
    await message.deleteOne();
    
    res.json({
      success: true,
      message: 'Message deleted'
    });
  })
);

module.exports = router;
