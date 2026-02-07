import { useLyraState } from './hooks/useLyraState'
import LandingScreen from './screens/LandingScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import CheckInScreen from './screens/CheckInScreen'
import SessionScreen from './screens/SessionScreen'
import CrisisScreen from './screens/CrisisScreen'
import GratitudeScreen from './screens/GratitudeScreen'

export default function App(): React.JSX.Element {
  const {
    state,
    navigate,
    setRisk,
    toggleInputMode,
    startRecording,
    stopRecording,
    sendText,
    setIntent,
    declineGratitude,
    requestEndSession,
    confirmEndSession,
  } = useLyraState()

  switch (state.screen) {
    case 'landing':
      return (
        <LandingScreen
          onStart={() => navigate('onboarding')}
          onHowItWorks={() => navigate('onboarding')}
          onCrisis={() => navigate('crisis')}
        />
      )

    case 'onboarding':
      return (
        <OnboardingScreen
          onComplete={() => navigate('checkin')}
          onSkip={() => navigate('checkin')}
          onCrisis={() => navigate('crisis')}
        />
      )

    case 'checkin':
      return (
        <CheckInScreen
          onSelect={setRisk}
          onCrisis={() => navigate('crisis')}
        />
      )

    case 'session':
      return (
        <SessionScreen
          state={state}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onSendText={sendText}
          onToggleInputMode={toggleInputMode}
          onEndSession={requestEndSession}
          onConfirmEndSession={confirmEndSession}
          onSetIntent={setIntent}
          onDeclineGratitude={declineGratitude}
        />
      )

    case 'crisis':
      return <CrisisScreen onBack={() => navigate('landing')} />

    case 'gratitude':
      return <GratitudeScreen onBack={() => navigate('session')} />

    default:
      return (
        <LandingScreen
          onStart={() => navigate('onboarding')}
          onHowItWorks={() => navigate('onboarding')}
          onCrisis={() => navigate('crisis')}
        />
      )
  }
}
