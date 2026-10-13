const mongoose = require('mongoose');

// Page View Schema - tracks individual page visits
const PageViewSchema = new mongoose.Schema({
  page: {
    type: String,
    required: true,
    index: true
  },
  path: {
    type: String,
    required: true
  },
  title: {
    type: String
  },
  referrer: {
    type: String,
    default: ''
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  visitorId: {
    type: String,
    required: true,
    index: true
  },
  userAgent: {
    type: String
  },
  device: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet'],
    default: 'desktop'
  },
  browser: {
    type: String
  },
  os: {
    type: String
  },
  country: {
    type: String
  },
  city: {
    type: String
  },
  ip: {
    type: String
  },
  duration: {
    type: Number,
    default: 0
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Event Schema - tracks user interactions
const EventSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    enum: ['click', 'scroll', 'form_submit', 'video_play', 'video_pause', 'download', 'share', 'modal_open', 'modal_close', 'navigation', 'search', 'filter', 'custom'],
    index: true
  },
  eventCategory: {
    type: String,
    required: true,
    index: true
  },
  eventAction: {
    type: String,
    required: true
  },
  eventLabel: {
    type: String
  },
  eventValue: {
    type: mongoose.Schema.Types.Mixed
  },
  page: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  visitorId: {
    type: String,
    required: true,
    index: true
  },
  elementId: {
    type: String
  },
  elementClass: {
    type: String
  },
  elementText: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Session Schema - tracks user sessions
const SessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  visitorId: {
    type: String,
    required: true,
    index: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number,
    default: 0
  },
  pageViews: {
    type: Number,
    default: 0
  },
  events: {
    type: Number,
    default: 0
  },
  entryPage: {
    type: String
  },
  exitPage: {
    type: String
  },
  referrer: {
    type: String
  },
  referrerDomain: {
    type: String
  },
  utmSource: {
    type: String
  },
  utmMedium: {
    type: String
  },
  utmCampaign: {
    type: String
  },
  utmTerm: {
    type: String
  },
  utmContent: {
    type: String
  },
  device: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet'],
    default: 'desktop'
  },
  browser: {
    type: String
  },
  os: {
    type: String
  },
  country: {
    type: String
  },
  city: {
    type: String
  },
  ip: {
    type: String
  },
  isNewVisitor: {
    type: Boolean,
    default: true
  },
  isBounce: {
    type: Boolean,
    default: true
  }
});

// Visitor Schema - tracks unique visitors
const VisitorSchema = new mongoose.Schema({
  visitorId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  firstVisit: {
    type: Date,
    default: Date.now
  },
  lastVisit: {
    type: Date,
    default: Date.now
  },
  totalSessions: {
    type: Number,
    default: 1
  },
  totalPageViews: {
    type: Number,
    default: 0
  },
  totalEvents: {
    type: Number,
    default: 0
  },
  device: {
    type: String
  },
  browser: {
    type: String
  },
  os: {
    type: String
  },
  country: {
    type: String
  },
  city: {
    type: String
  }
});

// Daily Stats Schema - aggregated daily statistics
const DailyStatsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
    index: true
  },
  pageViews: {
    type: Number,
    default: 0
  },
  uniqueVisitors: {
    type: Number,
    default: 0
  },
  sessions: {
    type: Number,
    default: 0
  },
  newVisitors: {
    type: Number,
    default: 0
  },
  returningVisitors: {
    type: Number,
    default: 0
  },
  bounceRate: {
    type: Number,
    default: 0
  },
  avgSessionDuration: {
    type: Number,
    default: 0
  },
  avgPageViews: {
    type: Number,
    default: 0
  },
  topPages: [{
    page: String,
    views: Number
  }],
  topReferrers: [{
    referrer: String,
    visits: Number
  }],
  deviceBreakdown: {
    desktop: { type: Number, default: 0 },
    mobile: { type: Number, default: 0 },
    tablet: { type: Number, default: 0 }
  },
  browserBreakdown: {
    type: Map,
    of: Number
  },
  countryBreakdown: {
    type: Map,
    of: Number
  },
  events: {
    type: Map,
    of: Number
  }
});

// Add indexes for better query performance
PageViewSchema.index({ timestamp: -1 });
PageViewSchema.index({ visitorId: 1, timestamp: -1 });
EventSchema.index({ timestamp: -1 });
EventSchema.index({ eventType: 1, timestamp: -1 });
SessionSchema.index({ startTime: -1 });
DailyStatsSchema.index({ date: -1 });

const PageView = mongoose.model('PageView', PageViewSchema);
const Event = mongoose.model('Event', EventSchema);
const Session = mongoose.model('Session', SessionSchema);
const Visitor = mongoose.model('Visitor', VisitorSchema);
const DailyStats = mongoose.model('DailyStats', DailyStatsSchema);

module.exports = {
  PageView,
  Event,
  Session,
  Visitor,
  DailyStats
};
