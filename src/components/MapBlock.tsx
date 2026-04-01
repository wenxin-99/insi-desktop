/**
 * MapBlock — ```map 代码块渲染组件
 *
 * AI 输出 JSON，前端渲染为地图标注（使用 Leaflet + OpenStreetMap）。
 * 无需 API Key，国内外都可用。
 *
 * JSON Schema:
 * {
 *   "title": "东京三日游路线",
 *   "center": [35.6762, 139.6503],
 *   "zoom": 12,
 *   "markers": [
 *     {"lat": 35.7148, "lng": 139.7967, "name": "浅草寺", "desc": "Day 1 第一站"},
 *     {"lat": 35.6586, "lng": 139.7454, "name": "东京塔", "desc": "Day 1 下午"}
 *   ]
 * }
 */

import { memo, useRef, useEffect, useState, useId } from 'react';
import { MapPin, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';

// ═══════ 类型定义 ═══════

interface MapMarker {
  lat: number;
  lng: number;
  name: string;
  desc?: string;
}

interface MapData {
  title?: string;
  center?: [number, number];
  zoom?: number;
  markers: MapMarker[];
  route?: boolean; // ★ 是否在标注点之间画路线线
}

interface MapBlockProps {
  jsonStr: string;
  streaming?: boolean;
}

// ═══════ Leaflet CSS/JS 动态加载 ═══════

let leafletLoaded = false;
let leafletLoadPromise: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (leafletLoaded) return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise<void>((resolve, reject) => {
    // CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(link);
    }

    // Routing Machine CSS
    if (!document.querySelector('link[href*="routing-machine"]')) {
      const rmLink = document.createElement('link');
      rmLink.rel = 'stylesheet';
      rmLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-routing-machine/3.2.12/leaflet-routing-machine.css';
      document.head.appendChild(rmLink);
    }

    // JS
    if ((window as any).L) {
      leafletLoaded = true;
      loadRoutingMachine().then(resolve).catch(resolve); // routing machine optional
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.onload = () => {
      leafletLoaded = true;
      loadRoutingMachine().then(resolve).catch(resolve);
    };
    script.onerror = () => reject(new Error('Failed to load Leaflet'));
    document.head.appendChild(script);
  });

  return leafletLoadPromise;
}

/** ★ 加载 Leaflet Routing Machine（可选，失败降级到虚线连接） */
let routingLoaded = false;
function loadRoutingMachine(): Promise<void> {
  if (routingLoaded || (window as any).L?.Routing) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet-routing-machine/3.2.12/leaflet-routing-machine.min.js';
    script.onload = () => { routingLoaded = true; resolve(); };
    script.onerror = () => resolve(); // 失败不阻塞
    document.head.appendChild(script);
  });
}

/** 从不完整 JSON 中提取 title */
function extractPartialMeta(str: string): { title?: string } {
  return { title: str.match(/"title"\s*:\s*"([^"]*)/)?.[1] };
}

// ═══════ 标注点颜色 ═══════
const MARKER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

/** 判断坐标是否在中国区域（粗略矩形） */
function isInChina(lat: number, lng: number): boolean {
  return lat >= 18 && lat <= 54 && lng >= 73 && lng <= 135;
}

/** 根据标注点位置选择 tile 源 */
function getTileConfig(markers: MapMarker[]): { url: string; attribution: string } {
  // 如果大部分标注点在中国区域，使用高德地图 tile
  const chinaCount = markers.filter(m => isInChina(m.lat, m.lng)).length;
  if (chinaCount > markers.length / 2) {
    return {
      url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      attribution: '© 高德地图',
    };
  }
  return {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
  };
}

