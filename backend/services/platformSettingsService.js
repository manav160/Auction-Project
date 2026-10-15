const PlatformSettings = require('../models/PlatformSettings');

class PlatformSettingsService {
  static cachedSettings = null;
  static lastFetchTime = 0;
  static CACHE_TTL_MS = 60000; // 1 minute cache

  static async getSettings() {
    const now = Date.now();
    if (this.cachedSettings && (now - this.lastFetchTime < this.CACHE_TTL_MS)) {
      return this.cachedSettings;
    }

    let settings = await PlatformSettings.findOne({ key: 'DEFAULT_SETTINGS' });
    if (!settings) {
      try {
        settings = await PlatformSettings.create({ key: 'DEFAULT_SETTINGS' });
      } catch (err) {
        if (err.code === 11000) {
          settings = await PlatformSettings.findOne({ key: 'DEFAULT_SETTINGS' });
        } else {
          throw err;
        }
      }
    }

    this.cachedSettings = settings;
    this.lastFetchTime = now;
    return settings;
  }

  static invalidateCache() {
    this.cachedSettings = null;
    this.lastFetchTime = 0;
  }

  static async updateSettings(updates) {
    const settings = await PlatformSettings.findOneAndUpdate(
      { key: 'DEFAULT_SETTINGS' },
      { $set: updates },
      { new: true, upsert: true }
    );
    this.invalidateCache();
    return settings;
  }
}

module.exports = PlatformSettingsService;
