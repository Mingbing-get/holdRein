import { Layout } from "antd";
import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren): JSX.Element {
  return (
    <Layout style={{ minHeight: "100vh", padding: 24 }}>
      <Layout.Content>{children}</Layout.Content>
    </Layout>
  );
}
