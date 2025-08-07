import React, { useState, useEffect } from 'react';
import { metrics, logger } from '../services/monitoringService';

interface MonitoringStats {
  errors: {
    total: number;
    byLevel: Record<string, number>;
    recent: any[];
  };
  performance: {
    total: number;
    average: number;
    slowest: any[];
    recent: any[];
  };
  tokens: {
    total: number;
    cost: number;
    byModel: Record<string, { tokens: number; cost: number }>;
    recent: any[];
  };
  api: {
    total: number;
    successRate: number;
    averageResponseTime: number;
    recent: any[];
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
    timestamp: Date;
  };
}

const MonitoringDashboard: React.FC = () => {
  const [stats, setStats] = useState<MonitoringStats | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'errors' | 'performance' | 'tokens' | 'api' | 'cache'>('overview');
  const [refreshInterval, setRefreshInterval] = useState(5000);

  useEffect(() => {
    const updateStats = () => {
      const currentStats = metrics.getStats();
      setStats(currentStats);
    };

    updateStats();
    const interval = setInterval(updateStats, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(4)}`;
  };

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }): string => {
    if (value <= thresholds.good) return 'text-green-600';
    if (value <= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  const clearData = () => {
    if (confirm('Вы уверены, что хотите очистить все данные мониторинга?')) {
      metrics.clearData();
      setStats(metrics.getStats());
    }
  };

  const exportData = () => {
    const data = metrics.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monitoring-data-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg z-50"
        title="Открыть мониторинг"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>
    );
  }

  if (!stats) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Загрузка данных мониторинга...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Мониторинг системы</h2>
          <div className="flex items-center space-x-2">
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="text-sm border rounded px-2 py-1"
            >
              <option value={1000}>1 сек</option>
              <option value={5000}>5 сек</option>
              <option value={10000}>10 сек</option>
              <option value={30000}>30 сек</option>
            </select>
            <button
              onClick={exportData}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
            >
              Экспорт
            </button>
            <button
              onClick={clearData}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
            >
              Очистить
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="bg-gray-600 hover:bg-gray-700 text-white p-2 rounded"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Вкладки */}
        <div className="flex border-b">
          {[
            { id: 'overview', label: 'Обзор' },
            { id: 'errors', label: 'Ошибки' },
            { id: 'performance', label: 'Производительность' },
            { id: 'tokens', label: 'Токены' },
            { id: 'api', label: 'API' },
            { id: 'cache', label: 'Кэш' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Ошибки */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-red-800">Ошибки</h3>
                <p className="text-2xl font-bold text-red-600">{stats.errors.total}</p>
                <p className="text-sm text-red-600">
                  Критических: {stats.errors.byLevel.error || 0} | Фатальных: {stats.errors.byLevel.fatal || 0}
                </p>
              </div>

              {/* Производительность */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-800">Производительность</h3>
                <p className="text-2xl font-bold text-blue-600">{formatDuration(stats.performance.average)}</p>
                <p className="text-sm text-blue-600">Среднее время операций</p>
              </div>

              {/* Токены */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-800">Токены</h3>
                <p className="text-2xl font-bold text-green-600">{stats.tokens.total.toLocaleString()}</p>
                <p className="text-sm text-green-600">Стоимость: {formatCost(stats.tokens.cost)}</p>
              </div>

              {/* API */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-purple-800">API</h3>
                <p className="text-2xl font-bold text-purple-600">{formatPercentage(stats.api.successRate)}</p>
                <p className="text-sm text-purple-600">Успешность запросов</p>
              </div>
            </div>
          )}

          {activeTab === 'errors' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(stats.errors.byLevel).map(([level, count]) => (
                  <div key={level} className="bg-gray-50 border rounded-lg p-3">
                    <h4 className="font-medium text-gray-800 capitalize">{level}</h4>
                    <p className="text-xl font-bold text-gray-900">{count}</p>
                  </div>
                ))}
              </div>
              
              <div className="bg-gray-50 border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Последние ошибки</h3>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {stats.errors.recent.map((error, index) => (
                    <div key={index} className="bg-white border rounded p-3">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          error.level === 'error' ? 'bg-red-100 text-red-800' :
                          error.level === 'fatal' ? 'bg-red-200 text-red-900' :
                          error.level === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {error.level.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(error.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 mt-1">{error.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-800">Общая статистика</h3>
                  <p className="text-2xl font-bold text-blue-600">{stats.performance.total}</p>
                  <p className="text-sm text-blue-600">Всего операций</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-800">Среднее время</h3>
                  <p className="text-2xl font-bold text-green-600">{formatDuration(stats.performance.average)}</p>
                  <p className="text-sm text-green-600">На операцию</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-yellow-800">Медленные операции</h3>
                  <p className="text-2xl font-bold text-yellow-600">{stats.performance.slowest.length}</p>
                  <p className="text-sm text-yellow-600">&gt; 5 секунд</p>
                </div>
              </div>

              <div className="bg-gray-50 border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Самые медленные операции</h3>
                <div className="space-y-2">
                  {stats.performance.slowest.map((op, index) => (
                    <div key={index} className="bg-white border rounded p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800">{op.operation}</span>
                        <span className="text-lg font-bold text-red-600">{formatDuration(op.duration)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs px-2 py-1 rounded ${
                          op.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {op.success ? 'Успешно' : 'Ошибка'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(op.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tokens' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-800">Общее использование</h3>
                  <p className="text-2xl font-bold text-green-600">{stats.tokens.total.toLocaleString()}</p>
                  <p className="text-sm text-green-600">токенов</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-800">Общая стоимость</h3>
                  <p className="text-2xl font-bold text-blue-600">{formatCost(stats.tokens.cost)}</p>
                  <p className="text-sm text-blue-600">USD</p>
                </div>
              </div>

              <div className="bg-gray-50 border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Использование по моделям</h3>
                <div className="space-y-2">
                  {Object.entries(stats.tokens.byModel).map(([model, data]) => (
                    <div key={model} className="bg-white border rounded p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800">{model}</span>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">{data.tokens.toLocaleString()} токенов</p>
                          <p className="text-xs text-gray-600">{formatCost(data.cost)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-purple-800">Всего запросов</h3>
                  <p className="text-2xl font-bold text-purple-600">{stats.api.total}</p>
                  <p className="text-sm text-purple-600">API вызовов</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-800">Успешность</h3>
                  <p className={`text-2xl font-bold ${getStatusColor(stats.api.successRate, { good: 0.95, warning: 0.9 })}`}>
                    {formatPercentage(stats.api.successRate)}
                  </p>
                  <p className="text-sm text-green-600">запросов</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-800">Среднее время</h3>
                  <p className="text-2xl font-bold text-blue-600">{formatDuration(stats.api.averageResponseTime)}</p>
                  <p className="text-sm text-blue-600">ответа</p>
                </div>
              </div>

              <div className="bg-gray-50 border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Последние запросы</h3>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {stats.api.recent.map((req, index) => (
                    <div key={index} className="bg-white border rounded p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            req.status < 400 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {req.method} {req.status}
                          </span>
                          <span className="ml-2 text-sm text-gray-600">{req.url}</span>
                        </div>
                        <span className="text-sm text-gray-500">{formatDuration(req.duration)}</span>
                      </div>
                      {req.error && (
                        <p className="text-xs text-red-600 mt-1">{req.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cache' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-800">Попадания</h3>
                  <p className="text-2xl font-bold text-green-600">{stats.cache.hits}</p>
                  <p className="text-sm text-green-600">успешных</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-red-800">Промахи</h3>
                  <p className="text-2xl font-bold text-red-600">{stats.cache.misses}</p>
                  <p className="text-sm text-red-600">неудачных</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-800">Эффективность</h3>
                  <p className={`text-2xl font-bold ${getStatusColor(stats.cache.hitRate, { good: 0.8, warning: 0.6 })}`}>
                    {formatPercentage(stats.cache.hitRate)}
                  </p>
                  <p className="text-sm text-blue-600">hit rate</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-yellow-800">Размер</h3>
                  <p className="text-2xl font-bold text-yellow-600">{stats.cache.size}</p>
                  <p className="text-sm text-yellow-600">записей</p>
                </div>
              </div>

              <div className="bg-gray-50 border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Информация о кэше</h3>
                <div className="space-y-2">
                  <div className="bg-white border rounded p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-800">Последнее обновление</span>
                      <span className="text-sm text-gray-600">
                        {new Date(stats.cache.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white border rounded p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-800">Общее количество запросов</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {stats.cache.hits + stats.cache.misses}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonitoringDashboard;
