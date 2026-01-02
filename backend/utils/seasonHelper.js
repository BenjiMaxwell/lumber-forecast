/**
 * Season Helper Utility
 * Handles seasonal calculations for inventory minimums
 */

// Get current season based on configuration
const getCurrentSeason = () => {
  const month = new Date().getMonth() + 1; // 1-12
  const busySeasonStart = parseInt(process.env.BUSY_SEASON_START) || 4;
  const busySeasonEnd = parseInt(process.env.BUSY_SEASON_END) || 10;
  
  return month >= busySeasonStart && month <= busySeasonEnd ? 'summer' : 'winter';
};

// Check if a date is in busy season
const isInBusySeason = (date = new Date()) => {
  const month = date.getMonth() + 1;
  const busySeasonStart = parseInt(process.env.BUSY_SEASON_START) || 4;
  const busySeasonEnd = parseInt(process.env.BUSY_SEASON_END) || 10;
  
  return month >= busySeasonStart && month <= busySeasonEnd;
};

// Get season indicator for ML features (0 = winter/slow, 1 = summer/busy)
const getSeasonIndicator = (date = new Date()) => {
  return isInBusySeason(date) ? 1 : 0;
};

// Calculate seasonal adjustment factor
// Returns multiplier for adjusting consumption predictions
const getSeasonalAdjustmentFactor = (fromDate, toDate) => {
  const fromSeason = isInBusySeason(fromDate);
  const toSeason = isInBusySeason(toDate);
  
  if (fromSeason === toSeason) {
    return 1.0; // No adjustment needed
  }
  
  // Transitioning from slow to busy season - expect higher demand
  if (!fromSeason && toSeason) {
    return 1.3; // 30% increase
  }
  
  // Transitioning from busy to slow season - expect lower demand
  return 0.7; // 30% decrease
};

// Get day of year normalized (0-1)
const getNormalizedDayOfYear = (date = new Date()) => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  
  return dayOfYear / 365;
};

// Get week of year
const getWeekOfYear = (date = new Date()) => {
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - start) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + start.getDay() + 1) / 7);
};

// Calculate appropriate minimum based on season and consumption
const calculateDynamicMinimum = (avgDailyConsumption, daysSupply = 30) => {
  const season = getCurrentSeason();
  const baseDaysSupply = parseInt(process.env.MIN_DAYS_SUPPLY) || daysSupply;
  
  let minimum = avgDailyConsumption * baseDaysSupply;
  
  // Add seasonal buffer
  if (season === 'summer') {
    minimum *= 1.2; // 20% buffer for busy season
  }
  
  return Math.ceil(minimum * 100) / 100; // Round to 2 decimals
};

// Calculate target inventory (minimum * multiplier)
const calculateTarget = (minimum, multiplier = 1.5) => {
  const targetMultiplier = parseFloat(process.env.TARGET_MULTIPLIER) || multiplier;
  return Math.ceil(minimum * targetMultiplier * 100) / 100;
};

// Get seasonal transition dates for the year
const getSeasonTransitions = (year = new Date().getFullYear()) => {
  const busySeasonStart = parseInt(process.env.BUSY_SEASON_START) || 4;
  const busySeasonEnd = parseInt(process.env.BUSY_SEASON_END) || 10;
  
  return {
    busySeasonStart: new Date(year, busySeasonStart - 1, 1),
    busySeasonEnd: new Date(year, busySeasonEnd, 0), // Last day of busy season end month
    slowSeasonStart: new Date(year, busySeasonEnd, 1),
    slowSeasonEnd: new Date(year + 1, busySeasonStart - 1, 0) // Wraps to next year
  };
};

module.exports = {
  getCurrentSeason,
  isInBusySeason,
  getSeasonIndicator,
  getSeasonalAdjustmentFactor,
  getNormalizedDayOfYear,
  getWeekOfYear,
  calculateDynamicMinimum,
  calculateTarget,
  getSeasonTransitions
};
