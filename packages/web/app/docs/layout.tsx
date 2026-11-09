import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";
import { Brand } from "@/components/docs/Brand";
import { source } from "@/lib/source";
import "@/components/docs/docs.css";

export default function DocsRootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="santa-docs" id="main-content">
      <RootProvider theme={{ enabled: false }} search={{ options: { api: "/docs-search" } }}>
        <DocsLayout
          tree={source.getPageTree()}
          nav={{ title: <Brand />, url: "/", mode: "top" }}
          links={[
            { text: "Send a gift", url: "/send" },
          ]}
          themeSwitch={{ enabled: false }}
        >
          {children}
        </DocsLayout>
      </RootProvider>
    </div>
  );
}
