'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { 
  BarChart3, 
  Clock, 
  Database, 
  TrendingUp, 
  Zap,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import ApiClient from '@/app/lib/api';
import { toast } from 'sonner';

interface MetricsData {
  total_requests: number;
  avg_duration_ms: number;
  avg_queries: number;
  slowest_requests: Array<{
    method: string;
    path: string;
    status_code: number;
    duration_ms: number;
    query_count: number | null;
    created_at: string;
  }>;
  top_endpoints: Array<{
    path: string;
    count: number;
    avg_duration_ms: number;
    avg_queries: number;
  }>;
  requests_by_hour: Array<{ hour: string; count: number }>;
}

export default function PerformancePage() {
  const t = useTranslations();
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

  const loadMetrics = () => {
    setLoading(true);
    ApiClient.getMetricsSummary(hours, 20)
      .then(setMetrics)
      .catch(() => toast.error('Failed to load metrics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMetrics();
  }, [hours]);

  const formatDuration = (ms: number) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
  };

  const getDurationColor = (ms: number) => {
    if (ms > 5000) return 'text-red-600';
    if (ms > 2000) return 'text-orange-600';
    if (ms > 1000) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getQueryColor = (queries: number | null) => {
    if (queries === null) return 'text-muted-foreground';
    if (queries > 50) return 'text-red-600';
    if (queries > 20) return 'text-orange-600';
    if (queries > 10) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance</h1>
          <p className="text-muted-foreground mt-1">
            API request timing and query analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={hours} 
            onChange={(e) => setHours(Number(e.target.value))}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value={1}>Last 1 hour</option>
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={72}>Last 3 days</option>
            <option value={168}>Last 7 days</option>
          </select>
          <button 
            onClick={loadMetrics}
            disabled={loading}
            className="p-2 border rounded-md hover:bg-muted"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : metrics ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Total Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.total_requests.toLocaleString()}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Avg Duration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatDuration(metrics.avg_duration_ms)}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Avg Queries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.avg_queries.toFixed(1)}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Slow Endpoints
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.top_endpoints.filter(e => e.avg_duration_ms > 1000).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Endpoints by Duration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Slowest Endpoints (by average duration)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.top_endpoints.length === 0 ? (
                  <p className="text-muted-foreground">No data available</p>
                ) : (
                  metrics.top_endpoints.map((endpoint, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/40"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-muted-foreground w-16">
                          #{idx + 1}
                        </span>
                        <span className="font-mono text-sm max-w-[300px] truncate">
                          {endpoint.path}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className={`font-bold ${getDurationColor(endpoint.avg_duration_ms)}`}>
                            {formatDuration(endpoint.avg_duration_ms)}
                          </div>
                          <div className="text-xs text-muted-foreground">avg</div>
                        </div>
                        <div className="text-center">
                          <div className={`font-bold ${getQueryColor(endpoint.avg_queries)}`}>
                            {endpoint.avg_queries.toFixed(0)}
                          </div>
                          <div className="text-xs text-muted-foreground">queries</div>
                        </div>
                        <div className="text-center w-16">
                          <div className="text-muted-foreground">
                            {endpoint.count}
                          </div>
                          <div className="text-xs text-muted-foreground">requests</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Slowest Individual Requests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Slowest Individual Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics.slowest_requests.length === 0 ? (
                  <p className="text-muted-foreground">No data available</p>
                ) : (
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-3 pb-2">
                    <div className="col-span-1">Method</div>
                    <div className="col-span-5">Path</div>
                    <div className="col-span-2 text-center">Duration</div>
                    <div className="col-span-2 text-center">Queries</div>
                    <div className="col-span-2 text-right">Time</div>
                  </div>
                )}
                {metrics.slowest_requests.map((req, idx) => (
                  <div 
                    key={idx}
                    className="grid grid-cols-12 gap-2 text-sm p-3 rounded-lg bg-muted/40 items-center"
                  >
                    <div className="col-span-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        req.method === 'GET' ? 'bg-blue-100 text-blue-800' :
                        req.method === 'POST' ? 'bg-green-100 text-green-800' :
                        req.method === 'PATCH' ? 'bg-yellow-100 text-yellow-800' :
                        req.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {req.method}
                      </span>
                    </div>
                    <div className="col-span-5 font-mono text-xs truncate">
                      {req.path}
                    </div>
                    <div className={`col-span-2 text-center font-bold ${getDurationColor(req.duration_ms)}`}>
                      {formatDuration(req.duration_ms)}
                    </div>
                    <div className={`col-span-2 text-center ${getQueryColor(req.query_count)}`}>
                      {req.query_count ?? '-'}
                    </div>
                    <div className="col-span-2 text-right text-muted-foreground text-xs">
                      {new Date(req.created_at).toLocaleTimeString('cs-CZ')}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No metrics data available
          </CardContent>
        </Card>
      )}
    </div>
  );
}
