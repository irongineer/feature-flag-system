import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const AuditLogs: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>監査ログ</Title>
      <Card>
        <p>監査ログ画面は今後実装予定です。</p>
      </Card>
    </div>
  );
};

export default AuditLogs;