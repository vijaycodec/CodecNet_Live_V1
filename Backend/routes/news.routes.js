import express from "express";
import axios from "axios";
import https from "https";
import Parser from "rss-parser";

const router = express.Router();

// Axios instance with SSL verification disabled
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
});

// RSS Parser instance
const rssParser = new Parser({
  timeout: 5000,
  headers: {
    'User-Agent': 'SOC-Dashboard/1.0'
  }
});

// In-memory cache with 10-minute TTL
const newsCache = new Map();
const NEWS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

/**
 * @route   GET /api/news/cyber
 * @desc    Fetch cybersecurity news from multiple sources (with caching)
 * @access  Public
 */
router.get("/cyber", async (req, res) => {
  try {
    // Check cache first
    const cacheKey = 'cyber:news';
    const cached = newsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < NEWS_CACHE_TTL) {
      console.log('✅ News Cache hit - returning cached data');
      return res.json({
        ...cached.data,
        cached: true,
        cached_at: new Date(cached.timestamp).toISOString()
      });
    }

    console.log('🔐 Fetching fresh cyber news from multiple sources...');
    const newsItems = [];

    // Fetch from Dev.to
    try {
      const devToResponse = await axiosInstance.get(
        "https://dev.to/api/articles?tag=cybersecurity&per_page=20",
        { timeout: 5000 }
      );

      if (devToResponse.status === 200 && Array.isArray(devToResponse.data)) {
        devToResponse.data.forEach((article) => {
          newsItems.push({
            title: article.title,
            description: article.description || article.title,
            url: article.url,
            published_at: article.published_at,
            source: "Dev.to",
            author: article.user?.name || "Unknown",
            tags: article.tag_list || [],
            reading_time: article.reading_time_minutes || 0,
          });
        });
      }
    } catch (err) {
      console.warn("[!] Failed to fetch from Dev.to:", err.message);
    }

    // Fetch from Dark Reading RSS
    try {
      const feed = await rssParser.parseURL("https://www.darkreading.com/rss.xml");

      feed.items.slice(0, 10).forEach((item) => {
        newsItems.push({
          title: item.title || "Untitled",
          description: item.contentSnippet?.substring(0, 200) || item.title || "",
          url: item.link || "",
          published_at: item.isoDate || item.pubDate || new Date().toISOString(),
          source: "Dark Reading",
          author: item.creator || "Dark Reading",
          tags: item.categories || ["security", "enterprise"],
          reading_time: 0,
        });
      });
    } catch (err) {
      console.warn("[!] Failed to fetch from Dark Reading:", err.message);
    }

    // Fetch from Reddit - netsec
    try {
      const netsecResponse = await axiosInstance.get(
        "https://www.reddit.com/r/netsec/hot.json?limit=15",
        {
          timeout: 5000,
          headers: { "User-Agent": "SOC-Dashboard/1.0" },
        }
      );

      if (
        netsecResponse.status === 200 &&
        netsecResponse.data?.data?.children
      ) {
        netsecResponse.data.data.children.forEach((post) => {
          const data = post.data;
          newsItems.push({
            title: data.title,
            description: data.selftext?.substring(0, 200) || data.title,
            url: `https://reddit.com${data.permalink}`,
            published_at: new Date(data.created_utc * 1000).toISOString(),
            source: "r/netsec",
            author: data.author,
            tags: ["reddit", "netsec"],
            comments: data.num_comments || 0,
            score: data.ups || 0,
          });
        });
      }
    } catch (err) {
      console.warn("[!] Failed to fetch from r/netsec:", err.message);
    }

    // Fetch from Threatpost RSS
    try {
      const feed = await rssParser.parseURL("https://threatpost.com/feed/");

      feed.items.slice(0, 10).forEach((item) => {
        newsItems.push({
          title: item.title || "Untitled",
          description: item.contentSnippet?.substring(0, 200) || item.title || "",
          url: item.link || "",
          published_at: item.isoDate || item.pubDate || new Date().toISOString(),
          source: "Threatpost",
          author: item.creator || "Threatpost",
          tags: item.categories || ["security", "threats"],
          reading_time: 0,
        });
      });
    } catch (err) {
      console.warn("[!] Failed to fetch from Threatpost:", err.message);
    }

    // Fetch from The Hacker News RSS
    try {
      const feed = await rssParser.parseURL("https://feeds.feedburner.com/TheHackersNews");

      feed.items.slice(0, 15).forEach((item) => {
        newsItems.push({
          title: item.title || "Untitled",
          description: item.contentSnippet?.substring(0, 200) || item.title || "",
          url: item.link || "",
          published_at: item.isoDate || item.pubDate || new Date().toISOString(),
          source: "The Hacker News",
          author: item.creator || "THN",
          tags: item.categories || ["security", "news"],
          reading_time: 0,
        });
      });
    } catch (err) {
      console.warn("[!] Failed to fetch from The Hacker News:", err.message);
    }

    // Fetch from Krebs on Security RSS
    try {
      const feed = await rssParser.parseURL("https://krebsonsecurity.com/feed/");

      feed.items.slice(0, 10).forEach((item) => {
        newsItems.push({
          title: item.title || "Untitled",
          description: item.contentSnippet?.substring(0, 200) || item.title || "",
          url: item.link || "",
          published_at: item.isoDate || item.pubDate || new Date().toISOString(),
          source: "Krebs on Security",
          author: item.creator || "Brian Krebs",
          tags: item.categories || ["security", "investigation"],
          reading_time: 0,
        });
      });
    } catch (err) {
      console.warn("[!] Failed to fetch from Krebs on Security:", err.message);
    }

    // Fetch from CISA Advisories RSS
    try {
      const feed = await rssParser.parseURL("https://www.cisa.gov/cybersecurity-advisories/all.xml");

      feed.items.slice(0, 10).forEach((item) => {
        newsItems.push({
          title: item.title || "Untitled",
          description: item.contentSnippet?.substring(0, 200) || item.title || "",
          url: item.link || "",
          published_at: item.isoDate || item.pubDate || new Date().toISOString(),
          source: "CISA",
          author: "CISA",
          tags: ["advisory", "government", "security"],
          reading_time: 0,
        });
      });
    } catch (err) {
      console.warn("[!] Failed to fetch from CISA:", err.message);
    }

    // Fetch from Schneier on Security RSS
    try {
      const feed = await rssParser.parseURL("https://www.schneier.com/feed/atom/");

      feed.items.slice(0, 10).forEach((item) => {
        newsItems.push({
          title: item.title || "Untitled",
          description: item.contentSnippet?.substring(0, 200) || item.title || "",
          url: item.link || "",
          published_at: item.isoDate || item.pubDate || new Date().toISOString(),
          source: "Schneier on Security",
          author: item.creator || "Bruce Schneier",
          tags: item.categories || ["security", "expert-opinion"],
          reading_time: 0,
        });
      });
    } catch (err) {
      console.warn("[!] Failed to fetch from Schneier on Security:", err.message);
    }

    // Fetch from SecurityWeek RSS
    try {
      const feed = await rssParser.parseURL("https://www.securityweek.com/feed/");

      feed.items.slice(0, 10).forEach((item) => {
        newsItems.push({
          title: item.title || "Untitled",
          description: item.contentSnippet?.substring(0, 200) || item.title || "",
          url: item.link || "",
          published_at: item.isoDate || item.pubDate || new Date().toISOString(),
          source: "SecurityWeek",
          author: item.creator || "SecurityWeek",
          tags: item.categories || ["security", "enterprise"],
          reading_time: 0,
        });
      });
    } catch (err) {
      console.warn("[!] Failed to fetch from SecurityWeek:", err.message);
    }

    // Balance distribution: Take top N from each source, then sort by date
    const balancedNews = [];
    const sourceGroups = {};

    // Group news by source
    newsItems.forEach(item => {
      if (!sourceGroups[item.source]) {
        sourceGroups[item.source] = [];
      }
      sourceGroups[item.source].push(item);
    });

    // Sort each source group by date and take top 3-4 items per source
    const itemsPerSource = {
      'Dev.to': 3,
      'Dark Reading': 3,
      'r/netsec': 3,
      'Threatpost': 3,
      'The Hacker News': 4,
      'Krebs on Security': 3,
      'CISA': 4,
      'Schneier on Security': 3,
      'SecurityWeek': 4
    };

    Object.keys(sourceGroups).forEach(source => {
      const sorted = sourceGroups[source].sort(
        (a, b) => new Date(b.published_at) - new Date(a.published_at)
      );
      const limit = itemsPerSource[source] || 3;
      balancedNews.push(...sorted.slice(0, limit));
    });

    // Final sort by date (newest first)
    balancedNews.sort(
      (a, b) => new Date(b.published_at) - new Date(a.published_at)
    );

    const responseData = {
      total: balancedNews.length,
      news: balancedNews,
      last_updated: new Date().toISOString(),
    };

    // Cache the result
    newsCache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });
    console.log(`💾 News data cached for ${NEWS_CACHE_TTL / 60000} minutes`);

    res.json(responseData);
  } catch (error) {
    console.error("Error fetching cyber news:", error.message);
    res.status(500).json({
      error: "Failed to fetch cybersecurity news",
      total: 0,
      news: [],
    });
  }
});

