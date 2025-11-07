const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const SEARCH_ENGINE_ID = process.env.REACT_APP_SEARCH_ENGINE_ID;

class SearchService {
  constructor() {
    this.cache = new Map();
    this.rateLimiter = { requests: 0, resetTime: Date.now() + 86400000 };
  }

  async searchGoogle(query, options = {}) {
    // Rate limiting
    if (this.rateLimiter.requests >= 100 && Date.now() < this.rateLimiter.resetTime) {
      throw new Error("Rate limit exceeded");
    }

    // Check cache
    const cacheKey = `${query}_${JSON.stringify(options)}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const url = `https://www.googleapis.com/customsearch/v1?key= ${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=5`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Search failed: ${response.status}`);
      
      const data = await response.json();
      const results = this.parseSearchResults(data);
      
      // Cache results
      this.cache.set(cacheKey, results);
      this.rateLimiter.requests++;
      
      return results;
    } catch (error) {
      console.error("Google Search Error:", error);
      return [];
    }
  }

  parseSearchResults(data) {
    if (!data.items) return [];
    
    return data.items.map(item => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      confidence: this.calculateConfidence(item),
      source: this.extractDomain(item.link),
      publishDate: item.pagemap?.metatags?.[0]?.["article:published_time"] || null
    }));
  }

  calculateConfidence(item) {
    let confidence = 0.5;
    
    // Boost for trusted domains
    const trustedDomains = ['gov', 'edu', 'org', 'wikipedia.org', 'reuters.com', 'bbc.com'];
    if (trustedDomains.some(domain => item.link.includes(domain))) {
      confidence += 0.3;
    }
    
    // Recent content boost
    if (item.pagemap?.metatags?.[0]?.["article:published_time"]) {
      const publishDate = new Date(item.pagemap.metatags[0]["article:published_time"]);
      const daysSince = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) confidence += 0.2;
    }
    
    return Math.min(confidence, 1.0);
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  reformulateQuery(userQuery, context = {}) {
    // Current affairs detection
    const currentAffairsKeywords = ['current', 'latest', 'recent', 'today', 'now', 'who is', 'collector', 'minister', 'president'];
    const isCurrentAffairs = currentAffairsKeywords.some(keyword => 
      userQuery.toLowerCase().includes(keyword)
    );

    if (isCurrentAffairs) {
      return `${userQuery} 2024 current latest`;
    }

    return userQuery;
  }

  async groundedSearch(query, agentId = 'general') {
    const reformulatedQuery = this.reformulateQuery(query);
    const searchResults = await this.searchGoogle(reformulatedQuery);
    
    return {
      query: reformulatedQuery,
      results: searchResults,
      summary: this.generateSummary(searchResults),
      confidence: this.calculateOverallConfidence(searchResults)
    };
  }

  generateSummary(results) {
    if (!results.length) return "No recent information found.";
    
    const topResult = results[0];
    return `Based on recent search results: ${topResult.snippet}`;
  }

  calculateOverallConfidence(results) {
    if (!results.length) return 0.1;
    
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    return Math.round(avgConfidence * 100) / 100;
  }
}

export const searchService = new SearchService();
export default searchService;