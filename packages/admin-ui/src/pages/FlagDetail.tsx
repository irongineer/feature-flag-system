import React from 'react';
import { useParams } from 'react-router-dom';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const FlagDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>フラグ詳細</Title>
      <Card>
        <p>フラグ ID: {id}</p>
        <p>詳細画面は今後実装予定です。</p>
      </Card>
    </div>
  );
};

export default FlagDetail;