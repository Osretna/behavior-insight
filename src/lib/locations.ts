export interface KnownLocation {
  id: string;
  cityAr: string;
  cityEn: string;
  countryAr: string;
  countryEn: string;
  lat: number;
  lng: number;
  method: number; // Aladhan calculation method (5 = Egypt, 4 = Makkah/Umm al-Qura, 8 = Gulf, 3 = MWL)
  aliases: string[];
}

export const KNOWN_LOCATIONS: KnownLocation[] = [
  // Egypt Governorates & Major Cities (Method 5: Egyptian General Authority of Survey)
  { id: 'cairo', cityAr: 'القاهرة', cityEn: 'Cairo', countryAr: 'مصر', countryEn: 'Egypt', lat: 30.0444, lng: 31.2357, method: 5, aliases: ['cairo', 'القاهرة', 'القاهره', 'al qahirah'] },
  { id: 'giza', cityAr: 'الجيزة', cityEn: 'Giza', countryAr: 'مصر', countryEn: 'Egypt', lat: 30.0131, lng: 31.2089, method: 5, aliases: ['giza', 'الجيزة', 'الجيزه'] },
  { id: 'qalyubia', cityAr: 'القليوبية (بنها)', cityEn: 'Banha', countryAr: 'مصر', countryEn: 'Egypt', lat: 30.466, lng: 31.1848, method: 5, aliases: ['qalyubia', 'qalyubiya', 'banha', 'benha', 'القليوبية', 'القليوبيه', 'بنها', 'شبرا الخيمة', 'الخانكة', 'قليوب'] },
  { id: 'alexandria', cityAr: 'الإسكندرية', cityEn: 'Alexandria', countryAr: 'مصر', countryEn: 'Egypt', lat: 31.2001, lng: 29.9187, method: 5, aliases: ['alexandria', 'الإسكندرية', 'الاسكندرية', 'الاسكندريه'] },
  { id: 'sharqia', cityAr: 'الشرقية (الزقازيق)', cityEn: 'Zagazig', countryAr: 'مصر', countryEn: 'Egypt', lat: 30.5877, lng: 31.502, method: 5, aliases: ['sharqia', 'zagazig', 'الشرقية', 'الشرقيه', 'الزقازيق', 'العاشر من رمضان'] },
  { id: 'dakahlia', cityAr: 'الدقهلية (المنصورة)', cityEn: 'Mansoura', countryAr: 'مصر', countryEn: 'Egypt', lat: 31.0409, lng: 31.3785, method: 5, aliases: ['dakahlia', 'mansoura', 'الدقهلية', 'الدقهليه', 'المنصورة', 'المنصوره'] },
  { id: 'gharbia', cityAr: 'الغربية (طنطا)', cityEn: 'Tanta', countryAr: 'مصر', countryEn: 'Egypt', lat: 30.7865, lng: 31.0004, method: 5, aliases: ['gharbia', 'tanta', 'الغربية', 'الغربيه', 'طنطا', 'المحلة الكبرى'] },
  { id: 'monufia', cityAr: 'المنوفية (شبين الكوم)', cityEn: 'Shibin El Kom', countryAr: 'مصر', countryEn: 'Egypt', lat: 30.5503, lng: 31.0106, method: 5, aliases: ['monufia', 'menofia', 'shibin', 'المنوفية', 'المنوفيه', 'شبين الكوم'] },
  { id: 'beheira', cityAr: 'البحيرة (دمنهور)', cityEn: 'Damanhur', countryAr: 'مصر', countryEn: 'Egypt', lat: 31.0341, lng: 30.4682, method: 5, aliases: ['beheira', 'damanhur', 'البحيرة', 'البحيره', 'دمنهور'] },
  { id: 'kafr_el_sheikh', cityAr: 'كفر الشيخ', cityEn: 'Kafr El Sheikh', countryAr: 'مصر', countryEn: 'Egypt', lat: 31.1107, lng: 30.9388, method: 5, aliases: ['kafr el sheikh', 'كفر الشيخ'] },
  { id: 'damietta', cityAr: 'دمياط', cityEn: 'Damietta', countryAr: 'مصر', countryEn: 'Egypt', lat: 31.4175, lng: 31.8144, method: 5, aliases: ['damietta', 'دمياط'] },
  { id: 'port_said', cityAr: 'بورسعيد', cityEn: 'Port Said', countryAr: 'مصر', countryEn: 'Egypt', lat: 31.2653, lng: 32.3019, method: 5, aliases: ['port said', 'بورسعيد'] },
  { id: 'ismailia', cityAr: 'الإسماعيلية', cityEn: 'Ismailia', countryAr: 'مصر', countryEn: 'Egypt', lat: 30.5965, lng: 32.2715, method: 5, aliases: ['ismailia', 'الإسماعيلية', 'الاسماعيلية'] },
  { id: 'suez', cityAr: 'السويس', cityEn: 'Suez', countryAr: 'مصر', countryEn: 'Egypt', lat: 29.9668, lng: 32.5498, method: 5, aliases: ['suez', 'السويس'] },
  { id: 'fayoum', cityAr: 'الفيوم', cityEn: 'Faiyum', countryAr: 'مصر', countryEn: 'Egypt', lat: 29.3084, lng: 30.8428, method: 5, aliases: ['fayoum', 'faiyum', 'الفيوم'] },
  { id: 'beni_suef', cityAr: 'بني سويف', cityEn: 'Beni Suef', countryAr: 'مصر', countryEn: 'Egypt', lat: 29.0661, lng: 31.0994, method: 5, aliases: ['beni suef', 'بني سويف'] },
  { id: 'minya', cityAr: 'المنيا', cityEn: 'Minya', countryAr: 'مصر', countryEn: 'Egypt', lat: 28.1099, lng: 30.7503, method: 5, aliases: ['minya', 'المنيا'] },
  { id: 'asyut', cityAr: 'أسيوط', cityEn: 'Asyut', countryAr: 'مصر', countryEn: 'Egypt', lat: 27.1809, lng: 31.1837, method: 5, aliases: ['asyut', 'assiut', 'أسيوط', 'اسيوط'] },
  { id: 'sohag', cityAr: 'سوهاج', cityEn: 'Sohag', countryAr: 'مصر', countryEn: 'Egypt', lat: 26.5569, lng: 31.6948, method: 5, aliases: ['sohag', 'سوهاج'] },
  { id: 'qena', cityAr: 'قنا', cityEn: 'Qena', countryAr: 'مصر', countryEn: 'Egypt', lat: 26.1551, lng: 32.716, method: 5, aliases: ['qena', 'قنا'] },
  { id: 'luxor', cityAr: 'الأقصر', cityEn: 'Luxor', countryAr: 'مصر', countryEn: 'Egypt', lat: 25.6872, lng: 32.6396, method: 5, aliases: ['luxor', 'الأقصر', 'الاقصر'] },
  { id: 'aswan', cityAr: 'أسوان', cityEn: 'Aswan', countryAr: 'مصر', countryEn: 'Egypt', lat: 24.0889, lng: 32.8998, method: 5, aliases: ['aswan', 'أسوان', 'اسوان'] },
  { id: 'red_sea', cityAr: 'البحر الأحمر (الغردقة)', cityEn: 'Hurghada', countryAr: 'مصر', countryEn: 'Egypt', lat: 27.2579, lng: 33.8116, method: 5, aliases: ['hurghada', 'red sea', 'الغردقة', 'البحر الأحمر'] },
  { id: 'matrouh', cityAr: 'مطروح', cityEn: 'Marsa Matruh', countryAr: 'مصر', countryEn: 'Egypt', lat: 31.3543, lng: 27.2373, method: 5, aliases: ['matrouh', 'marsa matruh', 'مطروح', 'مرسى مطروح'] },
  { id: 'north_sinai', cityAr: 'شمال سيناء (العريش)', cityEn: 'Arish', countryAr: 'مصر', countryEn: 'Egypt', lat: 31.1321, lng: 33.8033, method: 5, aliases: ['arish', 'north sinai', 'العريش', 'شمال سيناء'] },
  { id: 'south_sinai', cityAr: 'جنوب سيناء (شرم الشيخ)', cityEn: 'Sharm El Sheikh', countryAr: 'مصر', countryEn: 'Egypt', lat: 27.9158, lng: 34.3299, method: 5, aliases: ['sharm', 'south sinai', 'شرم الشيخ', 'جنوب سيناء'] },
  { id: 'new_valley', cityAr: 'الوادي الجديد (الخارجة)', cityEn: 'Kharga', countryAr: 'مصر', countryEn: 'Egypt', lat: 25.439, lng: 30.5586, method: 5, aliases: ['kharga', 'new valley', 'الوادي الجديد', 'الخارجة'] },

  // Major Arab & International Cities
  { id: 'makkah', cityAr: 'مكة المكرمة', cityEn: 'Makkah', countryAr: 'السعودية', countryEn: 'Saudi Arabia', lat: 21.3891, lng: 39.8579, method: 4, aliases: ['makkah', 'mecca', 'مكة', 'مكة المكرمة'] },
  { id: 'madinah', cityAr: 'المدينة المنورة', cityEn: 'Madinah', countryAr: 'السعودية', countryEn: 'Saudi Arabia', lat: 24.5247, lng: 39.5692, method: 4, aliases: ['madinah', 'medina', 'المدينة', 'المدينة المنورة'] },
  { id: 'riyadh', cityAr: 'الرياض', cityEn: 'Riyadh', countryAr: 'السعودية', countryEn: 'Saudi Arabia', lat: 24.7136, lng: 46.6753, method: 4, aliases: ['riyadh', 'الرياض'] },
  { id: 'jeddah', cityAr: 'جدة', cityEn: 'Jeddah', countryAr: 'السعودية', countryEn: 'Saudi Arabia', lat: 21.4858, lng: 39.1925, method: 4, aliases: ['jeddah', 'جدة', 'جده'] },
  { id: 'dammam', cityAr: 'الدمام', cityEn: 'Dammam', countryAr: 'السعودية', countryEn: 'Saudi Arabia', lat: 26.4207, lng: 50.0888, method: 4, aliases: ['dammam', 'الدمام'] },
  { id: 'dubai', cityAr: 'دبي', cityEn: 'Dubai', countryAr: 'الإمارات', countryEn: 'UAE', lat: 25.2048, lng: 55.2708, method: 8, aliases: ['dubai', 'دبي'] },
  { id: 'abudhabi', cityAr: 'أبوظبي', cityEn: 'Abu Dhabi', countryAr: 'الإمارات', countryEn: 'UAE', lat: 24.4539, lng: 54.3773, method: 8, aliases: ['abu dhabi', 'أبوظبي', 'ابوظبي'] },
  { id: 'doha', cityAr: 'الدوحة', cityEn: 'Doha', countryAr: 'قطر', countryEn: 'Qatar', lat: 25.2854, lng: 51.531, method: 10, aliases: ['doha', 'الدوحة', 'الدوحه'] },
  { id: 'kuwait', cityAr: 'مدينة الكويت', cityEn: 'Kuwait City', countryAr: 'الكويت', countryEn: 'Kuwait', lat: 29.3759, lng: 47.9774, method: 9, aliases: ['kuwait', 'الكويت'] },
  { id: 'amman', cityAr: 'عمّان', cityEn: 'Amman', countryAr: 'الأردن', countryEn: 'Jordan', lat: 31.9454, lng: 35.9284, method: 3, aliases: ['amman', 'عمان', 'عمّان'] },
  { id: 'manama', cityAr: 'المنامة', cityEn: 'Manama', countryAr: 'البحرين', countryEn: 'Bahrain', lat: 26.2285, lng: 50.586, method: 8, aliases: ['manama', 'المنامة', 'البحرين'] },
  { id: 'muscat', cityAr: 'مسقط', cityEn: 'Muscat', countryAr: 'عُمان', countryEn: 'Oman', lat: 23.588, lng: 58.3829, method: 8, aliases: ['muscat', 'مسقط'] },
  { id: 'baghdad', cityAr: 'بغداد', cityEn: 'Baghdad', countryAr: 'العراق', countryEn: 'Iraq', lat: 33.3152, lng: 44.3661, method: 3, aliases: ['baghdad', 'بغداد'] },
  { id: 'beirut', cityAr: 'بيروت', cityEn: 'Beirut', countryAr: 'لبنان', countryEn: 'Lebanon', lat: 33.8938, lng: 35.5018, method: 3, aliases: ['beirut', 'بيروت'] },
  { id: 'tunis', cityAr: 'تونس', cityEn: 'Tunis', countryAr: 'تونس', countryEn: 'Tunisia', lat: 36.8065, lng: 10.1815, method: 3, aliases: ['tunis', 'تونس'] },
  { id: 'algiers', cityAr: 'الجزائر', cityEn: 'Algiers', countryAr: 'الجزائر', countryEn: 'Algeria', lat: 36.7538, lng: 3.0588, method: 3, aliases: ['algiers', 'الجزائر'] },
  { id: 'casablanca', cityAr: 'الدار البيضاء', cityEn: 'Casablanca', countryAr: 'المغرب', countryEn: 'Morocco', lat: 33.5731, lng: -7.5898, method: 3, aliases: ['casablanca', 'الدار البيضاء'] },
  { id: 'rabat', cityAr: 'الرباط', cityEn: 'Rabat', countryAr: 'المغرب', countryEn: 'Morocco', lat: 34.0209, lng: -6.8416, method: 3, aliases: ['rabat', 'الرباط'] },
  { id: 'istanbul', cityAr: 'إسطنبول', cityEn: 'Istanbul', countryAr: 'تركيا', countryEn: 'Turkey', lat: 41.0082, lng: 28.9784, method: 13, aliases: ['istanbul', 'إسطنبول', 'اسطنبول'] },
  { id: 'london', cityAr: 'لندن', cityEn: 'London', countryAr: 'المملكة المتحدة', countryEn: 'United Kingdom', lat: 51.5072, lng: -0.1276, method: 3, aliases: ['london', 'لندن'] },
];

