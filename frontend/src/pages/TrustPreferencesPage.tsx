import { useState, useEffect } from 'react'
import { ProfileSelector } from '@/components/trust-preferences/ProfileSelector'
import { WeightSlider } from '@/components/trust-preferences/WeightSlider'
import { TrustScoreBadge } from '@/components/trust-preferences/TrustScoreBadge'
import { useTrustPreferencesStore } from '@/store/trustPreferencesStore'

export const TrustPreferencesPage = () => {
  const { preferences, loadPreferences, updateWeights, isLoading } = useTrustPreferencesStore()
  const [localWeights, setLocalWeights] = useState(preferences?.weights || {
    journey: 25,
    certifications: 20,
    conditions: 20,
    payments: 15,
    reviews: 20
  })

  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  useEffect(() => {
    if (preferences?.weights) {
      setLocalWeights(preferences.weights)
    }
  }, [preferences])

  const handleWeightChange = (key: string, value: number) => {
    const newWeights = { ...localWeights, [key]: value }
    setLocalWeights(newWeights)
  }

  const handleSave = async () => {
    await updateWeights(localWeights)
  }

  const totalWeight = Object.values(localWeights).reduce((sum, w) => sum + w, 0)

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Trust Score Preferences</h1>
      <p className="text-gray-600 mb-8">
        Customize how we calculate trust scores based on what matters most to you.
      </p>

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Quick Profiles</h2>
        <ProfileSelector />
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Custom Weights</h2>
        <p className="text-sm text-gray-500 mb-4">
          Adjust the importance of each factor. Total should equal 100%.
        </p>

        <div className="space-y-6">
          <WeightSlider
            label="Supply Chain Journey"
            description="Origin, transport, storage tracking"
            value={localWeights.journey}
            onChange={(v) => handleWeightChange('journey', v)}
          />
          <WeightSlider
            label="Certifications"
            description="Quality and safety certifications"
            value={localWeights.certifications}
            onChange={(v) => handleWeightChange('certifications', v)}
          />
          <WeightSlider
            label="Storage Conditions"
            description="Temperature, humidity monitoring"
            value={localWeights.conditions}
            onChange={(v) => handleWeightChange('conditions', v)}
          />
          <WeightSlider
            label="Supplier Payments"
            description="Fair payment practices"
            value={localWeights.payments}
            onChange={(v) => handleWeightChange('payments', v)}
          />
          <WeightSlider
            label="Customer Reviews"
            description="Verified customer feedback"
            value={localWeights.reviews}
            onChange={(v) => handleWeightChange('reviews', v)}
          />
        </div>

        <div className="mt-6 pt-4 border-t flex items-center justify-between">
          <div>
            <span className={`font-medium ${totalWeight === 100 ? 'text-green-600' : 'text-red-600'}`}>
              Total: {totalWeight}%
            </span>
            {totalWeight !== 100 && (
              <span className="text-sm text-red-500 ml-2">
                (should be 100%)
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={totalWeight !== 100 || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            {isLoading ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Preview</h2>
        <p className="text-sm text-gray-500 mb-4">
          See how your preferences affect trust score display.
        </p>
        <div className="flex justify-center">
          <TrustScoreBadge score={85} weights={localWeights} />
        </div>
      </div>
    </div>
  )
}
