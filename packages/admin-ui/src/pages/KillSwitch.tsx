import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const KillSwitch: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Kill-Switch</Title>
      <Card>
        <p>Kill-Switch画面は今後実装予定です。</p>
      </Card>
    </div>
  );
};

export default KillSwitch;