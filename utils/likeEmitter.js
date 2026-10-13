const EventEmitter = require('events')

class LikeEmitter extends EventEmitter {}

// Singleton emitter for like events
module.exports = new LikeEmitter()
