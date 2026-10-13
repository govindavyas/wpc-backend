const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { PageView, Event, Session, Visitor, DailyStats } = require('../models/Analytics');
const UAParser = require('ua-parser-js');

// Helper to parse user agent
const parseUserAgent = (userAgentString) => {
  const parser = new UAParser(userAgentString);
  const result = parser.getResult();
  
  let device = 'desktop';
  if (result.device.type === 'mobile') device = 'mobile';
  else if (result.device.type === 'tablet') device = 'tablet';
  
  return {
    device,
    browser: result.browser.name || 'Unknown',
    os: result.os.name || 'Unknown'
  };
};

// Helper to get date range
const getDateRange = (range) => {
  const now = new Date();
  const start = new Date();
  
  switch (range) {
    case '7d':
      start.setDate(now.getDate() - 7);
      break;
    case '30d':
      start.setDate(now.getDate() - 30);
      break;
    case '90d':
      start.setDate(now.getDate() - 90);
      break;
    case '12m':
      start.setMonth(now.getMonth() - 12);
      break;
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      now.setDate(now.getDate() - 1);
      now.setHours(23, 59, 59, 999);
      break;
    default:
      start.setDate(now.getDate() - 30);
  }
  
  return { start, end: now };
};

// =====================
// PUBLIC TRACKING ENDPOINTS (no auth required)
// =====================

// @route   POST /api/v1/analytics/track/pageview
// @desc    Track a page view
// @access  Public
router.post('/track/pageview', async (req, res) => {
  try {
    const {
      page,
      path,
      title,
      referrer,
      sessionId,
      visitorId
    } = req.body;

    const userAgent = req.headers['user-agent'];
    const { device, browser, os } = parseUserAgent(userAgent);
    const ip = req.ip || req.connection.remoteAddress;

    // Create page view
    const pageView = await PageView.create({
      page,
      path,
      title,
      referrer,
      sessionId,
      visitorId,
      userAgent,
      device,
      browser,
      os,
      ip
    });

    // Update or create session
    let session = await Session.findOne({ sessionId });
    if (session) {
      session.pageViews += 1;
      session.exitPage = path;
      session.isBounce = session.pageViews <= 1;
      await session.save();
    } else {
      session = await Session.create({
        sessionId,
        visitorId,
        entryPage: path,
        exitPage: path,
        referrer,
        referrerDomain: referrer ? new URL(referrer).hostname : '',
        device,
        browser,
        os,
        ip,
        pageViews: 1
      });
    }

    // Update or create visitor
    let visitor = await Visitor.findOne({ visitorId });
    if (visitor) {
      visitor.lastVisit = new Date();
      visitor.totalPageViews += 1;
      if (!session.isNewVisitor) {
        visitor.totalSessions += 1;
      }
      await visitor.save();
    } else {
      await Visitor.create({
        visitorId,
        device,
        browser,
        os
      });
    }

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error tracking pageview:', error);
    res.status(500).json({ success: false, message: 'Error tracking pageview' });
  }
});

// @route   POST /api/v1/analytics/track/event
// @desc    Track an event
// @access  Public
router.post('/track/event', async (req, res) => {
  try {
    const {
      eventType,
      eventCategory,
      eventAction,
      eventLabel,
      eventValue,
      page,
      path,
      sessionId,
      visitorId,
      elementId,
      elementClass,
      elementText,
      metadata
    } = req.body;

    // Create event
    await Event.create({
      eventType,
      eventCategory,
      eventAction,
      eventLabel,
      eventValue,
      page,
      path,
      sessionId,
      visitorId,
      elementId,
      elementClass,
      elementText,
      metadata
    });

    // Update session events count
    await Session.findOneAndUpdate(
      { sessionId },
      { $inc: { events: 1 } }
    );

    // Update visitor events count
    await Visitor.findOneAndUpdate(
      { visitorId },
      { $inc: { totalEvents: 1 } }
    );

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({ success: false, message: 'Error tracking event' });
  }
});

// @route   POST /api/v1/analytics/track/session-end
// @desc    Update session end time and duration
// @access  Public
router.post('/track/session-end', async (req, res) => {
  try {
    const { sessionId, duration } = req.body;

    await Session.findOneAndUpdate(
      { sessionId },
      { 
        endTime: new Date(),
        duration
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ success: false, message: 'Error updating session' });
  }
});

// =====================
// ADMIN ANALYTICS ENDPOINTS (auth required)
// =====================