/** 转义 HTML 实体，防止 XSS */
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function MapBlockInner({ jsonStr, streaming }: MapBlockProps) {
  const mapContainerId = useId().replace(/:/g, '_');
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  let parsed: MapData | null = null;
  {
    const r = safeParseJson<any>(jsonStr);
    if (Array.isArray(r.data)) {
      parsed = { markers: r.data };
    } else {
      parsed = r.data;
    }
  }

  const markers = (parsed?.markers || []).filter(
    m => typeof m.lat === 'number' && isFinite(m.lat) && typeof m.lng === 'number' && isFinite(m.lng)
  );
  const center = parsed?.center || (markers.length > 0 ? [markers[0].lat, markers[0].lng] : [35.68, 139.69]) as [number, number];
  const zoom = parsed?.zoom || 12;

  // 加载 Leaflet 并初始化地图
  useEffect(() => {
    if (!parsed || markers.length === 0) return;

    let cancelled = false;

    loadLeaflet().then(() => {
      if (cancelled) return;
      const L = (window as any).L;
      if (!L) return;

      // 销毁旧地图
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const containerId = `map-${mapContainerId}`;
      const el = document.getElementById(containerId);
      if (!el) return;

      const map = L.map(containerId).setView(center, zoom);
      mapRef.current = map;

      // ★ 根据标注点位置自动选择 tile 源（国内→高德，国外→OSM）
      const tile = getTileConfig(markers);
      const isAmap = tile.url.includes('autonavi');
      L.tileLayer(tile.url, {
        attribution: tile.attribution,
        maxZoom: 19,
        subdomains: isAmap ? ['1', '2', '3', '4'] : ['a', 'b', 'c'],
      }).addTo(map);

      // 添加标注
      const bounds: any[] = [];
      markers.forEach((m, i) => {
        const color = MARKER_COLORS[i % MARKER_COLORS.length];

        // 自定义编号图标
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:24px;height:24px;border-radius:50%;background:${color};
            color:white;font-size:11px;font-weight:700;
            display:flex;align-items:center;justify-content:center;
            border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);
          ">${i + 1}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          popupAnchor: [0, -14],
        });

        const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
        bounds.push([m.lat, m.lng]);

        // 弹窗
        const popupContent = `<div style="font-size:12px"><strong>${escapeHtml(m.name)}</strong>${m.desc ? `<br/><span style="color:#666">${escapeHtml(m.desc)}</span>` : ''}</div>`;
        marker.bindPopup(popupContent);
      });

      // ★ 路线规划：优先使用 Routing Machine（真实道路路线），降级到虚线连接
      if (parsed?.route !== false && bounds.length > 1) {
        const hasRouting = !!(L.Routing && L.Routing.control);
        if (hasRouting) {
          try {
            const waypoints = bounds.map((b: any) => L.latLng(b[0], b[1]));
            const routeControl = L.Routing.control({
              waypoints,
              routeWhileDragging: false,
              addWaypoints: false,
              draggableWaypoints: false,
              show: false, // 隐藏文字指令面板
              createMarker: () => null, // 不重复创建标注点（已有编号标注）
              lineOptions: {
                styles: [{ color: '#3b82f6', weight: 4, opacity: 0.7 }],
                extendToWaypoints: true,
                missingRouteTolerance: 50,
              },
            }).addTo(map);
            // 隐藏路线指令容器
            const container = routeControl.getContainer();
            if (container) container.style.display = 'none';
          } catch {
            // Routing Machine 失败，降级到虚线
            L.polyline(bounds, { color: '#3b82f6', weight: 2, opacity: 0.5, dashArray: '6, 8' }).addTo(map);
          }
        } else {
          // 无 Routing Machine，使用虚线连接
          L.polyline(bounds, { color: '#3b82f6', weight: 2, opacity: 0.5, dashArray: '6, 8' }).addTo(map);
        }
      }

      // 自动调整视野
      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    }).catch(err => {
      setError(err.message);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsonStr]);

  // 全屏切换后需要 invalidateSize + Escape 退出
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 100);
    }
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen]);

  // ═══════ 流式骨架 ═══════
  if (!parsed && streaming) {
    const partial = extractPartialMeta(jsonStr);
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-red-500 animate-pulse" />
            <h3 className="text-sm font-medium">{partial.title || '地图加载中...'}</h3>
          </div>
          <div className="h-[240px] rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="h-0.5 bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-red-300 via-red-500 to-red-300 animate-pulse" />
        </div>
      </div>
    );
  }

  // ═══════ 解析失败降级 ═══════
  if (!parsed) {
    return (
      <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>地图数据格式异常，已显示原始内容</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 overflow-hidden p-4">
        <div className="text-xs text-red-600 dark:text-red-400">地图加载失败：{error}</div>
      </div>
    );
  }

  const containerClass = fullscreen
    ? 'fixed inset-0 z-50 bg-background flex flex-col'
    : 'my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm';

  return (
    <div className={containerClass} ref={containerRef}>
      {/* ═══════ 标题栏 ═══════ */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-red-500" />
          <h3 className="text-sm font-medium">{parsed.title || '地图'}</h3>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {markers.length} 个标注
          </span>
        </div>
        <button
          onClick={() => setFullscreen(!fullscreen)}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          title={fullscreen ? '退出全屏' : '全屏'}
        >
          {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* ═══════ 地图容器 ═══════ */}
      <div
        id={`map-${mapContainerId}`}
        className={cn(fullscreen ? 'flex-1' : 'h-[280px]')}
        style={{ zIndex: 0 }}
      />

      {/* ═══════ 标注列表 ═══════ */}
      {!fullscreen && markers.length > 0 && (
        <div className="border-t border-border max-h-[120px] overflow-y-auto">
          {markers.map((m, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-muted/20 transition-colors">
              <span
                className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                style={{ background: MARKER_COLORS[i % MARKER_COLORS.length] }}
              >
                {i + 1}
              </span>
              <span className="font-medium text-foreground">{m.name}</span>
              {m.desc && <span className="text-muted-foreground truncate ml-auto">{m.desc}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const MapBlock = memo(MapBlockInner);
