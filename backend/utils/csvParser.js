const { parse } = require('csv-parse');
const fs = require('fs');

/**
 * CSV Parser Utility
 * Handles importing inventory data from spreadsheets
 */

// Parse CSV file and return records
const parseCSVFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const records = [];
    
    const parser = parse({
      columns: true, // Use first row as headers
      skip_empty_lines: true,
      trim: true,
      cast: true, // Auto-cast numbers
      cast_date: false // Don't auto-cast dates
    });
    
    parser.on('readable', function() {
      let record;
      while ((record = parser.read()) !== null) {
        records.push(record);
      }
    });
    
    parser.on('error', function(err) {
      reject(err);
    });
    
    parser.on('end', function() {
      resolve(records);
    });
    
    fs.createReadStream(filePath).pipe(parser);
  });
};

// Parse CSV from string/buffer
const parseCSVString = (csvContent) => {
  return new Promise((resolve, reject) => {
    parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: true
    }, (err, records) => {
      if (err) {
        reject(err);
      } else {
        resolve(records);
      }
    });
  });
};

// Map common column names to our schema
const COLUMN_MAPPINGS = {
  // SKU variations
  'sku': 'sku',
  'item_code': 'sku',
  'item code': 'sku',
  'product_code': 'sku',
  'code': 'sku',
  
  // Name variations
  'name': 'name',
  'product': 'name',
  'item': 'name',
  'product_name': 'name',
  'item_name': 'name',
  'description': 'name',
  
  // Dimensions
  'thickness': 'dimensions.thickness',
  'width': 'dimensions.width',
  'length': 'dimensions.length',
  
  // Stock
  'count': 'currentStock',
  'stock': 'currentStock',
  'quantity': 'currentStock',
  'on_hand': 'currentStock',
  'current_stock': 'currentStock',
  'current stock': 'currentStock',
  
  // Minimums
  'winter_min': 'minimums.winter',
  'winter min': 'minimums.winter',
  'winter_minimum': 'minimums.winter',
  'slow_season_min': 'minimums.winter',
  'min_winter': 'minimums.winter',
  
  'summer_min': 'minimums.summer',
  'summer min': 'minimums.summer',
  'summer_minimum': 'minimums.summer',
  'busy_season_min': 'minimums.summer',
  'min_summer': 'minimums.summer',
  
  // Category
  'category': 'category',
  'type': 'category',
  
  // Location
  'location': 'location',
  'bin': 'location',
  'warehouse_location': 'location',
  
  // Notes
  'notes': 'notes',
  'comments': 'notes'
};

// Normalize column name
const normalizeColumnName = (name) => {
  const normalized = name.toLowerCase().trim().replace(/\s+/g, '_');
  return COLUMN_MAPPINGS[normalized] || COLUMN_MAPPINGS[name.toLowerCase().trim()] || null;
};

// Set nested value on object
const setNestedValue = (obj, path, value) => {
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  
  current[parts[parts.length - 1]] = value;
};

// Transform CSV records to inventory items
const transformToInventoryItems = (records) => {
  const items = [];
  const errors = [];
  
  records.forEach((record, index) => {
    try {
      const item = {
        minimums: {},
        dimensions: {}
      };
      
      let hasSKU = false;
      let hasName = false;
      
      Object.keys(record).forEach(column => {
        const mappedField = normalizeColumnName(column);
        if (mappedField) {
          let value = record[column];
          
          // Handle fractional values (e.g., "10 1/2" or "10.5")
          if (typeof value === 'string' && ['currentStock', 'minimums.winter', 'minimums.summer'].includes(mappedField)) {
            value = parseFractionalValue(value);
          }
          
          setNestedValue(item, mappedField, value);
          
          if (mappedField === 'sku') hasSKU = true;
          if (mappedField === 'name') hasName = true;
        }
      });
      
      // Generate SKU if not provided but has name
      if (!hasSKU && hasName) {
        item.sku = generateSKU(item.name, index);
      }
      
      // Validate required fields
      if (!item.sku && !item.name) {
        errors.push({
          row: index + 2, // +2 for header and 0-index
          error: 'Missing SKU and name'
        });
        return;
      }
      
      // Parse dimensions from name if not provided
      if (item.name && !item.dimensions.thickness) {
        const parsedDimensions = parseDimensionsFromName(item.name);
        if (parsedDimensions) {
          item.dimensions = parsedDimensions;
        }
      }
      
      // Default values
      item.currentStock = item.currentStock || 0;
      item.minimums.winter = item.minimums.winter || 0;
      item.minimums.summer = item.minimums.summer || 0;
      item.isActive = true;
      
      items.push(item);
    } catch (err) {
      errors.push({
        row: index + 2,
        error: err.message
      });
    }
  });
  
  return { items, errors };
};

// Parse fractional values like "10 1/2" or "10.5"
const parseFractionalValue = (value) => {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'string') return 0;
  
  value = value.trim();
  
  // Already a decimal
  if (/^\d+\.?\d*$/.test(value)) {
    return parseFloat(value);
  }
  
  // Mixed number like "10 1/2"
  const mixedMatch = value.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1]);
    const num = parseInt(mixedMatch[2]);
    const denom = parseInt(mixedMatch[3]);
    return whole + (num / denom);
  }
  
  // Just a fraction like "1/2"
  const fractionMatch = value.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    return parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
  }
  
  return parseFloat(value) || 0;
};

// Parse dimensions from lumber name like "2 x 4 - 16'"
const parseDimensionsFromName = (name) => {
  // Pattern: "2 x 4 - 16'" or "2x4-16'" or "2x4 16ft"
  const pattern = /(\d+(?:\/\d+)?)\s*[xX×]\s*(\d+(?:\/\d+)?)\s*[-–—]?\s*(\d+(?:\/\d+)?)?['"ft]?/;
  const match = name.match(pattern);
  
  if (match) {
    return {
      thickness: match[1],
      width: match[2],
      length: match[3] ? `${match[3]}'` : undefined
    };
  }
  
  return null;
};

// Generate SKU from name
const generateSKU = (name, index) => {
  const dimensions = parseDimensionsFromName(name);
  if (dimensions) {
    return `LUM-${dimensions.thickness}X${dimensions.width}-${dimensions.length || 'STD'}`.replace(/['"]/g, '').toUpperCase();
  }
  
  // Fallback: use first letters and index
  const prefix = name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
  return `${prefix}-${String(index + 1).padStart(4, '0')}`;
};

// Validate import results
const validateImport = (items) => {
  const issues = [];
  const skus = new Set();
  
  items.forEach((item, index) => {
    // Check for duplicate SKUs
    if (skus.has(item.sku)) {
      issues.push({
        row: index + 1,
        field: 'sku',
        issue: `Duplicate SKU: ${item.sku}`
      });
    }
    skus.add(item.sku);
    
    // Check for negative values
    if (item.currentStock < 0) {
      issues.push({
        row: index + 1,
        field: 'currentStock',
        issue: 'Negative stock value'
      });
    }
    
    // Check for illogical minimums (summer should typically >= winter for lumber)
    if (item.minimums.summer < item.minimums.winter * 0.5) {
      issues.push({
        row: index + 1,
        field: 'minimums',
        issue: 'Summer minimum seems unusually low compared to winter',
        severity: 'warning'
      });
    }
  });
  
  return issues;
};

module.exports = {
  parseCSVFile,
  parseCSVString,
  transformToInventoryItems,
  parseFractionalValue,
  parseDimensionsFromName,
  validateImport,
  normalizeColumnName
};
