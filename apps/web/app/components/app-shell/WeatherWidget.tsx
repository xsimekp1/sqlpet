'use client'

import { useEffect, useState } from 'react'
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, Sun } from 'lucide-react'
import { useOrganizationStore } from '@/app/stores/organizationStore'
import { ApiClient } from '@/app/lib/api'

interface OrgData {
  id: string
  name: string
  lat?: number | null
  lng?: number | null
}

interface WeatherData {
  temp: number
  code: number
  period: 'day' | 'night'
  location: string
  cachedAt: number
}

const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes

function getWeatherIcon(code: number) {
  if (code === 0) return Sun
  if (code <= 3) return Cloud
  if (code <= 48) return CloudFog
  if (code <= 57) return CloudDrizzle
  if (code <= 67) return CloudRain
  if (code <= 77) return CloudSnow
  if (code <= 82) return CloudRain
  if (code <= 86) return CloudSnow
  return CloudLightning
}

function getWeatherLabel(code: number, period: 'day' | 'night'): string {
  if (period === 'night') {
    if (code === 0) return 'Jasná noc'
    if (code <= 3) return 'Polojasno'
    if (code <= 48) return 'Mlha'
    if (code <= 57) return 'Mrholení'
    if (code <= 67) return 'Déšť'
    if (code <= 77) return 'Sníh'
    return 'Bouřka'
  }
  if (code === 0) return 'Slunečno'
  if (code <= 3) return 'Polojasno'
  if (code <= 48) return 'Mlha'
  if (code <= 57) return 'Mrholení'
  if (code <= 67) return 'Déšť'
  if (code <= 77) return 'Sníh'
  if (code <= 82) return 'Přeháňky'
  if (code <= 86) return 'Sněhové přeháňky'
  return 'Bouřka'
}

function getPeriodLabel(period: 'day' | 'night', isTomorrow: boolean): string {
  if (isTomorrow) {
    return period === 'day' ? 'Zítra' : 'Zítra v noci'
  }
  return period === 'day' ? 'Dnes' : 'Dnes v noci'
}

