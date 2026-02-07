export interface TherapistResult {
  name: string
  address: string
  phone?: string
  rating?: number
  lat: number
  lng: number
}

export interface CodeYellowResults {
  type: 'results' | 'fallback'
  therapists?: TherapistResult[]
  fallbackResources: FallbackResource[]
  centerLat?: number
  centerLng?: number
}

export interface FallbackResource {
  name: string
  description: string
  contact: string
}
