'use client';

import React, { useState, useEffect } from 'react';

interface NewsItem {
  title: string;
  description: string;
  url: string;
  published_at: string;
  source: string;
  author: string;
  tags: string[];
  reading_time?: number;
  comments?: number;
  score?: number;
}

interface CyberNewsProps {
  className?: string;
}

export function CyberNews({ className = '' }: CyberNewsProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';
        const response = await fetch(`${apiBaseUrl}/news/cyber`);

        if (!response.ok) {
          throw new Error('Failed to fetch news');
        }

        const data = await response.json();
        setNews(data.news || []);
        setLastUpdated(new Date(data.last_updated));
      } catch (err: any) {
        console.error('Error fetching cyber news:', err);
        setError(err.message || 'Failed to load news');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNews();

    // Refresh every 30 minutes
    const interval = setInterval(fetchNews, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const getSourceColor = (source: string) => {
    if (source === 'r/netsec') return 'text-orange-400';
    if (source === 'Dev.to') return 'text-purple-400';
    if (source === 'The Hacker News') return 'text-red-400';
    if (source === 'Krebs on Security') return 'text-cyan-400';
    if (source === 'CISA') return 'text-green-400';
    if (source === 'Schneier on Security') return 'text-yellow-400';
    if (source === 'SecurityWeek') return 'text-indigo-400';
    if (source === 'Dark Reading') return 'text-pink-400';
    if (source === 'Threatpost') return 'text-teal-400';
    return 'text-blue-400';
  };

  const getSourceBadgeColor = (source: string) => {
    if (source === 'r/netsec') return 'bg-orange-500/20 border-orange-500/30 text-orange-400';
    if (source === 'Dev.to') return 'bg-purple-500/20 border-purple-500/30 text-purple-400';
    if (source === 'The Hacker News') return 'bg-red-500/20 border-red-500/30 text-red-400';
    if (source === 'Krebs on Security') return 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400';
    if (source === 'CISA') return 'bg-green-500/20 border-green-500/30 text-green-400';
    if (source === 'Schneier on Security') return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
    if (source === 'SecurityWeek') return 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400';
    if (source === 'Dark Reading') return 'bg-pink-500/20 border-pink-500/30 text-pink-400';
    if (source === 'Threatpost') return 'bg-teal-500/20 border-teal-500/30 text-teal-400';
    return 'bg-blue-500/20 border-blue-500/30 text-blue-400';
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading && news.length === 0) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-2xl border border-gray-600/30 shadow-2xl p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto"></div>
              <p className="text-gray-300 mt-2">Loading cybersecurity news...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Modern glass-morphism container */}
      <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-2xl border border-gray-600/30 shadow-2xl">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 rounded-2xl"></div>

        <div className="relative p-8">
          {/* Enhanced Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className="p-3 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-xl border border-cyan-500/30">
                <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>

              <div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Cybersecurity News Feed
                </h3>
                <p className="text-sm text-gray-400 mt-1">Latest updates from 9 trusted cybersecurity sources</p>
              </div>
            </div>

            {lastUpdated && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Last Updated</p>
                <p className="text-sm text-gray-300 font-mono">
                  {lastUpdated.toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* News Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto custom-scrollbar">
            {news.map((item, index) => (
              <a
                key={index}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-700/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                <div className="relative bg-gray-800/40 backdrop-blur-sm rounded-xl p-4 border border-gray-700/30 hover:border-cyan-500/30 transition-all duration-300 h-full flex flex-col">
                  {/* Source and Time */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs px-2 py-1 rounded-full border ${getSourceBadgeColor(item.source)}`}>
                      {item.source}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTimeAgo(item.published_at)}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="text-sm font-semibold text-white mb-2 line-clamp-2 group-hover:text-cyan-400 transition-colors">
                    {item.title}
                  </h4>

                  {/* Description */}
                  <p className="text-xs text-gray-400 mb-3 line-clamp-2 flex-1">
                    {item.description}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-700/30">
                    <div className="flex items-center gap-2">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="truncate max-w-[100px]">{item.author}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {item.reading_time && item.reading_time > 0 && (
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{item.reading_time}m</span>
                        </div>
                      )}
                      {item.comments !== undefined && item.comments > 0 && (
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                          </svg>
                          <span>{item.comments}</span>
                        </div>
                      )}
                      {item.score !== undefined && item.score > 0 && (
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          <span>{item.score}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.tags.slice(0, 3).map((tag, tagIndex) => (
                        <span key={tagIndex} className="text-xs px-2 py-0.5 bg-gray-700/50 text-gray-400 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>

          {/* Empty State */}
          {!isLoading && news.length === 0 && !error && (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
              <p className="text-gray-400">No news available at the moment</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
