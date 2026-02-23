'use client'

import { useEffect, useState, useCallback } from 'react'
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, Sun, Moon } from 'lucide-react'
import { useOrganizationStore } from '@/app/stores/organizationStore'
import { ApiClient } from '@/app/lib/api'

interface OrgData {
  id: string
  name: string
  lat?: number | null
  lng?: number | null
}

interface WeatherData {
  day: { temp: number; code: number }
  night: { temp: number; code: number }
  location: string
  cachedAt: number
}

const CACHE_DURATION = 30 * 60 * 1000

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

function getWeatherLabel(code: number): string {
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

function getNightWeatherLabel(code: number): string {
  if (code === 0) return 'Jasná noc'
  if (code <= 3) return 'Polojasno'
  if (code <= 48) return 'Mlha'
  if (code <= 57) return 'Mrholení'
  if (code <= 67) return 'Déšť'
  if (code <= 77) return 'Sníh'
  return 'Bouřka'
}

export function WeatherWidget() {
  const { selectedOrg } = useOrganizationStore()
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [showDay, setShowDay] = useState(true)

  const orgId = selectedOrg?.id || 'default'
  const fallbackLat = 50.0875
  const fallbackLng = 14.4214

  useEffect(() => {
    const currentHour = new Date().getHours()
    setShowDay(currentHour < 14)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setShowDay(prev => !prev)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const fetchWeather = useCallback(async () => {
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
        // continue
      }
    }

    setLoading(true)

    try {
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
        // use fallback
      }

      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&timezone=auto`
      )
      const json = await res.json()

      const currentHour = new Date().getHours()
      const hourly = json.hourly
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

      const dayHour = currentHour < 14 ? 14 : 9
      const nightHour = currentHour < 14 ? 21 : 23

      const dayIndex = Math.max(0, Math.min(
        hourly.time.findIndex((t: string) => {
          const dt = new Date(t)
          return dt.getHours() === dayHour && (t.startsWith(today) || t.startsWith(tomorrow))
        }),
        hourly.time.length - 1
      ))

      const nightIndex = Math.max(0, Math.min(
        hourly.time.findIndex((t: string) => {
          const dt = new Date(t)
          return dt.getHours() === nightHour && (t.startsWith(today) || t.startsWith(tomorrow))
        }),
        hourly.time.length - 1
      ))

      const newWeather: WeatherData = {
        day: {
          temp: Math.round(hourly.temperature_2m[dayIndex >= 0 ? dayIndex : 14]),
          code: hourly.weather_code[dayIndex >= 0 ? dayIndex : 14]
        },
        night: {
          temp: Math.round(hourly.temperature_2m[nightIndex >= 0 ? nightIndex : 21]),
          code: hourly.weather_code[nightIndex >= 0 ? nightIndex : 21]
        },
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
  }, [orgId, fallbackLat, fallbackLng])

  useEffect(() => {
    fetchWeather()
  }, [fetchWeather])

  if (!weather && !loading) return null

  const currentData = showDay ? weather?.day : weather?.night
  const Icon = getWeatherIcon(currentData?.code || 0)
  const label = showDay 
    ? getWeatherLabel(currentData?.code || 0)
    : getNightWeatherLabel(currentData?.code || 0)

  return (
    <div className="flex items-center gap-2 text-slate-200">
      {loading && !weather ? (
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-5 h-5 bg-slate-600 rounded-full" />
          <div className="w-10 h-4 bg-slate-600 rounded" />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="relative">
            <Icon className="w-5 h-5 text-yellow-400" />
            <div className="absolute -bottom-1 -right-1">
              {showDay ? (
                <Sun className="w-3 h-3 text-yellow-300" />
              ) : (
                <Moon className="w-3 h-3 text-blue-300" />
              )}
            </div>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs text-slate-400">
              {showDay ? 'Dnes' : 'Dnes v noci'}
            </span>
            <span className="text-sm font-medium">
              {currentData?.temp}°C · {label}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
