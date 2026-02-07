export interface TherapistResult {
  name: string
  address: string
  phone?: string
  rating?: number
}

export interface CodeYellowResults {
  type: 'results' | 'fallback'
  therapists?: TherapistResult[]
  fallbackResources: FallbackResource[]
}

export interface FallbackResource {
  name: string
  description: string
  contact: string
}
