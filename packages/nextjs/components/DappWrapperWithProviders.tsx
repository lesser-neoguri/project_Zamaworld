"use client";

import { useEffect, useState } from "react";
import { InMemoryStorageProvider } from "@fhevm-sdk";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
import { useTheme } from "next-themes";
import { Toaster } from "react-hot-toast";
import { WagmiProvider } from "wagmi";
import { Header } from "~~/components/Header";
import { BlockieAvatar } from "~~/components/helper";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";

const InfiniteScrollBanner = () => {
  return (
    <div className="relative w-full h-6 bg-black overflow-hidden">
      <div className="absolute whitespace-nowrap animate-scroll">
        <span className="inline-block mr-8 text-white text-xs">PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT •</span>
      </div>
      <div className="absolute whitespace-nowrap animate-scroll-delayed">
        <span className="inline-block mr-8 text-white text-xs">PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT • PIXEL NFT •</span>
      </div>
    </div>
  );
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export const DappWrapperWithProviders = ({ children }: { children: React.ReactNode }) => {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          avatar={BlockieAvatar}
          theme={mounted ? (isDarkMode ? darkTheme() : lightTheme()) : lightTheme()}
        >
          <ProgressBar height="3px" color="#2299dd" />
          <div className={`flex flex-col min-h-screen`}>
            <Header />
            <InfiniteScrollBanner />
            <main className="relative flex flex-col flex-1">
              <InMemoryStorageProvider>{children}</InMemoryStorageProvider>
            </main>
          </div>
          <Toaster />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
