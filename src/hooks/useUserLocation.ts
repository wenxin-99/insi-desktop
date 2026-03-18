/**
 * useUserLocation — 用户位置检测 Hook
 *
 * 策略：
 * 1. 先查 sessionStorage 缓存（同一会话不重复请求）
 * 2. 调用免费 IP 定位 API 获取城市
 * 3. 失败时回退到时区推断
 *
 * 不需要用户授权 GPS，纯 IP 定位。
 */
import { useState, useEffect, useRef } from 'react';

interface LocationInfo {
  city: string;
  region?: string;  // 省份
  country?: string;
}

const CACHE_KEY = 'user_geo_city';

export function useUserLocation(): string | null {
  const [city, setCity] = useState<string | null>(() => {
    // 先读缓存
    try {
      return sessionStorage.getItem(CACHE_KEY) || null;
    } catch { return null; }
  });
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current || city) return;
    fetchedRef.current = true;

    (async () => {
      const result = await detectLocation();
      if (result) {
        const displayCity = result.region
          ? `${result.region}${result.city}`
          : result.city;
        setCity(displayCity);
        try { sessionStorage.setItem(CACHE_KEY, displayCity); } catch {}
      }
    })();
  }, [city]);

  return city;
}

async function detectLocation(): Promise<LocationInfo | null> {
  // 策略 1：国内 API（太平洋网，速度快）
  try {
    const res = await fetch('https://whois.pconline.com.cn/ipJson.jsp?json=true', {
      signal: AbortSignal.timeout(3000),
    });
    const text = await res.text();
    // 响应可能是 JSONP 或纯 JSON
    const jsonStr = text.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
    const data = JSON.parse(jsonStr);
    if (data.city) {
      return { city: data.city, region: data.pro, country: 'CN' };
    }
  } catch {}

  // 策略 2：ipapi.co（国际，部分地区可能慢）
  try {
    const res = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    if (data.city) {
      return { city: data.city, region: data.region, country: data.country_code };
    }
  } catch {}

  // 策略 3：时区回退
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tzCityMap: Record<string, string> = {
      'Asia/Shanghai': '上海',
      'Asia/Chongqing': '重庆',
      'Asia/Hong_Kong': '香港',
      'Asia/Taipei': '台北',
      'Asia/Tokyo': '东京',
      'Asia/Seoul': '首尔',
      'Asia/Singapore': '新加坡',
    };
    if (tzCityMap[tz]) {
      return { city: tzCityMap[tz] };
    }
  } catch {}

  return null;
}
