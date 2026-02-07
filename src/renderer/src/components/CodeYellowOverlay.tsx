import { useState, useEffect, useCallback, useRef } from 'react'
import type { CodeYellowResults, TherapistResult } from '../types/codeYellow'

type Step = 'consent' | 'zip' | 'results'

interface CodeYellowOverlayProps {
  onDismiss: () => void
}

// Declare global google maps types
declare global {
  interface Window {
    google?: typeof google
    therapyAPI: {
      codeYellow: {
        onResults: (callback: (data: unknown) => void) => () => void
        sendConsent: (consented: boolean) => void
        submitZip: (zip: string) => void
      }
    }
  }
}

// Hardcoded API key (same as in .env)
const GOOGLE_MAPS_API_KEY = 'AIzaSyA5Yc_YxKyvjony1Nox6GU_HYBzDkM_k74'

function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export default function CodeYellowOverlay({ onDismiss }: CodeYellowOverlayProps) {
  const [step, setStep] = useState<Step>('consent')
  const [zip, setZip] = useState('')
  const [zipError, setZipError] = useState('')
  const [results, setResults] = useState<CodeYellowResults | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const cleanup = window.therapyAPI.codeYellow.onResults((data) => {
      setResults(data as CodeYellowResults)
      setLoading(false)
      setStep('results')
    })
    return cleanup
  }, [])

  const handleConsent = useCallback((consented: boolean) => {
    window.therapyAPI.codeYellow.sendConsent(consented)
    if (consented) {
      setStep('zip')
    } else {
      setStep('results')
    }
  }, [])

  const handleZipSubmit = useCallback(() => {
    const trimmed = zip.trim()
    if (!/^\d{5}$/.test(trimmed)) {
      setZipError('Please enter a valid 5-digit ZIP code.')
      return
    }
    setZipError('')
    setLoading(true)
    window.therapyAPI.codeYellow.submitZip(trimmed)
  }, [zip])

  const isResultsView = step === 'results' && results && results.type === 'results'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-lyra-text/40 backdrop-blur-sm animate-fade-in">
      <div
        className={`bg-lyra-surface rounded-2xl shadow-xl mx-6 p-8 animate-slide-up ${
          isResultsView ? 'max-w-6xl w-full max-h-[90vh]' : 'max-w-md w-full'
        }`}
      >
        {step === 'consent' && <ConsentStep onConsent={handleConsent} />}

        {step === 'zip' && (
          <ZipStep
            zip={zip}
            zipError={zipError}
            loading={loading}
            onZipChange={(v) => {
              setZip(v)
              setZipError('')
            }}
            onSubmit={handleZipSubmit}
            onSkip={() => {
              window.therapyAPI.codeYellow.sendConsent(false)
              setStep('results')
            }}
          />
        )}

        {step === 'results' && results && <ResultsStep results={results} onDismiss={onDismiss} />}

        {step === 'results' && !results && <FallbackLoadingStep />}
      </div>
    </div>
  )
}

function ConsentStep({ onConsent }: { onConsent: (consented: boolean) => void }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-lyra-amber/30 flex items-center justify-center mx-auto mb-5">
        <span className="text-2xl" role="img" aria-label="Yellow heart">
          💛
        </span>
      </div>
      <h2 className="text-xl font-medium text-lyra-text mb-3">
        We want to make sure you're okay.
      </h2>
      <p className="text-sm text-lyra-text-muted leading-relaxed mb-8">
        It sounds like you might be going through something really difficult. I want to make sure
        you have access to the right support. Would you like me to help you find a professional near
        you?
      </p>
      <div className="flex flex-col gap-3">
        <button
          onClick={() => onConsent(true)}
          className="py-3 px-6 rounded-xl bg-lyra-accent text-white font-medium
                     hover:bg-lyra-accent-soft transition-colors duration-200
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent"
        >
          Yes, help me find someone
        </button>
        <button
          onClick={() => onConsent(false)}
          className="py-3 px-6 rounded-xl bg-lyra-surface-dim text-lyra-text-muted font-medium
                     hover:text-lyra-text transition-colors duration-200
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent"
        >
          No thanks, show me resources
        </button>
      </div>
    </div>
  )
}

function ZipStep({
  zip,
  zipError,
  loading,
  onZipChange,
  onSubmit,
  onSkip
}: {
  zip: string
  zipError: string
  loading: boolean
  onZipChange: (value: string) => void
  onSubmit: () => void
  onSkip: () => void
}) {
  return (
    <div className="text-center">
      <h2 className="text-xl font-medium text-lyra-text mb-3">Enter your ZIP code</h2>
      <p className="text-xs text-lyra-text-muted mb-6">
        Your ZIP code is used only for this search and is never saved.
      </p>
      <input
        type="text"
        inputMode="numeric"
        maxLength={5}
        value={zip}
        onChange={(e) => onZipChange(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit()
        }}
        placeholder="00000"
        autoFocus
        className="w-36 text-center text-2xl font-medium tracking-widest py-3 px-4
                   rounded-xl border-2 border-lyra-lavender bg-lyra-surface-dim text-lyra-text
                   placeholder:text-lyra-lavender
                   focus:outline-none focus:border-lyra-accent transition-colors duration-200"
      />
      {zipError && <p className="text-xs text-lyra-crisis mt-2">{zipError}</p>}
      <div className="flex flex-col gap-3 mt-6">
        <button
          onClick={onSubmit}
          disabled={loading}
          className="py-3 px-6 rounded-xl bg-lyra-accent text-white font-medium
                     hover:bg-lyra-accent-soft transition-colors duration-200
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent"
        >
          {loading ? 'Searching...' : 'Find professionals nearby'}
        </button>
        <button
          onClick={onSkip}
          className="text-sm text-lyra-text-muted hover:text-lyra-text
                     transition-colors duration-200 underline
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent rounded"
        >
          Skip, just show me resources
        </button>
      </div>
    </div>
  )
}

