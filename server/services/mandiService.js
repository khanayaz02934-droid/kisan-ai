import MandiPrice from '../models/mandiPriceModel.js';
import { escapeRegExp } from '../utils/escapeRegExp.js';

const DATA_GOV_BASE = 'https://api.data.gov.in/resource';
const CACHE_HOURS = 6;
const API_TIMEOUT_MS = 15000;

// Commodity name translations
const COMMODITY_HINDI = {
  wheat: 'गेहूं',
  rice: 'चावल',
  maize: 'मक्का',
  soybean: 'सोयाबीन',
  cotton: 'कपास',
  sugarcane: 'गन्ना',
  potato: 'आलू',
  onion: 'प्याज',
  tomato: 'टमाटर',
  groundnut: 'मूंगफली',
  mustard: 'सरसों',
  barley: 'जौ',
  jowar: 'जोवार',
  bajra: 'बाजरा',
  arhar: 'अरहर',
  gram: 'चना',
};

/**
 * Get cached mandi prices from MongoDB
 */
const getCachedPrices = async (filters = {}) => {
  const query = {};
  if (filters.state) query.state = new RegExp(escapeRegExp(filters.state), 'i');
  if (filters.district) query.district = new RegExp(escapeRegExp(filters.district), 'i');
  if (filters.commodity) {
    const commodityPattern = new RegExp(escapeRegExp(filters.commodity), 'i');
    query.$or = [
      { 'commodity.en': commodityPattern },
      { 'commodity.hi': commodityPattern },
    ];
  }

  return MandiPrice.find(query).sort({ fetchedAt: -1 }).limit(50).lean();
};

/**
 * Fetch fresh prices from data.gov.in API
 */
const fetchFromAPI = async (filters = {}) => {
  const apiKey = process.env.DATA_GOV_API_KEY;
  const resourceId = process.env.DATA_GOV_RESOURCE_ID || '9ef84268-d588-465a-a308-a864a43d0070';

  if (!apiKey) {
    throw new Error('DATA_GOV_API_KEY not configured');
  }

  const params = new URLSearchParams({
    'api-key': apiKey,
    format: 'json',
    limit: 50,
    offset: 0,
  });

  if (filters.state) params.append('filters[state]', filters.state);
  if (filters.district) params.append('filters[district]', filters.district);
  if (filters.commodity) params.append('filters[commodity]', filters.commodity);

  // node-fetch v3 dropped the init `timeout` option; AbortSignal.timeout is the
  // supported way. The old `{ timeout: 10000 }` was silently ignored.
  const url = `${DATA_GOV_BASE}/${resourceId}?${params.toString()}`;
  const { default: fetch } = await import('node-fetch');
  const response = await fetch(url, {
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const json = await response.json();
  return json.records || [];
};

/**
 * Transform API records to our schema
 */
const transformAPIRecords = (records) => {
  return records.map((r) => {
    const commodityEn = (r.commodity || r.Commodity || 'Unknown').toLowerCase();
    return {
      state: r.state || r.State || '',
      district: r.district || r.District || '',
      market: r.market || r.Market || '',
      commodity: {
        en: r.commodity || r.Commodity || 'Unknown',
        hi: COMMODITY_HINDI[commodityEn] || r.commodity || r.Commodity || 'अज्ञात',
      },
      variety: r.variety || r.Variety || '',
      minPrice: parseFloat(r.min_price || r.Min_Price || 0),
      maxPrice: parseFloat(r.max_price || r.Max_Price || 0),
      modalPrice: parseFloat(r.modal_price || r.Modal_Price || 0),
      date: r.arrival_date || r.Arrival_Date || new Date().toISOString().split('T')[0],
      fetchedAt: new Date(),
      source: 'API',
    };
  });
};

/**
 * Find the newest fetchedAt and newest arrival date in a result set so
 * clients can label data freshness truthfully.
 */
const freshness = (data = []) => {
  let lastUpdated = null;
  let latestDate = null;
  for (const r of data) {
    if (r?.fetchedAt && (!lastUpdated || new Date(r.fetchedAt) > new Date(lastUpdated))) {
      lastUpdated = r.fetchedAt;
    }
    if (r?.date && dateStr(r.date) > (latestDate || '')) {
      latestDate = r.date;
    }
  }
  return {
    lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null,
    latestDate,
  };
};

// YYYY-MM-DD strings compare lexicographically
const dateStr = (d) => String(d || '');

/**
 * Main service function: get mandi prices with cache
 */
const getMandiPrices = async (filters = {}) => {
  // Probe cache freshness with the SAME filters used by getCachedPrices().
  // If the fresh cache doesn't cover the requested district/commodity,
  // treat it as stale so we attempt the live API instead of returning
  // an empty "fresh" result.
  const cacheQuery = {};
  if (filters.state) cacheQuery.state = new RegExp(escapeRegExp(filters.state), 'i');
  if (filters.district) cacheQuery.district = new RegExp(escapeRegExp(filters.district), 'i');
  if (filters.commodity) {
    const commodityPattern = new RegExp(escapeRegExp(filters.commodity), 'i');
    cacheQuery.$or = [
      { 'commodity.en': commodityPattern },
      { 'commodity.hi': commodityPattern },
    ];
  }

  const lastFetch = await MandiPrice.findOne(cacheQuery).sort({ fetchedAt: -1 });
  const isCacheFresh =
    lastFetch &&
    new Date() - new Date(lastFetch.fetchedAt) < CACHE_HOURS * 60 * 60 * 1000;

  if (isCacheFresh) {
    const data = await getCachedPrices(filters);
    return {
      data,
      source: 'cache',
      isLive: false,
      ...freshness(data),
      message: null,
    };
  }

  // Try to fetch fresh data
  try {
    const records = await fetchFromAPI(filters);
    if (records.length > 0) {
      const transformed = transformAPIRecords(records);

      // Upsert records
      for (const record of transformed) {
        await MandiPrice.findOneAndUpdate(
          {
            state: record.state,
            district: record.district,
            'commodity.en': record.commodity.en,
            date: record.date,
          },
          record,
          { upsert: true, new: true }
        );
      }

      const data = await getCachedPrices(filters);
      return {
        data,
        source: 'api',
        isLive: true,
        ...freshness(data),
        message: null,
      };
    }
  } catch (error) {
    console.error('Mandi API fetch error:', error.message);
  }

  // Fallback to cached data with warning
  const cachedData = await getCachedPrices(filters);
  return {
    data: cachedData,
    source: 'cache_fallback',
    isLive: false,
    ...freshness(cachedData),
    message: {
      en: 'Live prices unavailable, showing recent cached data',
      hi: 'लाइव कीमतें उपलब्ध नहीं हैं, पुरानी कैश्ड जानकारी दिखाई जा रही है',
    },
  };
};

export { getMandiPrices, getCachedPrices };
