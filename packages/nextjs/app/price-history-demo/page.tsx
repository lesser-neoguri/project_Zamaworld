"use client";

import { useState } from "react";
import { usePriceHistory } from "~~/hooks/pixelgrid/usePriceHistory";
import { formatEther } from "viem";
import { PriceHistoryChart } from "~~/components/PriceHistoryChart";

export default function PriceHistoryDemo() {
  const { getPriceHistory, getPriceStats, isLoading, message } = usePriceHistory();
  const [pixelId, setPixelId] = useState<string>("0");
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  const handleLoadHistory = async () => {
    const id = parseInt(pixelId);
    if (isNaN(id) || id < 0 || id >= 20736) {
      alert("Invalid pixel ID (0-20735)");
      return;
    }

    const h = await getPriceHistory(id);
    const s = await getPriceStats(id);
    setHistory(h);
    setStats(s);
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">픽셀 가격 변동 이력</h1>

      {message && (
        <div className="mb-4 p-3 bg-blue-100 text-blue-800 rounded">
          {message}
        </div>
      )}

      <div className="mb-8">
        <label className="block text-sm font-medium mb-2">픽셀 ID (0-20735)</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={pixelId}
            onChange={(e) => setPixelId(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
            min="0"
            max="20735"
          />
          <button
            onClick={handleLoadHistory}
            disabled={isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "로딩중..." : "이력 조회"}
          </button>
        </div>
      </div>

      {stats && (
        <div className="mb-8 p-6 bg-gray-50 rounded-lg">
          <h2 className="text-xl font-bold mb-4">통계</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">최저가</div>
              <div className="text-lg font-bold">{formatEther(stats.minPrice)} ETH</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">최고가</div>
              <div className="text-lg font-bold">{formatEther(stats.maxPrice)} ETH</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">평균가</div>
              <div className="text-lg font-bold">{formatEther(stats.avgPrice)} ETH</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">총 거래</div>
              <div className="text-lg font-bold">{stats.totalSales}회</div>
            </div>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <div className="mb-8">
            <PriceHistoryChart history={history} pixelId={parseInt(pixelId)} />
          </div>
          <h2 className="text-xl font-bold mb-4">가격 변동 이력 ({history.length}건)</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-4 py-2">타입</th>
                  <th className="border border-gray-300 px-4 py-2">가격</th>
                  <th className="border border-gray-300 px-4 py-2">일시</th>
                  <th className="border border-gray-300 px-4 py-2">블록</th>
                  <th className="border border-gray-300 px-4 py-2">거래 해시</th>
                </tr>
              </thead>
              <tbody>
                {history.map((event, idx) => (
                  <tr key={idx} className={event.eventType === "sale" ? "bg-yellow-50" : ""}>
                    <td className="border border-gray-300 px-4 py-2">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          event.eventType === "sale"
                            ? "bg-green-200"
                            : event.eventType === "listed"
                              ? "bg-blue-200"
                              : "bg-gray-200"
                        }`}
                      >
                        {event.eventType === "sale" ? "판매" : event.eventType === "listed" ? "등록" : "삭제"}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-4 py-2 font-mono">
                      {formatEther(event.priceWei)} ETH
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      {new Date(event.timestamp).toLocaleString("ko-KR")}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                      #{event.blockNumber}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 font-mono text-xs">
                      {event.txHash ? `${event.txHash.slice(0, 10)}...` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {history.length === 0 && !isLoading && (
        <div className="text-center py-8 text-gray-500">
          이력이 없습니다. 픽셀 ID를 입력하고 조회해보세요.
        </div>
      )}
    </div>
  );
}

