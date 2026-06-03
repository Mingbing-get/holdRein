import { Card, Typography } from "antd";

type HealthPanelProps = {
  apiBaseUrl: string;
};

export function HealthPanel({ apiBaseUrl }: HealthPanelProps) {
  return (
    <Card title="Hold Rein Web" style={{ maxWidth: 480 }}>
      <Typography.Paragraph>
        API Base URL: {apiBaseUrl}
      </Typography.Paragraph>
    </Card>
  );
}
