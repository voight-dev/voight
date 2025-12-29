/**
 * Dashboard Component - Main user dashboard
 */

import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Chart } from './Chart';
import { Card } from './Card';

interface UserStats {
    totalLogins: number;
    lastLogin: Date;
    accountAge: number;
    activityScore: number;
}

interface DashboardProps {
    userId: string;
}

/**
 * Main dashboard component
 */
export const Dashboard: React.FC<DashboardProps> = ({ userId }) => {
    const [stats, setStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadUserStats();
    }, [userId]);

    const loadUserStats = async () => {
        try {
            const response = await api.get(`/users/${userId}/stats`);
            setStats(response.data);
        } catch (error) {
            console.error('Failed to load stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="loading">Loading dashboard...</div>;
    }

    if (!stats) {
        return <div className="error">Failed to load dashboard</div>;
    }

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h1>Dashboard</h1>
                <p>Welcome back! Here's your activity overview.</p>
            </header>

            <div className="dashboard-grid">
                <Card title="Total Logins" value={stats.totalLogins} />
                <Card title="Last Login" value={formatDate(stats.lastLogin)} />
                <Card title="Account Age" value={`${stats.accountAge} days`} />
                <Card title="Activity Score" value={stats.activityScore} />
            </div>

            <div className="dashboard-charts">
                <UserStatsChart stats={stats} />
            </div>
        </div>
    );
};

/**
 * User statistics widget with charts
 */
const UserStatsChart: React.FC<{ stats: UserStats }> = ({ stats }) => {
    const [chartData, setChartData] = useState<any[]>([]);
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

    useEffect(() => {
        loadChartData();
    }, [timeRange]);

    const loadChartData = async () => {
        try {
            const response = await api.get(`/stats/activity?range=${timeRange}`);
            setChartData(response.data);
        } catch (error) {
            console.error('Failed to load chart data:', error);
        }
    };

    const handleTimeRangeChange = (range: '7d' | '30d' | '90d') => {
        setTimeRange(range);
    };

    return (
        <div className="user-stats-widget">
            <div className="widget-header">
                <h2>Activity Trends</h2>
                <div className="time-range-selector">
                    <button
                        onClick={() => handleTimeRangeChange('7d')}
                        className={timeRange === '7d' ? 'active' : ''}
                    >
                        7 Days
                    </button>
                    <button
                        onClick={() => handleTimeRangeChange('30d')}
                        className={timeRange === '30d' ? 'active' : ''}
                    >
                        30 Days
                    </button>
                    <button
                        onClick={() => handleTimeRangeChange('90d')}
                        className={timeRange === '90d' ? 'active' : ''}
                    >
                        90 Days
                    </button>
                </div>
            </div>

            <Chart
                data={chartData}
                type="line"
                height={300}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }}
            />

            <div className="stats-summary">
                <div className="stat-item">
                    <span className="label">Total Activity</span>
                    <span className="value">{stats.activityScore}</span>
                </div>
                <div className="stat-item">
                    <span className="label">Avg. Daily Sessions</span>
                    <span className="value">{(stats.totalLogins / stats.accountAge).toFixed(1)}</span>
                </div>
            </div>
        </div>
    );
};

function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
