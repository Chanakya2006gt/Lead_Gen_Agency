import { RawBusinessInput } from "@/features/qualification/UniversalFilterService";

export interface DiscoveryParams {
  niche: string;
  location: string;
  radiusKm?: number;
  maxResults?: number;
}

export interface IDiscoveryAdapter {
  readonly name: string;
  discover(params: DiscoveryParams): Promise<RawBusinessInput[]>;
}
