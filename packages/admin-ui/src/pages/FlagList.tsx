import React, { useState } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  Input, 
  Switch, 
  DatePicker, 
  Typography,
  Row,
  Col,
  Dropdown,
  message
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  MoreOutlined,
  SearchOutlined,
  FilterOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useFeatureFlags, useCreateFlag, useUpdateFlag, useDeleteFlag } from '../hooks/useFeatureFlags';
import type { FeatureFlagsTable, FlagFormData } from '../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { confirm } = Modal;

interface FlagRecord extends FeatureFlagsTable {
  key: string;
}

const FlagList: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlagsTable | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterEnabled, setFilterEnabled] = useState<boolean | undefined>(undefined);
  
  const [form] = Form.useForm<FlagFormData>();

  const { data: flags = [], isLoading } = useFeatureFlags();
  const createFlagMutation = useCreateFlag();
  const updateFlagMutation = useUpdateFlag();
  const deleteFlagMutation = useDeleteFlag();

  // Filter flags based on search and filter
  const filteredFlags = flags.filter(flag => {
    const matchesSearch = !searchText || 
      flag.flagKey.toLowerCase().includes(searchText.toLowerCase()) ||
      flag.description.toLowerCase().includes(searchText.toLowerCase()) ||
      flag.owner.toLowerCase().includes(searchText.toLowerCase());
    
    const matchesFilter = filterEnabled === undefined || flag.defaultEnabled === filterEnabled;
    
    return matchesSearch && matchesFilter;
  });

  const handleCreateFlag = () => {
    setEditingFlag(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEditFlag = (flag: FeatureFlagsTable) => {
    setEditingFlag(flag);
    form.setFieldsValue({
      flagKey: flag.flagKey,
      description: flag.description,
      defaultEnabled: flag.defaultEnabled,
      owner: flag.owner,
      expiresAt: flag.expiresAt ? flag.expiresAt : undefined,
    });
    setIsModalVisible(true);
  };

  const handleDeleteFlag = (flag: FeatureFlagsTable) => {
    confirm({
      title: 'フラグの削除',
      content: `フラグ "${flag.flagKey}" を削除しますか？この操作は取り消せません。`,
      okText: '削除',
      okType: 'danger',
      cancelText: 'キャンセル',
      onOk: () => {
        deleteFlagMutation.mutate(flag.flagKey as any);
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const formData = {
        ...values,
        expiresAt: values.expiresAt ? dayjs(values.expiresAt).toISOString() : undefined,
      };

      if (editingFlag) {
        // Update existing flag
        updateFlagMutation.mutate({
          flagKey: editingFlag.flagKey as any,
          updates: formData,
        });
      } else {
        // Create new flag
        createFlagMutation.mutate(formData);
      }
      
      setIsModalVisible(false);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const columns: ColumnsType<FlagRecord> = [
    {
      title: 'フラグキー',
      dataIndex: 'flagKey',
      key: 'flagKey',
      sorter: (a, b) => a.flagKey.localeCompare(b.flagKey),
      render: (text: string) => (
        <Text code style={{ fontSize: '12px', cursor: 'pointer' }}
          onClick={() => {
            navigator.clipboard.writeText(text);
            message.success('フラグキーをコピーしました');
          }}
        >
          {text}
        </Text>
      ),
    },
    {
      title: '説明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'デフォルト状態',
      dataIndex: 'defaultEnabled',
      key: 'defaultEnabled',
      width: 120,
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'red'}>
          {enabled ? '有効' : '無効'}
        </Tag>
      ),
      filters: [
        { text: '有効', value: true },
        { text: '無効', value: false },
      ],
      onFilter: (value, record) => record.defaultEnabled === value,
    },
    {
      title: '所有者',
      dataIndex: 'owner',
      key: 'owner',
      width: 100,
    },
    {
      title: '作成日時',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      sorter: (a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
      render: (date: string) => (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {dayjs(date).format('YYYY/MM/DD HH:mm')}
        </Text>
      ),
    },
    {
      title: '有効期限',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 160,
      render: (date?: string) => {
        if (!date) return <Text type="secondary">なし</Text>;
        
        const isExpired = dayjs(date).isBefore(dayjs());
        return (
          <Text 
            type={isExpired ? 'danger' : 'secondary'} 
            style={{ fontSize: '12px' }}
          >
            {dayjs(date).format('YYYY/MM/DD HH:mm')}
            {isExpired && <Tag color="red" style={{ marginLeft: 8 }}>期限切れ</Tag>}
          </Text>
        );
      },
    },
    {
      title: 'アクション',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Dropdown
          menu={{
            items: [
              {
                key: 'edit',
                label: '編集',
                icon: <EditOutlined />,
                onClick: () => handleEditFlag(record),
              },
              {
                key: 'delete',
                label: '削除',
                icon: <DeleteOutlined />,
                danger: true,
                onClick: () => handleDeleteFlag(record),
              },
            ],
          }}
          trigger={['click']}
        >
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      ),
    },
  ];

  const tableData: FlagRecord[] = filteredFlags.map((flag, index) => ({
    ...flag,
    key: flag.flagKey || index.toString(),
  }));

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: '24px' }}>
        フラグ管理
      </Title>

      <Card>
        {/* Header with search and filters */}
        <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
          <Col flex="auto">
            <Space size="middle">
              <Input.Search
                placeholder="フラグキー、説明、所有者で検索..."
                allowClear
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{ width: 300 }}
                prefix={<SearchOutlined />}
              />
              <Button
                icon={<FilterOutlined />}
                onClick={() => setFilterEnabled(filterEnabled === undefined ? true : 
                  filterEnabled === true ? false : undefined)}
                type={filterEnabled !== undefined ? 'primary' : 'default'}
              >
                {filterEnabled === true ? '有効のみ' : 
                 filterEnabled === false ? '無効のみ' : 'すべて'}
              </Button>
            </Space>
          </Col>
          <Col>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={handleCreateFlag}
            >
              フラグを作成
            </Button>
          </Col>
        </Row>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={tableData}
          loading={isLoading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} / ${total} 件`,
            pageSizeOptions: ['10', '20', '50', '100'],
            defaultPageSize: 20,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingFlag ? 'フラグを編集' : 'フラグを作成'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={createFlagMutation.isPending || updateFlagMutation.isPending}
        okText={editingFlag ? '更新' : '作成'}
        cancelText="キャンセル"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="flagKey"
            label="フラグキー"
            rules={[
              { required: true, message: 'フラグキーは必須です' },
              { pattern: /^[a-z0-9_]+$/, message: '小文字、数字、アンダースコアのみ使用可能です' },
            ]}
          >
            <Input 
              placeholder="例: new_feature_enable" 
              disabled={!!editingFlag}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="説明"
            rules={[{ required: true, message: '説明は必須です' }]}
          >
            <Input.TextArea 
              rows={3}
              placeholder="フラグの目的や機能について説明してください"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="defaultEnabled"
                label="デフォルト状態"
                valuePropName="checked"
              >
                <Switch 
                  checkedChildren="有効" 
                  unCheckedChildren="無効"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="owner"
                label="所有者"
                rules={[{ required: true, message: '所有者は必須です' }]}
              >
                <Input placeholder="例: team-frontend" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="expiresAt"
            label="有効期限（オプション）"
          >
            <DatePicker 
              showTime
              style={{ width: '100%' }}
              placeholder="有効期限を設定（未設定の場合は無期限）"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FlagList;