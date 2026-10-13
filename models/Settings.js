const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  // Site-wide settings
  siteName: {
    type: String,
    default: 'WHITE PANDA CREATIONS'
  },
  siteDescription: String,
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  maintenanceMessage: String,
  
  // Theme settings
  theme: {
    type: String,
    enum: ['dark', 'light'],
    default: 'dark'
  },
  
  // Homepage settings
  showSplashScreen: {
    type: Boolean,
    default: true
  },
  splashDuration: {
    type: Number,
    default: 3000
  },
  splashScreenVariant: {
    type: String,
    enum: ['galaxy', 'film-reel', 'cinematic', 'minimal'],
    default: 'galaxy'
  },
  splashScreenTheme: {
    type: String,
    enum: ['auto', 'light', 'dark'],
    default: 'auto'
  },
  // Show splash screen only once per user (uses localStorage)
  splashShowOnce: {
    type: Boolean,
    default: false
  },
  heroAutoSlide: {
    type: Boolean,
    default: true
  },
  heroSlideInterval: {
    type: Number,
    default: 5000
  },
  
  // Display limits
  homeNewsLimit: {
    type: Number,
    default: 4
  },
  homeMoviesLimit: {
    type: Number,
    default: 6
  },
  homeTeamLimit: {
    type: Number,
    default: 4
  },
  
  // Section visibility controls
  sections: {
    home: {
      type: Boolean,
      default: true
    },
    about: {
      type: Boolean,
      default: true
    },
    films: {
      type: Boolean,
      default: true
    },
    news: {
      type: Boolean,
      default: true
    },
    contact: {
      type: Boolean,
      default: true
    },
    // More dropdown items (individual controls)
    theCompany: {
      type: Boolean,
      default: true
    },
    team: {
      type: Boolean,
      default: true
    },
    licensing: {
      type: Boolean,
      default: true
    },
    partners: {
      type: Boolean,
      default: true
    },
    allNews: {
      type: Boolean,
      default: true
    },
    careers: {
      type: Boolean,
      default: true
    },
    feed: {
      type: Boolean,
      default: true
    }
  },
  
  // SEO defaults
  defaultSeoTitle: String,
  defaultSeoDescription: String,
  defaultSeoKeywords: [String],
  
  // Analytics
  enableAnalytics: {
    type: Boolean,
    default: true
  },
  googleAnalyticsId: String,
  facebookPixelId: String,
  
  // Contact form settings
  contactEmail: String,
  enableContactForm: {
    type: Boolean,
    default: true
  },
  
  // Social media settings
  socialLinksFooter: {
    type: Boolean,
    default: true
  },
  
  // Cache settings
  cacheEnabled: {
    type: Boolean,
    default: true
  },
  cacheDuration: {
    type: Number,
    default: 3600 // 1 hour in seconds
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
SettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('Settings', SettingsSchema);