// @route   GET /api/v1/analytics/overview
// @desc    Get analytics overview/dashboard data
// @access  Private
router.get('/overview', protect, async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const { start, end } = getDateRange(range);

    // Get total page views
    const totalPageViews = await PageView.countDocuments({
      timestamp: { $gte: start, $lte: end }
    });

    // Get unique visitors
    const uniqueVisitors = await PageView.distinct('visitorId', {
      timestamp: { $gte: start, $lte: end }
    });

    // Get total sessions
    const totalSessions = await Session.countDocuments({
      startTime: { $gte: start, $lte: end }
    });

    // Get new vs returning visitors
    const newVisitors = await Session.countDocuments({
      startTime: { $gte: start, $lte: end },
      isNewVisitor: true
    });

    // Get bounce rate
    const bouncedSessions = await Session.countDocuments({
      startTime: { $gte: start, $lte: end },
      isBounce: true
    });
    const bounceRate = totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0;

    // Get average session duration
    const sessionDurations = await Session.aggregate([
      { $match: { startTime: { $gte: start, $lte: end }, duration: { $gt: 0 } } },
      { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
    ]);
    const avgSessionDuration = sessionDurations[0]?.avgDuration || 0;

    // Get average page views per session
    const avgPageViews = totalSessions > 0 ? totalPageViews / totalSessions : 0;

    // Get previous period for comparison
    const periodLength = end - start;
    const prevStart = new Date(start - periodLength);
    const prevEnd = new Date(start);

    const prevPageViews = await PageView.countDocuments({
      timestamp: { $gte: prevStart, $lte: prevEnd }
    });

    const prevUniqueVisitors = await PageView.distinct('visitorId', {
      timestamp: { $gte: prevStart, $lte: prevEnd }
    });

    const prevSessions = await Session.countDocuments({
      startTime: { $gte: prevStart, $lte: prevEnd }
    });

    // Calculate percentage changes
    const pageViewsChange = prevPageViews > 0 
      ? ((totalPageViews - prevPageViews) / prevPageViews) * 100 
      : 100;

    const visitorsChange = prevUniqueVisitors.length > 0 
      ? ((uniqueVisitors.length - prevUniqueVisitors.length) / prevUniqueVisitors.length) * 100 
      : 100;

    const sessionsChange = prevSessions > 0 
      ? ((totalSessions - prevSessions) / prevSessions) * 100 
      : 100;

    res.json({
      success: true,
      data: {
        overview: {
          pageViews: totalPageViews,
          pageViewsChange: pageViewsChange.toFixed(1),
          uniqueVisitors: uniqueVisitors.length,
          visitorsChange: visitorsChange.toFixed(1),
          sessions: totalSessions,
          sessionsChange: sessionsChange.toFixed(1),
          bounceRate: bounceRate.toFixed(1),
          avgSessionDuration: Math.round(avgSessionDuration),
          avgPageViews: avgPageViews.toFixed(1),
          newVisitors,
          returningVisitors: uniqueVisitors.length - newVisitors
        },
        period: { start, end, range }
      }
    });
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({ success: false, message: 'Error fetching analytics data' });
  }
});

// @route   GET /api/v1/analytics/pageviews
// @desc    Get page views over time
// @access  Private
router.get('/pageviews', protect, async (req, res) => {
  try {
    const { range = '30d', interval = 'day' } = req.query;
    const { start, end } = getDateRange(range);

    let groupBy;
    if (interval === 'hour') {
      groupBy = {
        year: { $year: '$timestamp' },
        month: { $month: '$timestamp' },
        day: { $dayOfMonth: '$timestamp' },
        hour: { $hour: '$timestamp' }
      };
    } else if (interval === 'week') {
      groupBy = {
        year: { $year: '$timestamp' },
        week: { $week: '$timestamp' }
      };
    } else {
      groupBy = {
        year: { $year: '$timestamp' },
        month: { $month: '$timestamp' },
        day: { $dayOfMonth: '$timestamp' }
      };
    }

    const pageViewsOverTime = await PageView.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: groupBy,
          views: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$visitorId' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
    ]);

    // Format the data
    const chartData = pageViewsOverTime.map(item => ({
      date: new Date(
        item._id.year,
        (item._id.month || 1) - 1,
        item._id.day || 1,
        item._id.hour || 0
      ).toISOString(),
      views: item.views,
      visitors: item.uniqueVisitors.length
    }));

    res.json({
      success: true,
      data: chartData
    });
  } catch (error) {
    console.error('Error fetching pageviews:', error);
    res.status(500).json({ success: false, message: 'Error fetching pageviews data' });
  }
});

