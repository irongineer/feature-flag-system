import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const TenantSettings: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>テナント設定</Title>
      <Card>
        <p>テナント設定画面は今後実装予定です。</p>
      </Card>
    </div>
  );
};

export default TenantSettings;