/**
 * @route   GET /api/news/cache/stats
 * @desc    Get news cache statistics
 * @access  Public
 */
router.get("/cache/stats", (req, res) => {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;

  for (const [key, value] of newsCache.entries()) {
    if (now - value.timestamp < NEWS_CACHE_TTL) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }

  res.json({
    success: true,
    data: {
      totalEntries: newsCache.size,
      validEntries,
      expiredEntries,
      cacheTTL: NEWS_CACHE_TTL,
      cacheTTLMinutes: NEWS_CACHE_TTL / 60000
    },
    message: 'News cache statistics retrieved'
  });
});

/**
 * @route   POST /api/news/clear-cache
 * @desc    Clear news cache
 * @access  Public
 */
router.post("/clear-cache", (req, res) => {
  const entriesCleared = newsCache.size;
  newsCache.clear();

  console.log(`🗑️ News cache cleared: ${entriesCleared} entries removed`);

  res.json({
    success: true,
    data: { entriesCleared },
    message: 'News cache cleared successfully'
  });
});

// Auto-cleanup expired cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of newsCache.entries()) {
    if (now - value.timestamp >= NEWS_CACHE_TTL) {
      newsCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 News auto-cleanup: ${cleaned} expired cache entries removed`);
  }
}, 10 * 60 * 1000); // 10 minutes

export default router;
