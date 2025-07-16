import React from 'react';
import { Card, Row, Col, Statistic, Table, List, Typography, Tag, Space } from 'antd';
import { 
  FlagOutlined, 
  CheckCircleOutlined, 
  StopOutlined, 
  UserOutlined,
  BarChartOutlined 
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../services/api';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface FlagUsageRecord {
  key: string;
  flagKey: string;
  evaluations: number;
  lastAccessed: string;
}

const Dashboard: React.FC = () => {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: dashboardApi.getMetrics,
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['dashboard', 'activities'],
    queryFn: dashboardApi.getRecentActivities,
  });

  const flagUsageColumns: ColumnsType<FlagUsageRecord> = [
    {
      title: 'フラグキー',
      dataIndex: 'flagKey',
      key: 'flagKey',
      render: (text: string) => (
        <Text code style={{ fontSize: '12px' }}>
          {text}
        </Text>
      ),
    },
    {
      title: '評価回数',
      dataIndex: 'evaluations',
      key: 'evaluations',
      sorter: (a, b) => a.evaluations - b.evaluations,
      render: (value: number) => (
        <Text strong style={{ color: '#1890ff' }}>
          {value.toLocaleString()}
        </Text>
      ),
    },
    {
      title: '最終アクセス',
      dataIndex: 'lastAccessed',
      key: 'lastAccessed',
      render: (date: string) => (
        <Text type="secondary">
          {dayjs(date).format('MM/DD HH:mm')}
        </Text>
      ),
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'flag_created':
        return <FlagOutlined style={{ color: '#52c41a' }} />;
      case 'flag_updated':
        return <FlagOutlined style={{ color: '#1890ff' }} />;
      case 'tenant_override':
        return <UserOutlined style={{ color: '#722ed1' }} />;
      case 'kill_switch':
        return <StopOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <FlagOutlined />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'flag_created':
        return 'success';
      case 'flag_updated':
        return 'processing';
      case 'tenant_override':
        return 'purple';
      case 'kill_switch':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: '24px' }}>
        ダッシュボード
      </Title>

      {/* Metrics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="総フラグ数"
              value={metrics?.totalFlags || 0}
              prefix={<FlagOutlined />}
              loading={metricsLoading}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="有効フラグ"
              value={metrics?.activeFlags || 0}
              prefix={<CheckCircleOutlined />}
              loading={metricsLoading}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="Kill-Switch"
              value={metrics?.killSwitchesActive || 0}
              prefix={<StopOutlined />}
              loading={metricsLoading}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="テナント設定"
              value={metrics?.tenantsWithOverrides || 0}
              prefix={<UserOutlined />}
              loading={metricsLoading}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Flag Usage Statistics */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <BarChartOutlined />
                フラグ利用統計
              </Space>
            }
            extra={
              <Text type="secondary" style={{ fontSize: '12px' }}>
                過去24時間
              </Text>
            }
          >
            <Table
              columns={flagUsageColumns}
              dataSource={metrics?.flagUsageStats?.map((item, index) => ({
                key: index.toString(),
                ...item,
              })) || []}
              loading={metricsLoading}
              pagination={{
                pageSize: 5,
                showSizeChanger: false,
                size: 'small',
              }}
              size="small"
            />
          </Card>
        </Col>

        {/* Recent Activities */}
        <Col xs={24} lg={10}>
          <Card
            title="最近のアクティビティ"
            extra={
              <Text type="secondary" style={{ fontSize: '12px' }}>
                過去24時間
              </Text>
            }
          >
            <List
              loading={activitiesLoading}
              dataSource={activities?.slice(0, 10) || []}
              renderItem={(item) => (
                <List.Item style={{ padding: '8px 0' }}>
                  <List.Item.Meta
                    avatar={getActivityIcon(item.type)}
                    title={
                      <Space>
                        <Text style={{ fontSize: '13px' }}>
                          {item.message}
                        </Text>
                        <Tag 
                          color={getActivityColor(item.type)} 
                          style={{ fontSize: '10px', marginLeft: 'auto' }}
                        >
                          {item.type.replace('_', ' ').toUpperCase()}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          {item.user}
                        </Text>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          {dayjs(item.timestamp).format('MM/DD HH:mm')}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
              style={{ maxHeight: '400px', overflow: 'auto' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;