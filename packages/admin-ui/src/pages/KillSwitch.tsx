import React, { useState } from 'react';
import { 
  Card, 
  Typography, 
  Table, 
  Switch, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Space, 
  Tag, 
  Row, 
  Col,
  Statistic,
  Alert,
  Popconfirm,
  Spin
} from 'antd';
import {
  ExclamationCircleOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useKillSwitch, type KillSwitch as KillSwitchType } from '../hooks/useKillSwitch';

const { Title } = Typography;
const { TextArea } = Input;

const KillSwitch: React.FC = () => {
  const { 
    killSwitches, 
    stats, 
    loading, 
    fetchKillSwitches, 
    activateKillSwitch, 
    deactivateKillSwitch 
  } = useKillSwitch();
  
  const [activateModal, setActivateModal] = useState<{ visible: boolean; killSwitchId?: string; loading?: boolean }>({ 
    visible: false,
    loading: false 
  });
  const [form] = Form.useForm();

  const handleActivate = async (values: { reason: string }) => {
    if (activateModal.killSwitchId) {
      setActivateModal(prev => ({ ...prev, loading: true }));
      try {
        await activateKillSwitch(activateModal.killSwitchId, values.reason);
        setActivateModal({ visible: false, loading: false });
        form.resetFields();
      } catch (error) {
        setActivateModal(prev => ({ ...prev, loading: false }));
      }
    }
  };

  const handleDeactivate = async (id: string) => {
    await deactivateKillSwitch(id);
  };

  const columns = [
    {
      title: 'スコープ',
      dataIndex: 'flagKey',
      key: 'scope',
      render: (flagKey: string | undefined) => (
        <Tag color={flagKey ? 'blue' : 'red'}>
          {flagKey ? `フラグ: ${flagKey}` : 'グローバル'}
        </Tag>
      ),
    },
    {
      title: 'ステータス',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'error' : 'success'} icon={enabled ? <WarningOutlined /> : undefined}>
          {enabled ? 'アクティブ' : '非アクティブ'}
        </Tag>
      ),
    },
    {
      title: '理由',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string) => reason || '-',
    },
    {
      title: '作成者',
      dataIndex: 'createdBy',
      key: 'createdBy',
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
      render: (_: any, record: KillSwitchType) => (
        <Space>
          {!record.enabled ? (
            <Button
              type="primary"
              danger
              size="small"
              icon={<PoweroffOutlined />}
              onClick={() => setActivateModal({ visible: true, killSwitchId: record.id })}
              data-testid="activate-killswitch-button"
            >
              有効化
            </Button>
          ) : (
            <Popconfirm
              title="Kill-Switchを無効化しますか？"
              description="この操作により、対象システムが通常動作に戻ります。"
              icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
              onConfirm={() => handleDeactivate(record.id)}
              okText="無効化"
              cancelText="キャンセル"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="default"
                size="small"
                icon={<PoweroffOutlined />}
                data-testid="deactivate-killswitch-button"
              >
                無効化
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2}>Kill-Switch 管理</Title>
          </Col>
          <Col>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchKillSwitches}
              loading={loading}
            >
              更新
            </Button>
          </Col>
        </Row>
      </div>

      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic 
              title="アクティブKill-Switch" 
              value={stats.totalActive}
              valueStyle={{ color: stats.totalActive > 0 ? '#cf1322' : '#52c41a' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="グローバルKill-Switch" 
              value={stats.globalKillSwitchActive ? 'アクティブ' : '非アクティブ'}
              valueStyle={{ color: stats.globalKillSwitchActive ? '#cf1322' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="フラグ固有Kill-Switch" 
              value={stats.flagSpecificKillSwitches}
              prefix={<PoweroffOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="最終更新" 
              value={stats.lastActivated ? new Date(stats.lastActivated).toLocaleDateString('ja-JP') : '-'}
            />
          </Card>
        </Col>
      </Row>

      {/* Alert for active kill switches */}
      {stats.totalActive > 0 && (
        <Alert
          message={`${stats.totalActive}件のKill-Switchがアクティブです`}
          description="アクティブなKill-Switchは対象機能の動作を停止させます。運用に注意してください。"
          type="warning"
          icon={<WarningOutlined />}
          style={{ marginBottom: '24px' }}
          showIcon
        />
      )}

      {/* Kill Switch Table */}
      <Card title="Kill-Switch一覧">
        <Spin spinning={loading}>
          <Table
            dataSource={killSwitches}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            data-testid="killswitch-table"
          />
        </Spin>
      </Card>

      {/* Activate Kill Switch Modal */}
      <Modal
        title="Kill-Switch有効化"
        open={activateModal.visible}
        onCancel={() => !activateModal.loading && setActivateModal({ visible: false })}
        footer={null}
        data-testid="killswitch-modal"
        maskClosable={!activateModal.loading}
        closable={!activateModal.loading}
        confirmLoading={activateModal.loading}
      >
        <Alert
          message="緊急停止機能"
          description="Kill-Switchを有効化すると、対象機能が即座に無効化されます。この操作は慎重に行ってください。"
          type="warning"
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: '16px' }}
          showIcon
        />
        
        <Form form={form} onFinish={handleActivate} layout="vertical">
          <Form.Item
            name="reason"
            label="有効化理由"
            rules={[{ required: true, message: '理由を入力してください' }]}
          >
            <TextArea
              rows={3}
              placeholder="例：本番環境で重大なエラーが発生したため緊急停止"
              maxLength={500}
              showCount
            />
          </Form.Item>
          
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button 
                onClick={() => setActivateModal({ visible: false })}
                disabled={activateModal.loading}
              >
                キャンセル
              </Button>
              <Button 
                type="primary" 
                danger 
                htmlType="submit" 
                icon={<PoweroffOutlined />}
                loading={activateModal.loading}
              >
                Kill-Switch有効化
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default KillSwitch;