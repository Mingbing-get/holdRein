import { Layout } from "antd";
import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <Layout style={{ minHeight: "100vh", padding: 24 }}>
      <Layout.Content>{children}</Layout.Content>
    </Layout>
  );
}
