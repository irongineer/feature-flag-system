import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Typography, 
  Table, 
  Button, 
  Select, 
  Space, 
  Tag, 
  Switch, 
  Row, 
  Col,
  Input,
  Modal,
  Form,
  Alert,
  Divider,
  Spin,
  Tooltip,
  Popconfirm
} from 'antd';
import {
  SettingOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UserOutlined,
  FlagOutlined,
  EditOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useTenantOverrides, useSetTenantOverride, useRemoveTenantOverride } from '../hooks/useTenantOverrides';
import type { FeatureFlagKey } from '../types';

const { Title, Text } = Typography;
const { Option } = Select;

interface TenantOverride {
  tenantId: string;
  flagKey: FeatureFlagKey;
  enabled: boolean;
  updatedBy: string;
  updatedAt: string;
}

// Mock data for demonstration (since API may not be fully implemented)
const mockTenants = [
  { id: 'tenant-001', name: 'Acme Corporation', plan: 'Enterprise' },
  { id: 'tenant-002', name: 'TechStart Inc', plan: 'Professional' },
  { id: 'tenant-003', name: 'Beta Testing Co', plan: 'Basic' },
  { id: 'test-tenant-1', name: 'Test Tenant 1', plan: 'Development' },
  { id: 'test-tenant-disabled', name: 'Test Tenant (Disabled)', plan: 'Development' },
];

const mockFlags: FeatureFlagKey[] = [
  'billing_v2_enable',
  'new_dashboard_enable', 
  'advanced_analytics_enable',
  'real_time_notifications_enable',
  'enhanced_security_enable',
];

