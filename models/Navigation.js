const mongoose = require('mongoose');

const NavigationItemSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['route', 'scroll', 'external'],
    default: 'route'
  },
  route: String,      // For type: 'route'
  target: String,     // For type: 'scroll'
  externalUrl: String, // For type: 'external'
  icon: String,
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: true });

const NavigationSchema = new mongoose.Schema({
  // Main navigation (shown directly in navbar)
  mainNavigation: [NavigationItemSchema],
  
  // Dropdown navigation (shown in "More" dropdown)
  dropdownNavigation: [NavigationItemSchema],
  
  // Footer navigation
  footerNavigation: [NavigationItemSchema],
  
  // Quick links for footer
  quickLinks: [NavigationItemSchema],
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Ensure only one navigation document exists
NavigationSchema.statics.getInfo = async function() {
  let info = await this.findOne();
  if (!info) {
    info = await this.create({
      mainNavigation: [
        { label: 'Home', route: '/', type: 'route', order: 0 },
        { label: 'About', target: 'about', type: 'scroll', order: 1 },
        { label: 'Films', target: 'films', type: 'scroll', order: 2 },
        { label: 'News', target: 'news', type: 'scroll', order: 3 },
        { label: 'Contact', target: 'contact', type: 'scroll', order: 4 }
      ],
      dropdownNavigation: [
        { label: 'The Company', route: '/the-company', icon: 'building', order: 0 },
        { label: 'Our Team', route: '/team', icon: 'users', order: 1 },
        { label: 'Licensing', route: '/licensing', icon: 'document', order: 2 },
        { label: 'Partners', route: '/partners', icon: 'handshake', order: 3 },
        { label: 'All News', route: '/all-news', icon: 'newspaper', order: 4 },
        { label: 'Social Feed', route: '/feed', icon: 'collection', order: 5 }
      ]
    });
  }
  return info;
};

module.exports = mongoose.model('Navigation', NavigationSchema);