function GoogleMapView({
  therapists,
  centerLat,
  centerLng
}: {
  therapists: TherapistResult[]
  centerLat: number
  centerLng: number
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [selectedTherapist, setSelectedTherapist] = useState<TherapistResult | null>(null)

  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => setMapLoaded(true))
      .catch((err) => console.error('Failed to load Google Maps:', err))
  }, [])

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.google) return

    const map = new google.maps.Map(mapRef.current, {
      center: { lat: centerLat, lng: centerLng },
      zoom: 13,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    })

    mapInstanceRef.current = map

    therapists.forEach((therapist, index) => {
      const marker = new google.maps.Marker({
        position: { lat: therapist.lat, lng: therapist.lng },
        map,
        title: therapist.name,
        label: {
          text: `${index + 1}`,
          color: 'white',
          fontSize: '12px',
          fontWeight: 'bold'
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 16,
          fillColor: '#9b87f5',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2
        }
      })

      marker.addListener('click', () => {
        setSelectedTherapist(therapist)
        map.panTo({ lat: therapist.lat, lng: therapist.lng })
      })
    })
  }, [mapLoaded, therapists, centerLat, centerLng])

  if (!mapLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-lyra-surface-dim rounded-xl">
        <p className="text-sm text-lyra-text-muted">Loading map...</p>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-xl" />
      {selectedTherapist && (
        <div className="absolute bottom-4 left-4 right-4 bg-white p-4 rounded-xl shadow-lg">
          <button
            onClick={() => setSelectedTherapist(null)}
            className="absolute top-2 right-2 text-lyra-text-muted hover:text-lyra-text"
          >
            ✕
          </button>
          <p className="font-medium text-lyra-text text-sm">{selectedTherapist.name}</p>
          <p className="text-xs text-lyra-text-muted mt-1">{selectedTherapist.address}</p>
          {selectedTherapist.phone && (
            <a
              href={`tel:${selectedTherapist.phone}`}
              className="text-xs text-lyra-accent mt-1 inline-block"
            >
              {selectedTherapist.phone}
            </a>
          )}
          {selectedTherapist.rating && (
            <span className="text-xs text-lyra-text-muted ml-2">
              {selectedTherapist.rating} stars
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function ResultsStep({
  results,
  onDismiss
}: {
  results: CodeYellowResults
  onDismiss: () => void
}) {
  const hasMap = results.type === 'results' && results.therapists && results.therapists.length > 0

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-medium text-lyra-text mb-4 text-center">
        {results.type === 'results' ? 'Professionals near you' : 'Support resources'}
      </h2>

      {hasMap ? (
        <div className="flex-1 flex gap-4 overflow-hidden">
          {/* Map on the left */}
          <div className="flex-1 min-h-[500px]">
            <GoogleMapView
              therapists={results.therapists!}
              centerLat={results.centerLat!}
              centerLng={results.centerLng!}
            />
          </div>

          {/* List on the right */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
              {results.therapists!.map((t, i) => (
                <div key={i} className="p-3 rounded-xl bg-lyra-surface-dim">
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-lyra-accent text-white text-xs flex items-center justify-center font-bold">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-lyra-text text-sm">{t.name}</p>
                      <p className="text-xs text-lyra-text-muted mt-1">{t.address}</p>
                      {t.phone && (
                        <a
                          href={`tel:${t.phone}`}
                          className="text-xs text-lyra-accent mt-1 inline-block"
                        >
                          {t.phone}
                        </a>
                      )}
                      {t.rating && (
                        <span className="text-xs text-lyra-text-muted ml-2">
                          {t.rating} stars
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Fallback resources */}
            <div className="space-y-2 pb-2">
              <p className="text-xs text-lyra-text-muted font-medium uppercase tracking-wide">
                Always available
              </p>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {results.fallbackResources.map((r, i) => (
                  <div key={i} className="p-2 rounded-lg bg-lyra-surface-dim text-xs">
                    <p className="font-medium text-lyra-text">{r.name}</p>
                    <p className="text-lyra-text-muted">{r.description}</p>
                    {r.contact.startsWith('http') ? (
                      <a
                        href={r.contact}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lyra-accent inline-block"
                      >
                        {r.contact}
                      </a>
                    ) : (
                      <p className="text-lyra-accent font-medium">{r.contact}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {results.fallbackResources.map((r, i) => (
            <div key={i} className="p-3 rounded-xl bg-lyra-surface-dim">
              <p className="font-medium text-lyra-text text-sm">{r.name}</p>
              <p className="text-xs text-lyra-text-muted">{r.description}</p>
              {r.contact.startsWith('http') ? (
                <a
                  href={r.contact}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-lyra-accent mt-1 inline-block"
                >
                  {r.contact}
                </a>
              ) : (
                <p className="text-xs text-lyra-accent mt-1 font-medium">{r.contact}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onDismiss}
        className="w-full mt-4 py-3 px-6 rounded-xl bg-lyra-surface-dim text-lyra-text font-medium
                   hover:bg-lyra-bg-deep transition-colors duration-200
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-lyra-accent"
      >
        Return to conversation
      </button>
    </div>
  )
}

function FallbackLoadingStep() {
  return (
    <div className="text-center py-8">
      <p className="text-sm text-lyra-text-muted">Loading resources...</p>
    </div>
  )
}
