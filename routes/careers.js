const express = require('express');
const router = express.Router();
const { Career } = require('../models');
const { protect } = require('../middleware/auth');

// Get all careers (public - only active ones)
router.get('/public', async (req, res) => {
  try {
    const careers = await Career.find({
      isActive: true,
      $or: [
        { applicationDeadline: null },
        { applicationDeadline: { $gte: new Date() } }
      ]
    }).sort({ displayOrder: 1, createdAt: -1 });
    
    res.json(careers);
  } catch (error) {
    console.error('Error fetching public careers:', error);
    res.status(500).json({ error: 'Failed to fetch careers' });
  }
});

// Get all careers (admin)
router.get('/', protect, async (req, res) => {
  try {
    const careers = await Career.find().sort({ displayOrder: 1, createdAt: -1 });
    res.json(careers);
  } catch (error) {
    console.error('Error fetching careers:', error);
    res.status(500).json({ error: 'Failed to fetch careers' });
  }
});

// Get single career by ID (public)
router.get('/public/:id', async (req, res) => {
  try {
    const career = await Career.findById(req.params.id);
    if (!career) {
      return res.status(404).json({ error: 'Career not found' });
    }
    res.json(career);
  } catch (error) {
    console.error('Error fetching career:', error);
    res.status(500).json({ error: 'Failed to fetch career' });
  }
});

// Get single career by ID (admin)
router.get('/:id', protect, async (req, res) => {
  try {
    const career = await Career.findById(req.params.id);
    if (!career) {
      return res.status(404).json({ error: 'Career not found' });
    }
    res.json(career);
  } catch (error) {
    console.error('Error fetching career:', error);
    res.status(500).json({ error: 'Failed to fetch career' });
  }
});

// Create career
router.post('/', protect, async (req, res) => {
  try {
    const career = await Career.create(req.body);
    res.status(201).json(career);
  } catch (error) {
    console.error('Error creating career:', error);
    res.status(500).json({ error: 'Failed to create career' });
  }
});

// Update career
router.put('/:id', protect, async (req, res) => {
  try {
    const career = await Career.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!career) {
      return res.status(404).json({ error: 'Career not found' });
    }
    
    res.json(career);
  } catch (error) {
    console.error('Error updating career:', error);
    res.status(500).json({ error: 'Failed to update career' });
  }
});

// Delete career
router.delete('/:id', protect, async (req, res) => {
  try {
    const career = await Career.findByIdAndDelete(req.params.id);
    
    if (!career) {
      return res.status(404).json({ error: 'Career not found' });
    }
    
    res.json({ message: 'Career deleted successfully' });
  } catch (error) {
    console.error('Error deleting career:', error);
    res.status(500).json({ error: 'Failed to delete career' });
  }
});

// Update display order
router.put('/:id/order', protect, async (req, res) => {
  try {
    const { displayOrder } = req.body;
    const career = await Career.findByIdAndUpdate(
      req.params.id,
      { displayOrder },
      { new: true }
    );
    
    if (!career) {
      return res.status(404).json({ error: 'Career not found' });
    }
    
    res.json(career);
  } catch (error) {
    console.error('Error updating display order:', error);
    res.status(500).json({ error: 'Failed to update display order' });
  }
});

module.exports = router;
