import { BrowserWindow, ipcMain } from 'electron'
import { readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import https from 'https'

interface TherapistResult {
  name: string
  address: string
  phone?: string
  rating?: number
}

interface FallbackResource {
  name: string
  description: string
  contact: string
}

interface CodeYellowResults {
  type: 'results' | 'fallback'
  therapists?: TherapistResult[]
  fallbackResources: FallbackResource[]
}

const FALLBACK_RESOURCES: FallbackResource[] = [
  {
    name: '988 Suicide & Crisis Lifeline',
    description: 'Free, confidential 24/7 support',
    contact: 'Call or text 988'
  },
  {
    name: 'Crisis Text Line',
    description: 'Free crisis counseling via text',
    contact: 'Text HOME to 741741'
  },
  {
    name: 'SAMHSA National Helpline',
    description: 'Free referral and information service',
    contact: '1-800-662-4357'
  },
  {
    name: 'Psychology Today Therapist Directory',
    description: 'Search for therapists by location',
    contact: 'https://www.psychologytoday.com/us/therapists'
  },
  {
    name: 'Open Path Collective',
    description: 'Affordable therapy sessions',
    contact: 'https://openpathcollective.org'
  }
]

function loadApiKey(): string | null {
  try {
    const envPath = join(app.getAppPath(), '.env')
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('GOOGLE_MAPS_API_KEY=')) {
        return trimmed.slice('GOOGLE_MAPS_API_KEY='.length).trim()
      }
    }
  } catch {
    // .env not found or unreadable
  }
  return process.env.GOOGLE_MAPS_API_KEY ?? null
}

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => resolve(data))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function geocodeZip(zip: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(zip)}&key=${encodeURIComponent(apiKey)}`
  const raw = await httpsGet(url)
  const data = JSON.parse(raw)

  if (data.status !== 'OK' || !data.results?.length) {
    return null
  }

  const location = data.results[0].geometry?.location
  if (!location) return null

  return { lat: location.lat, lng: location.lng }
}

async function getPlacePhone(placeId: string, apiKey: string): Promise<string | undefined> {
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&fields=formatted_phone_number` +
    `&key=${encodeURIComponent(apiKey)}`

  const raw = await httpsGet(url)
  const data = JSON.parse(raw)

  return data.result?.formatted_phone_number ?? undefined
}

async function findTherapistsWithPhone(
  lat: number,
  lng: number,
  apiKey: string
): Promise<TherapistResult[]> {
  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lng}` +
    `&radius=16000` +
    `&keyword=${encodeURIComponent('therapist psychologist counselor')}` +
    `&type=health` +
    `&key=${encodeURIComponent(apiKey)}`

  const raw = await httpsGet(url)
  const data = JSON.parse(raw)

  if (data.status !== 'OK' || !data.results?.length) {
    return []
  }

  const places = data.results.slice(0, 8)

  const results: TherapistResult[] = await Promise.all(
    places.map(async (place: Record<string, unknown>) => {
      const result: TherapistResult = {
        name: place.name as string,
        address: place.vicinity as string
      }
      if (typeof place.rating === 'number') {
        result.rating = place.rating
      }
      // Fetch phone number from Place Details
      if (typeof place.place_id === 'string') {
        try {
          result.phone = await getPlacePhone(place.place_id, apiKey)
        } catch {
          // Skip phone if details call fails
        }
      }
      return result
    })
  )

  return results
}

export async function lookupByZip(zip: string): Promise<CodeYellowResults> {
  const apiKey = loadApiKey()

  if (!apiKey) {
    console.warn('CODE_YELLOW: No GOOGLE_MAPS_API_KEY found, returning fallback resources')
    return { type: 'fallback', fallbackResources: FALLBACK_RESOURCES }
  }

  try {
    const coords = await geocodeZip(zip, apiKey)
    if (!coords) {
      console.warn('CODE_YELLOW: Could not geocode ZIP, returning fallback')
      return { type: 'fallback', fallbackResources: FALLBACK_RESOURCES }
    }

    const therapists = await findTherapistsWithPhone(coords.lat, coords.lng, apiKey)
    if (therapists.length === 0) {
      return { type: 'fallback', fallbackResources: FALLBACK_RESOURCES }
    }

    return {
      type: 'results',
      therapists,
      fallbackResources: FALLBACK_RESOURCES
    }
  } catch (err) {
    console.error('CODE_YELLOW: API lookup failed:', err)
    return { type: 'fallback', fallbackResources: FALLBACK_RESOURCES }
  }
}

export function getFallbackResources(): FallbackResource[] {
  return FALLBACK_RESOURCES
}

export function setupCodeYellow(mainWindow: BrowserWindow): void {
  ipcMain.on('code-yellow:consent', (_event, consented: boolean) => {
    if (!consented && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('code-yellow:results', {
        type: 'fallback',
        fallbackResources: FALLBACK_RESOURCES
      } satisfies CodeYellowResults)
    }
  })

  ipcMain.on('code-yellow:zip-lookup', async (_event, zip: string) => {
    if (!mainWindow || mainWindow.isDestroyed()) return

    // Validate ZIP format in main process as well
    if (!/^\d{5}$/.test(zip)) {
      mainWindow.webContents.send('code-yellow:results', {
        type: 'fallback',
        fallbackResources: FALLBACK_RESOURCES
      } satisfies CodeYellowResults)
      return
    }

    const results = await lookupByZip(zip)
    mainWindow.webContents.send('code-yellow:results', results)
  })
}