const TenantSettings: React.FC = () => {
  const [selectedTenant, setSelectedTenant] = useState<string>('tenant-001');
  const [searchTerm, setSearchTerm] = useState('');
  const [overrideModal, setOverrideModal] = useState<{ visible: boolean; flagKey?: FeatureFlagKey; loading?: boolean }>({ 
    visible: false,
    loading: false 
  });
  const [toggleLoadingFlags, setToggleLoadingFlags] = useState<Set<string>>(new Set());
  const [mockOverrides, setMockOverrides] = useState<TenantOverride[]>([
    {
      tenantId: 'tenant-001',
      flagKey: 'billing_v2_enable',
      enabled: true,
      updatedBy: 'admin@example.com',
      updatedAt: new Date().toISOString(),
    },
    {
      tenantId: 'tenant-001', 
      flagKey: 'new_dashboard_enable',
      enabled: false,
      updatedBy: 'support@example.com',
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    }
  ]);

  const [form] = Form.useForm();

  // Use the hook for API integration (with fallback to mock data)
  const { data: tenantOverrides, isLoading, refetch } = useTenantOverrides(selectedTenant);
  const setTenantOverrideMutation = useSetTenantOverride();
  const removeTenantOverrideMutation = useRemoveTenantOverride();

  // Use mock data if API is not available, otherwise use real data
  const displayOverrides = tenantOverrides || mockOverrides.filter(o => o.tenantId === selectedTenant);

  const handleToggleOverride = async (flagKey: FeatureFlagKey, enabled: boolean) => {
    // Add loading state for this specific flag
    setToggleLoadingFlags(prev => new Set(prev).add(flagKey));
    
    try {
      // Try API first, fall back to mock data update
      await setTenantOverrideMutation.mutateAsync({
        tenantId: selectedTenant,
        flagKey,
        enabled,
        updatedBy: 'current-user@example.com'
      });
    } catch (error) {
      // Update mock data for demo purposes
      setMockOverrides(prev => {
        const existing = prev.find(o => o.tenantId === selectedTenant && o.flagKey === flagKey);
        if (existing) {
          return prev.map(o => 
            o.tenantId === selectedTenant && o.flagKey === flagKey 
              ? { ...o, enabled, updatedAt: new Date().toISOString() }
              : o
          );
        } else {
          return [...prev, {
            tenantId: selectedTenant,
            flagKey,
            enabled,
            updatedBy: 'current-user@example.com',
            updatedAt: new Date().toISOString(),
          }];
        }
      });
    } finally {
      // Remove loading state
      setToggleLoadingFlags(prev => {
        const next = new Set(prev);
        next.delete(flagKey);
        return next;
      });
    }
  };

  const handleRemoveOverride = async (flagKey: FeatureFlagKey) => {
    try {
      await removeTenantOverrideMutation.mutateAsync({
        tenantId: selectedTenant,
        flagKey
      });
    } catch (error) {
      // Remove from mock data for demo purposes
      setMockOverrides(prev => 
        prev.filter(o => !(o.tenantId === selectedTenant && o.flagKey === flagKey))
      );
    }
  };

  const handleAddOverride = async (values: { flagKey: FeatureFlagKey; enabled: boolean }) => {
    setOverrideModal(prev => ({ ...prev, loading: true }));
    try {
      await handleToggleOverride(values.flagKey, values.enabled);
      setOverrideModal({ visible: false, loading: false });
      form.resetFields();
    } catch (error) {
      setOverrideModal(prev => ({ ...prev, loading: false }));
    }
  };

  const filteredTenants = mockTenants.filter(tenant => 
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableFlags = mockFlags.filter(flagKey =>
    !displayOverrides.some(override => override.flagKey === flagKey)
  );

  const columns = [
    {
      title: 'フラグキー',
      dataIndex: 'flagKey',
      key: 'flagKey',
      render: (flagKey: string) => (
        <Space>
          <FlagOutlined />
          <Text code>{flagKey}</Text>
        </Space>
      ),
    },
    {
      title: '設定値',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, record: TenantOverride) => {
        const isLoading = toggleLoadingFlags.has(record.flagKey) || setTenantOverrideMutation.isPending;
        return (
          <Tooltip title={`クリックして${enabled ? '無効' : '有効'}に変更`}>
            <Switch
              checked={enabled}
              onChange={(checked) => handleToggleOverride(record.flagKey, checked)}
              checkedChildren="有効"
              unCheckedChildren="無効"
              loading={isLoading}
            />
          </Tooltip>
        );
      },
    },
    {
      title: 'ステータス',
      dataIndex: 'enabled',
      key: 'status',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'success' : 'error'}>
          {enabled ? '有効' : '無効'}
        </Tag>
      ),
    },
    {
      title: '更新者',
      dataIndex: 'updatedBy',
      key: 'updatedBy',
      render: (updatedBy: string) => (
        <Space>
          <UserOutlined />
          <Text>{updatedBy}</Text>
        </Space>
      ),
    },
    {
      title: '更新日時',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (updatedAt: string) => new Date(updatedAt).toLocaleString('ja-JP'),
    },
    {
      title: 'アクション',
      key: 'actions',
      render: (_: any, record: TenantOverride) => (
        <Space>
          <Tooltip title="編集">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => setOverrideModal({ visible: true, flagKey: record.flagKey })}
            />
          </Tooltip>
          <Popconfirm
            title="オーバーライドを削除しますか？"
            description="この操作により、このテナントではデフォルト設定が適用されます。"
            onConfirm={() => handleRemoveOverride(record.flagKey)}
            okText="削除"
            cancelText="キャンセル"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="削除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                loading={removeTenantOverrideMutation.isPending}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2}>テナント設定</Title>
          </Col>
          <Col>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={refetch}
              loading={isLoading}
            >
              更新
            </Button>
          </Col>
        </Row>
      </div>

      {/* Tenant Selection */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={16} align="middle">
          <Col span={6}>
            <Text strong>テナント選択:</Text>
          </Col>
          <Col span={10}>
            <Select
              value={selectedTenant}
              onChange={setSelectedTenant}
              style={{ width: '100%' }}
              showSearch
              placeholder="テナントを選択"
              optionFilterProp="children"
              data-testid="tenant-select"
            >
              {mockTenants.map(tenant => (
                <Option key={tenant.id} value={tenant.id}>
                  <Space>
                    <UserOutlined />
                    <span>{tenant.name}</span>
                    <Tag size="small">{tenant.plan}</Tag>
                  </Space>
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={8}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="テナント検索"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
        </Row>
        
        {selectedTenant && (
          <div style={{ marginTop: '16px' }}>
            <Alert
              message={`選択中テナント: ${mockTenants.find(t => t.id === selectedTenant)?.name}`}
              description={`テナントID: ${selectedTenant}`}
              type="info"
              showIcon
            />
          </div>
        )}
      </Card>

      {/* Tenant Overrides Table */}
      <Card 
        title={
          <Space>
            <SettingOutlined />
            <span>テナントオーバーライド設定</span>
            <Tag>{displayOverrides.length}件</Tag>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<FlagOutlined />}
            onClick={() => setOverrideModal({ visible: true })}
            disabled={availableFlags.length === 0}
          >
            オーバーライド追加
          </Button>
        }
      >
        <Spin spinning={isLoading}>
          <Table
            dataSource={displayOverrides}
            columns={columns}
            rowKey={record => `${record.tenantId}-${record.flagKey}`}
            pagination={{ pageSize: 10 }}
            data-testid="tenant-overrides-table"
            locale={{
              emptyText: 'このテナントにはオーバーライド設定がありません'
            }}
          />
        </Spin>
      </Card>

      {/* Add/Edit Override Modal */}
      <Modal
        title={overrideModal.flagKey ? 'オーバーライド編集' : 'オーバーライド追加'}
        open={overrideModal.visible}
        onCancel={() => !overrideModal.loading && setOverrideModal({ visible: false })}
        footer={null}
        data-testid="tenant-override-modal"
        maskClosable={!overrideModal.loading}
        closable={!overrideModal.loading}
        confirmLoading={overrideModal.loading}
      >
        <Form form={form} onFinish={handleAddOverride} layout="vertical">
          <Form.Item
            name="flagKey"
            label="フラグ"
            rules={[{ required: true, message: 'フラグを選択してください' }]}
            initialValue={overrideModal.flagKey}
          >
            <Select 
              placeholder="フラグを選択"
              disabled={!!overrideModal.flagKey}
            >
              {availableFlags.map(flagKey => (
                <Option key={flagKey} value={flagKey}>
                  <Space>
                    <FlagOutlined />
                    <Text code>{flagKey}</Text>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="enabled"
            label="設定値"
            rules={[{ required: true, message: '設定値を選択してください' }]}
            initialValue={
              overrideModal.flagKey 
                ? displayOverrides.find(o => o.flagKey === overrideModal.flagKey)?.enabled
                : true
            }
          >
            <Select>
              <Option value={true}>
                <Tag color="success">有効</Tag>
              </Option>
              <Option value={false}>
                <Tag color="error">無効</Tag>
              </Option>
            </Select>
          </Form.Item>
          
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button 
                onClick={() => setOverrideModal({ visible: false })}
                disabled={overrideModal.loading}
              >
                キャンセル
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                icon={<SettingOutlined />}
                loading={overrideModal.loading}
              >
                {overrideModal.flagKey ? '更新' : '追加'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TenantSettings;