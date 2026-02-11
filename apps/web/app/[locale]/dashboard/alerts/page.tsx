'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bell, CheckCircle, AlertTriangle, Info, X } from 'lucide-react'

interface Alert {
  id: string
  type: 'critical' | 'warning' | 'info'
  title: string
  description: string
  timestamp: string
  acknowledged: boolean
  animalId?: string
  animalName?: string
}

export default function AlertsPage() {
  const t = useTranslations('alerts')
  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: '1',
      type: 'critical',
      title: 'Medication Overdue',
      description: 'Max (Dog #A123) missed his morning medication - Antibiotics due 2 hours ago',
      timestamp: '2 hours ago',
      acknowledged: false,
      animalId: 'A123',
      animalName: 'Max'
    },
    {
      id: '2',
      type: 'warning',
      title: 'Vaccination Due Soon',
      description: 'Luna (Cat #C456) rabies vaccination due in 3 days',
      timestamp: '30 minutes ago',
      acknowledged: false,
      animalId: 'C456',
      animalName: 'Luna'
    },
    {
      id: '3',
      type: 'info',
      title: 'Kennel Maintenance',
      description: 'Zone B kennels need cleaning inspection this week',
      timestamp: '1 hour ago',
      acknowledged: true
    }
  ])

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ))
  }

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId))
  }

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />
    }
  }

  const getAlertVariant = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return 'destructive' as const
      case 'warning':
        return 'secondary' as const
      case 'info':
        return 'outline' as const
    }
  }

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description', { count: unacknowledgedCount })}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <CheckCircle className="h-4 w-4 mr-2" />
          {t('acknowledgeAll')}
        </Button>
      </div>

      <div className="grid gap-4">
        {alerts.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('noAlerts.title')}</h3>
                <p className="text-muted-foreground">{t('noAlerts.description')}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          alerts.map((alert) => (
            <Card key={alert.id} className={alert.acknowledged ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getAlertIcon(alert.type)}
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{alert.title}</CardTitle>
                      {alert.animalName && (
                        <Badge variant="outline" className="w-fit">
                          {alert.animalName} ({alert.animalId})
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getAlertVariant(alert.type)}>
                      {t(`types.${alert.type}`)}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => dismissAlert(alert.id)}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">{alert.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{alert.timestamp}</span>
                  {!alert.acknowledged && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => acknowledgeAlert(alert.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {t('acknowledge')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}