export function WeatherWidget() {
  const { selectedOrg } = useOrganizationStore()
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)

  const orgId = selectedOrg?.id || 'default'
  const fallbackLat = 50.0875 // Prague
  const fallbackLng = 14.4214

  useEffect(() => {
    const fetchWeather = async () => {
      const cacheKey = `weather_cache_${orgId}`
      const cached = localStorage.getItem(cacheKey)

      if (cached) {
        try {
          const data: WeatherData = JSON.parse(cached)
          if (Date.now() - data.cachedAt < CACHE_DURATION) {
            setWeather(data)
            return
          }
        } catch {
          // Invalid cache, continue to fetch
        }
      }

      setLoading(true)

      try {
        // Get org details to get lat/lng
        let lat = fallbackLat
        let lng = fallbackLng
        let locationName = 'Praha'

        try {
          const orgData = await ApiClient.get('/organization/current') as OrgData
          if (orgData?.lat && orgData?.lng) {
            lat = orgData.lat
            lng = orgData.lng
            locationName = orgData.name
          } else if (orgData?.name) {
            locationName = orgData.name
          }
        } catch {
          // Use fallback
        }

        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&timezone=auto`
        )
        const json = await res.json()

        const currentHour = new Date().getHours()
        const hourly = json.hourly
        const today = new Date().toISOString().split('T')[0]

        let period: 'day' | 'night'
        let temp: number
        let code: number

        if (currentHour < 14) {
          // Before 14:00 - show today day
          period = 'day'
          const hourIndex = Math.max(0, Math.min(hourly.time.findIndex((t: string) => {
            const dt = new Date(t)
            return dt.getHours() === 9 && t.startsWith(today)
          }), hourly.time.length - 1))
          temp = Math.round(hourly.temperature_2m[hourIndex >= 0 ? hourIndex : currentHour])
          code = hourly.weather_code[hourIndex >= 0 ? hourIndex : currentHour]
        } else {
          // After 14:00 - show tonight
          period = 'night'
          const hourIndex = Math.max(0, Math.min(hourly.time.findIndex((t: string) => {
            const dt = new Date(t)
            return dt.getHours() === 21 && t.startsWith(today)
          }), hourly.time.length - 1))
          temp = Math.round(hourly.temperature_2m[hourIndex >= 0 ? hourIndex : currentHour])
          code = hourly.weather_code[hourIndex >= 0 ? hourIndex : currentHour]
        }

        const newWeather: WeatherData = {
          temp,
          code,
          period,
          location: locationName,
          cachedAt: Date.now(),
        }

        localStorage.setItem(cacheKey, JSON.stringify(newWeather))
        setWeather(newWeather)
      } catch (err) {
        console.error('Weather fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchWeather()
  }, [orgId])

  if (!weather && !loading) return null

  const Icon = getWeatherIcon(weather?.code || 0)
  const label = weather ? getWeatherLabel(weather.code, weather.period) : ''
  const periodLabel = weather ? getPeriodLabel(weather.period, false) : ''

  return (
    <div className="flex items-center gap-2 text-slate-200">
      {loading && !weather ? (
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-6 h-6 bg-slate-600 rounded-full" />
          <div className="w-12 h-4 bg-slate-600 rounded" />
        </div>
      ) : (
        <>
          <Icon className="w-5 h-5 text-yellow-400" />
          <div className="flex flex-col leading-tight">
            <span className="text-xs text-slate-400">{periodLabel}</span>
            <span className="text-sm font-medium">{weather?.temp}°C · {label}</span>
          </div>
        </>
      )}
    </div>
  )
}

const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes

function getWeatherIcon(code: number) {
  if (code === 0) return Sun
  if (code <= 3) return Cloud
  if (code <= 48) return CloudFog
  if (code <= 57) return CloudDrizzle
  if (code <= 67) return CloudRain
  if (code <= 77) return CloudSnow
  if (code <= 82) return CloudRain
  if (code <= 86) return CloudSnow
  return CloudLightning
}

function getWeatherLabel(code: number, period: 'day' | 'night'): string {
  if (period === 'night') {
    if (code === 0) return 'Jasná noc'
    if (code <= 3) return 'Polojasno'
    if (code <= 48) return 'Mlha'
    if (code <= 57) return 'Mrholení'
    if (code <= 67) return 'Déšť'
    if (code <= 77) return 'Sníh'
    return 'Bouřka'
  }
  if (code === 0) return 'Slunečno'
  if (code <= 3) return 'Polojasno'
  if (code <= 48) return 'Mlha'
  if (code <= 57) return 'Mrholení'
  if (code <= 67) return 'Déšť'
  if (code <= 77) return 'Sníh'
  if (code <= 82) return 'Přeháňky'
  if (code <= 86) return 'Sněhové přeháňky'
  return 'Bouřka'
}

function getPeriodLabel(period: 'day' | 'night', isTomorrow: boolean): string {
  if (isTomorrow) {
    return period === 'day' ? 'Zítra' : 'Zítra v noci'
  }
  return period === 'day' ? 'Dnes' : 'Dnes v noci'
}

export function WeatherWidget() {
  const { organization } = useOrganization()
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)

  const orgId = organization?.id || 'default'
  const lat = organization?.lat || 50.08
  const lng = organization?.lng || 14.44
  const locationName = organization?.name || 'Praha'

  useEffect(() => {
    const fetchWeather = async () => {
      const cacheKey = `weather_cache_${orgId}`
      const cached = localStorage.getItem(cacheKey)

      if (cached) {
        try {
          const data: WeatherData = JSON.parse(cached)
          if (Date.now() - data.cachedAt < CACHE_DURATION) {
            setWeather(data)
            return
          }
        } catch {
          // Invalid cache, continue to fetch
        }
      }

      setLoading(true)

      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&timezone=auto`
        )
        const json = await res.json()

        const currentHour = new Date().getHours()
        const hourly = json.hourly
        const today = new Date().toISOString().split('T')[0]

        let period: 'day' | 'night'
        let temp: number
        let code: number
        let displayHour: number

        if (currentHour < 14) {
          // Before 14:00 - show today day (9:00) or current
          displayHour = currentHour < 9 ? 9 : currentHour
          period = 'day'
        } else {
          // After 14:00 - show tonight (21:00) or current
          displayHour = currentHour > 21 ? 21 : currentHour
          period = 'night'
        }

        const hourIndex = hourly.time.findIndex((t: string) => {
          const dt = new Date(t)
          return dt.getHours() === displayHour && t.startsWith(today)
        })

        const idx = hourIndex >= 0 ? hourIndex : 0
        temp = Math.round(hourly.temperature_2m[idx])
        code = hourly.weather_code[idx]

        const newWeather: WeatherData = {
          temp,
          code,
          period,
          location: locationName,
          cachedAt: Date.now(),
        }

        localStorage.setItem(cacheKey, JSON.stringify(newWeather))
        setWeather(newWeather)
      } catch (err) {
        console.error('Weather fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchWeather()
  }, [orgId, lat, lng, locationName])

  if (!weather && !loading) return null

  const Icon = getWeatherIcon(weather?.code || 0)
  const label = weather ? getWeatherLabel(weather.code, weather.period) : ''
  const periodLabel = weather ? getPeriodLabel(weather.period, false) : ''

  return (
    <div className="flex items-center gap-2 text-slate-200">
      {loading && !weather ? (
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-6 h-6 bg-slate-600 rounded-full" />
          <div className="w-12 h-4 bg-slate-600 rounded" />
        </div>
      ) : (
        <>
          <Icon className="w-5 h-5 text-yellow-400" />
          <div className="flex flex-col leading-tight">
            <span className="text-xs text-slate-400">{periodLabel}</span>
            <span className="text-sm font-medium">{weather?.temp}°C · {label}</span>
          </div>
        </>
      )}
    </div>
  )
}
