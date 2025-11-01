"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getPriceHistory,
  getPriceHistoryByType,
  getLatestPrice,
  getPriceStats,
  savePriceChange,
  type PriceChangeEvent,
} from "~~/utils/priceHistory";
import { useDeployedContractInfo } from "../helper";
import { getParsedErrorWithAllAbis } from "~~/utils/helper/contract";
import { useWagmiEthers } from "../wagmi/useWagmiEthers";
import type { AllowedChainIds } from "~~/utils/helper/networks";
import { ethers } from "ethers";

export function usePriceHistory() {
  const { chainId, ethersReadonlyProvider, accounts } = useWagmiEthers();
  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: pixelGrid } = useDeployedContractInfo({ contractName: "PixelGrid", chainId: allowedChainId });

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const hasContract = Boolean(pixelGrid?.address && pixelGrid?.abi);
  const hasProvider = Boolean(ethersReadonlyProvider);

  const contractRead = hasContract && hasProvider
    ? new ethers.Contract(pixelGrid!.address, pixelGrid!.abi as any, ethersReadonlyProvider)
    : undefined;

  // 이벤트 리스닝 시작
  const startListeningToEvents = useCallback(async () => {
    if (!contractRead) return;

    try {
      // PixelListed 이벤트 리스닝
      contractRead.on("PixelListed", async (owner: string, tokenId: bigint, price: bigint, event: any) => {
        const block = await event.getBlock();
        const timestamp = Number(block.timestamp) * 1000; // 밀리초로 변환

        await savePriceChange({
          pixelId: Number(tokenId),
          timestamp,
          priceWei: price,
          eventType: price === 0n ? "removed" : "listed",
          fromAddress: owner,
          blockNumber: Number(event.blockNumber),
          txHash: event.transactionHash,
        });
      });

      // PixelSale 이벤트 리스닝
      contractRead.on("PixelSale", async (from: string, to: string, tokenId: bigint, price: bigint, event: any) => {
        const block = await event.getBlock();
        const timestamp = Number(block.timestamp) * 1000;

        await savePriceChange({
          pixelId: Number(tokenId),
          timestamp,
          priceWei: price,
          eventType: "sale",
          fromAddress: from,
          toAddress: to,
          blockNumber: Number(event.blockNumber),
          txHash: event.transactionHash,
        });
      });

      setMessage("Event listener started");
    } catch (e: any) {
      console.error("Event listener error:", e);
      setMessage(e?.message ?? String(e));
    }
  }, [contractRead]);

  // 과거 이벤트 불러오기 (초기 로딩 시)
  const loadHistoricalEvents = useCallback(async () => {
    if (!contractRead) return;
    setIsLoading(true);
    try {
      const currentBlock = await ethersReadonlyProvider!.getBlockNumber();
      const fromBlock = currentBlock > 10000n ? currentBlock - 10000n : 0n; // 최근 10,000 블록 (약 1-2일치, 체인에 따라 다름)

      // PixelListed 이벤트
      const listedFilter = contractRead.filters.PixelListed();
      const listedEvents = await contractRead.queryFilter(listedFilter, fromBlock);

      // PixelSale 이벤트
      const saleFilter = contractRead.filters.PixelSale();
      const saleEvents = await contractRead.queryFilter(saleFilter, fromBlock);

      // DB에 저장
      for (const event of [...listedEvents, ...saleEvents]) {
        const block = await event.getBlock();
        const timestamp = Number(block.timestamp) * 1000;

        if (event.eventName === "PixelListed") {
          const [owner, tokenId, price] = event.args as any;
          await savePriceChange({
            pixelId: Number(tokenId),
            timestamp,
            priceWei: price,
            eventType: price === 0n ? "removed" : "listed",
            fromAddress: owner,
            blockNumber: Number(event.blockNumber),
            txHash: event.transactionHash,
          });
        } else if (event.eventName === "PixelSale") {
          const [from, to, tokenId, price] = event.args as any;
          await savePriceChange({
            pixelId: Number(tokenId),
            timestamp,
            priceWei: price,
            eventType: "sale",
            fromAddress: from,
            toAddress: to,
            blockNumber: Number(event.blockNumber),
            txHash: event.transactionHash,
          });
        }
      }

      setMessage(`Loaded ${listedEvents.length + saleEvents.length} historical events`);
    } catch (e: any) {
      console.error("Load historical events error:", e);
      setMessage(e?.message ?? String(e));
    } finally {
      setIsLoading(false);
    }
  }, [contractRead, ethersReadonlyProvider]);

  // 이벤트 리스너 시작
  useEffect(() => {
    if (hasContract && hasProvider) {
      startListeningToEvents();
      loadHistoricalEvents();
    }

    return () => {
      if (contractRead) {
        contractRead.removeAllListeners();
      }
    };
  }, [hasContract, hasProvider, startListeningToEvents, loadHistoricalEvents, contractRead]);

  return useMemo(() => ({
    message,
    isLoading,
    getPriceHistory,
    getPriceHistoryByType,
    getLatestPrice,
    getPriceStats,
  }), [message, isLoading]);
}

