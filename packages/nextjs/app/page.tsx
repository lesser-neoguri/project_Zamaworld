"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type WheelEvent, type MouseEvent } from "react";
import { usePixelGrid } from "../hooks/pixelgrid/usePixelGrid";

export default function Home() {
  const formatWeiToEth = (wei: bigint) => {
    const s = wei.toString();
    const decimals = 18;
    if (s.length <= decimals) {
      const padded = s.padStart(decimals, "0");
      const intPart = "0";
      const fracPart = padded;
      return `${intPart}.${fracPart}`.replace(/\.?0+$/, "");
    }
    const intPart = s.slice(0, s.length - decimals);
    const fracRaw = s.slice(s.length - decimals);
    const fracPart = fracRaw.replace(/0+$/, "");
    return fracPart ? `${intPart}.${fracPart}` : intPart;
  };

  // Pricing scale: 1 unit = 0.01 ETH = 1e16 wei
  const UNIT_TO_WEI = 10n ** 16n;
  const unitsToWei = (units: bigint) => units * UNIT_TO_WEI;
  const weiToUnits = (wei: bigint) => wei / UNIT_TO_WEI;
  const { pixels, isRefreshing, refresh, mint, setPrice, buy, setColor, account, message } = usePixelGrid() as any;
  const [priceInput, setPriceInput] = useState<Record<number, string>>({});
  const [colorInput, setColorInput] = useState<Record<number, string>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewport, setViewport] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateViewport = () => {
      if (typeof window === "undefined") return;
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const selected = useMemo(() => (selectedId != null ? pixels?.[selectedId] : undefined), [selectedId, pixels]);
  const selectedOwned = Boolean(selected?.exists);
  const selectedForSale = (selected?.priceWei ?? 0n) > 0n;
  const isSelectedOwner = selectedOwned && selected?.owner && account && selected.owner.toLowerCase() === String(account).toLowerCase();

  // 계정이 소유한 픽셀 목록
  const ownedPixels = useMemo(() => {
    if (!account || !pixels) return [];
    const owned: Array<{ id: number; colorRgb: number; priceWei: bigint }> = [];
    for (const [idStr, pixel] of Object.entries(pixels)) {
      const p = pixel as { exists: boolean; owner?: string; colorRgb: number; priceWei: bigint };
      if (p.exists && p.owner && p.owner.toLowerCase() === String(account).toLowerCase()) {
        owned.push({
          id: Number(idStr),
          colorRgb: p.colorRgb,
          priceWei: p.priceWei,
        });
      }
    }
    return owned.sort((a, b) => a.id - b.id);
  }, [account, pixels]);

  const gridWidth = 192; // 16:9 비율
  const gridHeight = 108;
  const gridSize = gridWidth; // 기존 코드 호환성을 위해
  const baseCellSize = useMemo(() => {
    const paddingHorizontal = 160;
    const paddingVertical = 220;
    const gapHorizontal = (gridWidth - 1) * 1;
    const gapVertical = (gridHeight - 1) * 1;
    const availableWidth = Math.max(320, viewport.width - paddingHorizontal - gapHorizontal);
    const availableHeight = Math.max(320, viewport.height - paddingVertical - gapVertical);
    const candidateWidth = Math.floor(availableWidth / gridWidth);
    const candidateHeight = Math.floor(availableHeight / gridHeight);
    const candidate = Math.min(candidateWidth, candidateHeight);
    return Math.max(3, Math.min(candidate, 50));
  }, [viewport.width, viewport.height, gridWidth, gridHeight]);

  const cellSize = useMemo(() => Math.round(baseCellSize * zoom), [baseCellSize, zoom]);
  const gap = 1;

  const canvasWidth = useMemo(() => {
    return cellSize * gridWidth + gap * (gridWidth - 1);
  }, [cellSize, gap, gridWidth]);

  const canvasHeight = useMemo(() => {
    return cellSize * gridHeight + gap * (gridHeight - 1);
  }, [cellSize, gap, gridHeight]);

  // Canvas 렌더링
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pixels) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 캔버스 크기 설정
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // 배경 투명
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // zoom이 너무 작으면 렌더링 생략 (최적화)
    const MIN_ZOOM_FOR_RENDER = 0.2;
    if (zoom < MIN_ZOOM_FOR_RENDER) {
      return;
    }

    // 각 픽셀 그리기
    for (let id = 0; id < gridWidth * gridHeight; id++) {
      const row = Math.floor(id / gridWidth);
      const col = id % gridWidth;
      const x = col * (cellSize + gap);
      const y = row * (cellSize + gap);

      const p = pixels[id];
      const colorRgb = p?.colorRgb ?? 0;
      
      // 배경색
      if (colorRgb === 0) {
        ctx.fillStyle = "transparent";
      } else {
        const hex = colorRgb.toString(16).padStart(6, "0");
        ctx.fillStyle = `#${hex}`;
      }
      ctx.fillRect(x, y, cellSize, cellSize);

      // 테두리: 선택됨(파랑) / 가격 미설정(연회색) / 기본(회색)
      if (selectedId === id) {
        ctx.strokeStyle = "#2563eb"; // blue-600
        ctx.lineWidth = 2;
      } else if (!p || (p.priceWei ?? 0n) === 0n) {
        ctx.strokeStyle = "#d1d5db"; // gray-300 for not priced
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = "#9ca3af"; // gray-400
        ctx.lineWidth = 1;
      }
      ctx.strokeRect(x, y, cellSize, cellSize);
    }
  }, [pixels, cellSize, gap, canvasWidth, canvasHeight, selectedId, gridWidth, gridHeight, zoom]);

  const handleZoomWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    // 모든 휠 이벤트를 확대/축소로 처리 (스크롤 방지)
    event.preventDefault();
    event.stopPropagation();
    
    const delta = -event.deltaY * 0.0012;
    if (delta === 0) return;

    setZoom(prev => {
      const next = prev + delta;
      const bounded = Math.max(0.05, next);
      return Number(bounded.toFixed(3));
    });
  }, []);

  const handleMouseDown = useCallback((event: MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: event.clientX - pan.x, y: event.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((event: MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const newPan = {
      x: event.clientX - dragStart.x,
      y: event.clientY - dragStart.y,
    };
    setPan(newPan);
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleCanvasClick = useCallback((event: MouseEvent<HTMLCanvasElement>) => {
    // 드래그가 아니고 단순 클릭인 경우에만 선택
    if (isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // 캔버스 transform을 고려한 좌표 계산
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    console.log('Click:', { 
      clientX: event.clientX, 
      clientY: event.clientY,
      rectLeft: rect.left, 
      rectTop: rect.top,
      canvasX, 
      canvasY,
      pan,
      cellSize,
      gap
    });

    const col = Math.floor(canvasX / (cellSize + gap));
    const row = Math.floor(canvasY / (cellSize + gap));

    console.log('Calculated:', { row, col, id: row * gridWidth + col });

    if (col >= 0 && col < gridWidth && row >= 0 && row < gridHeight) {
      const id = row * gridWidth + col;
      setSelectedId(id);
      setIsPanelOpen(true); // 픽셀 선택 시 패널 자동 열기
    }
  }, [cellSize, gap, gridWidth, gridHeight, pan, isDragging]);

  return (
    <div className="h-screen w-full flex flex-col items-center gap-4 overflow-hidden bg-white">
      {message && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 shadow-lg z-50 text-sm">
          {message}
        </div>
      )}
      <div 
        ref={containerRef}
        className="flex-1 w-full flex items-center justify-center overflow-hidden px-6" 
        onWheel={handleZoomWheel}
      >
        <canvas
          ref={canvasRef}
          className={isDragging ? "cursor-grabbing" : "cursor-crosshair"}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ 
            imageRendering: "pixelated",
            transform: `translate(${pan.x}px, ${pan.y}px)`,
          }}
        />
      </div>

      {/* 하단 토글 버튼 */}
      <button
        className="fixed bottom-4 right-4 w-12 h-12 bg-gray-900 text-white shadow-lg z-50 flex items-center justify-center hover:bg-gray-800 transition-colors"
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        aria-label="toggle panel"
        title={isPanelOpen ? "Close panel" : "Open panel"}
      >
        <svg 
          className={`w-6 h-6 transition-transform ${isPanelOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 하단 패널 */}
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-40 transition-transform duration-300 ${
          isPanelOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '50vh' }}
      >
        <div className="flex flex-col h-full">
          {/* 소유한 픽셀 목록 */}
          {account && (
            <div className="border-b border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                My Pixels ({ownedPixels.length})
              </h3>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {ownedPixels.length === 0 ? (
                  <span className="text-xs text-gray-500">No pixels owned</span>
                ) : (
                  ownedPixels.map((pixel) => {
                    const hex = pixel.colorRgb !== 0 
                      ? `#${pixel.colorRgb.toString(16).padStart(6, "0")}` 
                      : "#ffffff";
                    return (
                      <button
                        key={pixel.id}
                        className="flex items-center gap-2 px-2 py-1 text-xs border border-gray-300 hover:bg-gray-50 transition-colors"
                        onClick={() => {
                          setSelectedId(pixel.id);
                          setIsPanelOpen(true);
                        }}
                      >
                        <div 
                          className="w-4 h-4 border border-gray-300"
                          style={{ backgroundColor: hex }}
                        />
                        <span className="text-gray-700">#{pixel.id}</span>
                        {pixel.priceWei > 0n && (
                          <span className="text-green-600">
                            {weiToUnits(pixel.priceWei).toString()}u
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 선택된 픽셀 옵션 */}
          {selectedId != null && (
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-gray-900">#{selectedId}</span>
                
                {!selectedOwned ? (
                  <button
                    className="px-3 h-8 text-black text-xs transition-colors"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                    onClick={() => mint(selectedId)}
                  >
                    Mint
                  </button>
                ) : isSelectedOwner ? (
                  <>
                    <input
                      className="w-20 text-xs border border-gray-300 px-2 h-8 bg-white text-black"
                      placeholder="price (units)"
                      value={priceInput[selectedId] ?? ""}
                      onChange={e => setPriceInput(s => ({ ...s, [selectedId]: e.target.value.replace(/[^0-9]/g, "") }))}
                    />
                    <button
                      className="px-3 h-8 bg-gray-900 text-white text-xs hover:bg-gray-800 transition-colors"
                      onClick={() => {
                        const units = BigInt(priceInput[selectedId] ?? "0");
                        const wei = unitsToWei(units);
                        setPrice(selectedId, wei);
                      }}
                    >
                      Set Price
                    </button>
                    <input
                      type="color"
                      className="w-8 h-8 p-0 border border-gray-300 cursor-pointer"
                      value={colorInput[selectedId] ?? `#${((selected?.colorRgb && selected.colorRgb !== 0) ? selected.colorRgb : 0xFFFFFF).toString(16).padStart(6, "0")}`}
                      onChange={e => setColorInput(s => ({ ...s, [selectedId]: e.target.value }))}
                      title="Pick color"
                    />
                    <input
                      className="w-28 text-xs border border-gray-300 px-2 h-8 bg-white text-black font-mono"
                      placeholder="#RRGGBB"
                      value={colorInput[selectedId] ?? `#${((selected?.colorRgb && selected.colorRgb !== 0) ? selected.colorRgb : 0xFFFFFF).toString(16).padStart(6, "0")}`}
                      onChange={e => {
                        const v = e.target.value.trim();
                        // 허용: #RRGGBB 또는 RRGGBB
                        const normalized = v.startsWith('#') ? v : `#${v}`;
                        // 0-9a-fA-F 6자리까지만 유지
                        const m = normalized.match(/^#([0-9a-fA-F]{0,6})$/);
                        if (m) {
                          setColorInput(s => ({ ...s, [selectedId]: `#${m[1].padEnd(0)}` }));
                        }
                      }}
                      title="Enter hex color code"
                    />
                    <button
                      className="px-3 h-8 bg-green-700 text-white text-xs hover:bg-green-800 transition-colors"
                      onClick={() => setColor(selectedId, colorInput[selectedId] ?? `#${((selected?.colorRgb && selected.colorRgb !== 0) ? selected.colorRgb : 0xFFFFFF).toString(16).padStart(6, "0")}`)}
                    >
                      Set Color
                    </button>
                  </>
                ) : selectedForSale ? (
                  <>
                    <button
                      className="px-3 h-8 bg-green-600 text-white text-xs hover:bg-green-700 transition-colors"
                      onClick={() => buy(selectedId, selected!.priceWei)}
                    >
                      Buy
                    </button>
                    <span className="text-xs text-gray-600">
                      {weiToUnits(selected!.priceWei).toString()}u (~{formatWeiToEth(selected!.priceWei)} ETH)
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-gray-500">No actions available</span>
                )}
                
                <button
                  className="px-3 h-8 border border-gray-300 text-gray-700 text-xs hover:bg-gray-50 transition-colors"
                  onClick={() => setSelectedId(null)}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {selectedId == null && account && ownedPixels.length === 0 && (
            <div className="p-4 text-center text-sm text-gray-500">
              Select a pixel or click a pixel to interact
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
