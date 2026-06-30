import { useEffect, useState } from "react";

export const DEFAULT_LOGO_URL = "/aquarich-logo.png";
export const BRAND_LOGO_EVENT = "aquarich:brand-logo";

let currentLogoUrl = DEFAULT_LOGO_URL;

export function getBrandLogoUrl(): string {
  return currentLogoUrl;
}

export function applyBrandLogo(logoUrl?: string | null): void {
  currentLogoUrl = logoUrl || DEFAULT_LOGO_URL;
  window.dispatchEvent(new CustomEvent(BRAND_LOGO_EVENT, { detail: currentLogoUrl }));
}

export function useBrandLogo(): string {
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl);

  useEffect(() => {
    const onLogo = (event: Event) => {
      setLogoUrl((event as CustomEvent<string>).detail || DEFAULT_LOGO_URL);
    };
    window.addEventListener(BRAND_LOGO_EVENT, onLogo);
    return () => window.removeEventListener(BRAND_LOGO_EVENT, onLogo);
  }, []);

  return logoUrl;
}