export function resolveKnownLocation(city?: string, country?: string): KnownLocation | null {
  const c = (city || '').trim().toLowerCase();
  if (!c) return null;
  for (const loc of KNOWN_LOCATIONS) {
    if (
      loc.cityAr.toLowerCase() === c ||
      loc.cityEn.toLowerCase() === c ||
      loc.aliases.some((a) => c.includes(a.toLowerCase()) || a.toLowerCase().includes(c))
    ) {
      return loc;
    }
  }
  const co = (country || '').trim().toLowerCase();
  if (co.includes('egypt') || co.includes('مصر')) {
    return KNOWN_LOCATIONS[0]; // Cairo fallback with Egypt method 5
  }
  return null;
}

export function inferCalculationMethod(country?: string): number {
  const c = (country || '').toLowerCase();
  if (c.includes('egypt') || c.includes('مصر')) return 5;
  if (c.includes('saudi') || c.includes('السعودية')) return 4;
  if (c.includes('qatar') || c.includes('قطر')) return 10;
  if (c.includes('kuwait') || c.includes('الكويت')) return 9;
  if (c.includes('uae') || c.includes('emirates') || c.includes('الإمارات') || c.includes('الامارات')) return 8;
  if (c.includes('turkey') || c.includes('تركيا')) return 13;
  return 5;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestKnownLocation(lat: number, lng: number): KnownLocation | null {
  let best: KnownLocation | null = null;
  let bestDist = Infinity;
  for (const loc of KNOWN_LOCATIONS) {
    const d = haversineKm(lat, lng, loc.lat, loc.lng);
    if (d < bestDist) {
      bestDist = d;
      best = loc;
    }
  }
  return bestDist <= 180 ? best : null;
}

export interface DetectedLocation {
  lat: number;
  lng: number;
  city: string;
  country: string;
  method: number;
  source: 'gps' | 'ip';
}

async function reverseGeocodeNominatim(
  lat: number,
  lng: number
): Promise<{ city: string; country: string } | null> {
  try {
    const controller = new AbortController();
    const tid = window.setTimeout(() => controller.abort(), 4500);
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&accept-language=ar`;
    const res = await fetch(url, { signal: controller.signal });
    window.clearTimeout(tid);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        governorate?: string;
        country?: string;
      };
    };
    const addr = data.address;
    if (!addr) return null;
    const cityPart = addr.city || addr.town || addr.village || '';
    const statePart = addr.state || addr.governorate || '';
    const cleanState = statePart.replace(/^محافظة\s+/i, '').trim();
    const city =
      cleanState && cityPart && cleanState !== cityPart
        ? `${cleanState} (${cityPart})`
        : cleanState || cityPart;
    const country = addr.country || '';
    if (!city && !country) return null;
    return { city: city || country, country: country || 'Egypt' };
  } catch {
    return null;
  }
}

async function detectViaIp(): Promise<DetectedLocation | null> {
  try {
    const controller = new AbortController();
    const tid = window.setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://ipwho.is/?lang=ar', { signal: controller.signal });
    window.clearTimeout(tid);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      city?: string;
      region?: string;
      country?: string;
      latitude?: number;
      longitude?: number;
    };
    if (!data.success || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      return null;
    }
    const nearest = findNearestKnownLocation(data.latitude, data.longitude);
    const city = nearest?.cityAr || data.region || data.city || 'القاهرة';
    const country = nearest?.countryAr || data.country || 'مصر';
    return {
      lat: data.latitude,
      lng: data.longitude,
      city,
      country,
      method: nearest?.method ?? inferCalculationMethod(country),
      source: 'ip',
    };
  } catch {
    return null;
  }
}

export async function detectUserLocationSmart(): Promise<DetectedLocation> {
  // 1. Try browser Geolocation first (using Wi-Fi/cell-friendly settings so it works reliably indoors & on mobile)
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        });
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const rev = await reverseGeocodeNominatim(lat, lng);
      const nearest = findNearestKnownLocation(lat, lng);
      const city = rev?.city || nearest?.cityAr || 'موقعي الحالي';
      const country = rev?.country || nearest?.countryAr || 'مصر';
      return {
        lat,
        lng,
        city,
        country,
        method: nearest?.method ?? inferCalculationMethod(country),
        source: 'gps',
      };
    } catch {
      // Fall through cleanly to IP-based location detection
    }
  }

  // 2. Automatic IP-based fallback when GPS is blocked/denied/unavailable
  const ipLoc = await detectViaIp();
  if (ipLoc) return ipLoc;

  throw new Error(
    'تعذر تحديد الموقع تلقائياً. يرجى السماح بصلاحية الموقع في المتصفح أو اختيار محافظتك/مدينتك يدوياً من القائمة.'
  );
}
