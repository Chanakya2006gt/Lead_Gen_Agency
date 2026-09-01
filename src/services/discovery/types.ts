import { RawBusinessInput } from "@/services/filter/UniversalFilterService";

export interface DiscoveryParams {
  niche: string;
  location: string;
  radiusKm: number;
  maxResults?: number;
}

export interface IDiscoveryAdapter {
  name: string;
  discover(params: DiscoveryParams): Promise<RawBusinessInput[]>;
}