// @route   GET /api/v1/analytics/top-pages
// @desc    Get top pages
// @access  Private
router.get('/top-pages', protect, async (req, res) => {
  try {
    const { range = '30d', limit = 10 } = req.query;
    const { start, end } = getDateRange(range);

    const topPages = await PageView.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { path: '$path', page: '$page', title: '$title' },
          views: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$visitorId' },
          avgDuration: { $avg: '$duration' }
        }
      },
      { $sort: { views: -1 } },
      { $limit: parseInt(limit) }
    ]);

    const formattedPages = topPages.map((page, index) => ({
      rank: index + 1,
      path: page._id.path,
      page: page._id.page,
      title: page._id.title || page._id.page,
      views: page.views,
      uniqueVisitors: page.uniqueVisitors.length,
      avgDuration: Math.round(page.avgDuration || 0)
    }));

    res.json({
      success: true,
      data: formattedPages
    });
  } catch (error) {
    console.error('Error fetching top pages:', error);
    res.status(500).json({ success: false, message: 'Error fetching top pages' });
  }
});

// @route   GET /api/v1/analytics/referrers
// @desc    Get top referrers
// @access  Private
router.get('/referrers', protect, async (req, res) => {
  try {
    const { range = '30d', limit = 10 } = req.query;
    const { start, end } = getDateRange(range);

    const referrers = await Session.aggregate([
      { $match: { startTime: { $gte: start, $lte: end }, referrer: { $ne: '' } } },
      {
        $group: {
          _id: '$referrerDomain',
          visits: { $sum: 1 },
          pageViews: { $sum: '$pageViews' }
        }
      },
      { $sort: { visits: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Add direct traffic
    const directTraffic = await Session.countDocuments({
      startTime: { $gte: start, $lte: end },
      $or: [{ referrer: '' }, { referrer: null }]
    });

    const formattedReferrers = [
      { source: 'Direct', visits: directTraffic, type: 'direct' },
      ...referrers.map(ref => ({
        source: ref._id || 'Unknown',
        visits: ref.visits,
        pageViews: ref.pageViews,
        type: 'referral'
      }))
    ].sort((a, b) => b.visits - a.visits);

    res.json({
      success: true,
      data: formattedReferrers
    });
  } catch (error) {
    console.error('Error fetching referrers:', error);
    res.status(500).json({ success: false, message: 'Error fetching referrers data' });
  }
});

// @route   GET /api/v1/analytics/devices
// @desc    Get device breakdown
// @access  Private
router.get('/devices', protect, async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const { start, end } = getDateRange(range);

    const deviceBreakdown = await Session.aggregate([
      { $match: { startTime: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$device',
          count: { $sum: 1 }
        }
      }
    ]);

    const browserBreakdown = await Session.aggregate([
      { $match: { startTime: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$browser',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const osBreakdown = await Session.aggregate([
      { $match: { startTime: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$os',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        devices: deviceBreakdown.map(d => ({ device: d._id, count: d.count })),
        browsers: browserBreakdown.map(b => ({ browser: b._id, count: b.count })),
        os: osBreakdown.map(o => ({ os: o._id, count: o.count }))
      }
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ success: false, message: 'Error fetching devices data' });
  }
});

// @route   GET /api/v1/analytics/events
// @desc    Get events breakdown
// @access  Private
router.get('/events', protect, async (req, res) => {
  try {
    const { range = '30d', limit = 20 } = req.query;
    const { start, end } = getDateRange(range);

    const eventsByType = await Event.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const eventsByCategory = await Event.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$eventCategory',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) }
    ]);

    const topEvents = await Event.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { category: '$eventCategory', action: '$eventAction', label: '$eventLabel' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: {
        byType: eventsByType.map(e => ({ type: e._id, count: e.count })),
        byCategory: eventsByCategory.map(e => ({ category: e._id, count: e.count })),
        topEvents: topEvents.map(e => ({
          category: e._id.category,
          action: e._id.action,
          label: e._id.label,
          count: e.count
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ success: false, message: 'Error fetching events data' });
  }
});

// @route   GET /api/v1/analytics/realtime
// @desc    Get realtime visitors (last 5 minutes)
// @access  Private
router.get('/realtime', protect, async (req, res) => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const activeVisitors = await PageView.distinct('visitorId', {
      timestamp: { $gte: fiveMinutesAgo }
    });

    const recentPageViews = await PageView.find({
      timestamp: { $gte: fiveMinutesAgo }
    })
    .sort({ timestamp: -1 })
    .limit(20)
    .lean();

    const activePages = await PageView.aggregate([
      { $match: { timestamp: { $gte: fiveMinutesAgo } } },
      {
        $group: {
          _id: '$path',
          visitors: { $addToSet: '$visitorId' },
          title: { $first: '$title' }
        }
      },
      { $sort: { 'visitors.length': -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        activeVisitors: activeVisitors.length,
        recentPageViews: recentPageViews.map(pv => ({
          path: pv.path,
          title: pv.title,
          device: pv.device,
          country: pv.country,
          timestamp: pv.timestamp
        })),
        activePages: activePages.map(p => ({
          path: p._id,
          title: p.title,
          visitors: p.visitors.length
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching realtime data:', error);
    res.status(500).json({ success: false, message: 'Error fetching realtime data' });
  }
});

// @route   GET /api/v1/analytics/user-flow
// @desc    Get user flow/journey data
// @access  Private
router.get('/user-flow', protect, async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const { start, end } = getDateRange(range);

    // Get entry pages
    const entryPages = await Session.aggregate([
      { $match: { startTime: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$entryPage',
          sessions: { $sum: 1 },
          bounces: { $sum: { $cond: ['$isBounce', 1, 0] } }
        }
      },
      { $sort: { sessions: -1 } },
      { $limit: 10 }
    ]);

    // Get exit pages
    const exitPages = await Session.aggregate([
      { $match: { startTime: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$exitPage',
          sessions: { $sum: 1 }
        }
      },
      { $sort: { sessions: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        entryPages: entryPages.map(p => ({
          page: p._id,
          sessions: p.sessions,
          bounceRate: ((p.bounces / p.sessions) * 100).toFixed(1)
        })),
        exitPages: exitPages.map(p => ({
          page: p._id,
          sessions: p.sessions
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching user flow:', error);
    res.status(500).json({ success: false, message: 'Error fetching user flow data' });
  }
});

// @route   GET /api/v1/analytics/utm
// @desc    Get UTM campaign data
// @access  Private
router.get('/utm', protect, async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    const { start, end } = getDateRange(range);

    const utmCampaigns = await Session.aggregate([
      { 
        $match: { 
          startTime: { $gte: start, $lte: end },
          utmSource: { $ne: null, $exists: true }
        } 
      },
      {
        $group: {
          _id: {
            source: '$utmSource',
            medium: '$utmMedium',
            campaign: '$utmCampaign'
          },
          sessions: { $sum: 1 },
          pageViews: { $sum: '$pageViews' }
        }
      },
      { $sort: { sessions: -1 } },
      { $limit: 20 }
    ]);

    res.json({
      success: true,
      data: utmCampaigns.map(c => ({
        source: c._id.source,
        medium: c._id.medium,
        campaign: c._id.campaign,
        sessions: c.sessions,
        pageViews: c.pageViews
      }))
    });
  } catch (error) {
    console.error('Error fetching UTM data:', error);
    res.status(500).json({ success: false, message: 'Error fetching UTM data' });
  }
});

// @route   DELETE /api/v1/analytics/clear
// @desc    Clear analytics data (admin only)
// @access  Private/Admin
router.delete('/clear', protect, authorize('admin'), async (req, res) => {
  try {
    const { type = 'all', beforeDate } = req.query;
    const cutoffDate = beforeDate ? new Date(beforeDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    let result = {};

    if (type === 'all' || type === 'pageviews') {
      const pvResult = await PageView.deleteMany({ timestamp: { $lt: cutoffDate } });
      result.pageViews = pvResult.deletedCount;
    }

    if (type === 'all' || type === 'events') {
      const evResult = await Event.deleteMany({ timestamp: { $lt: cutoffDate } });
      result.events = evResult.deletedCount;
    }

    if (type === 'all' || type === 'sessions') {
      const sessResult = await Session.deleteMany({ startTime: { $lt: cutoffDate } });
      result.sessions = sessResult.deletedCount;
    }

    res.json({
      success: true,
      message: 'Analytics data cleared',
      data: result
    });
  } catch (error) {
    console.error('Error clearing analytics:', error);
    res.status(500).json({ success: false, message: 'Error clearing analytics data' });
  }
});

module.exports = router;
