'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, XCircle, Clock, Footprints, MapPin, AlertTriangle } from 'lucide-react'

interface KennelTask {
  id: string
  kennelId: string
  kennelName: string
  zone: string
  animalName: string
  animalId: string
  tasks: {
    fed: boolean
    walked: boolean
    cleaned: boolean
    waterChecked: boolean
  }
  notes?: string
  alerts?: string[]
}

export default function WalkModePage() {
  const t = useTranslations('walkMode')
  const [currentKennelIndex, setCurrentKennelIndex] = useState(0)
  const [kennelTasks, setKennelTasks] = useState<KennelTask[]>([
    {
      id: '1',
      kennelId: 'A1',
      kennelName: 'Kennel A1',
      zone: 'Zone A',
      animalName: 'Max',
      animalId: 'A123',
      tasks: { fed: false, walked: false, cleaned: false, waterChecked: false },
      alerts: ['Medication due in 1 hour']
    },
    {
      id: '2',
      kennelId: 'A2',
      kennelName: 'Kennel A2',
      zone: 'Zone A',
      animalName: 'Luna',
      animalId: 'C456',
      tasks: { fed: true, walked: false, cleaned: false, waterChecked: true }
    },
    {
      id: '3',
      kennelId: 'B1',
      kennelName: 'Kennel B1',
      zone: 'Zone B',
      animalName: 'Charlie',
      animalId: 'D789',
      tasks: { fed: false, walked: false, cleaned: false, waterChecked: false }
    }
  ])

  const currentKennel = kennelTasks[currentKennelIndex]
  const progress = kennelTasks.filter(k => 
    Object.values(k.tasks).every(task => task === true)
  ).length / kennelTasks.length * 100

  const updateTask = (kennelId: string, task: keyof KennelTask['tasks'], value: boolean) => {
    setKennelTasks(prev => prev.map(kennel => 
      kennel.id === kennelId 
        ? { ...kennel, tasks: { ...kennel.tasks, [task]: value } }
        : kennel
    ))
  }

  const nextKennel = () => {
    if (currentKennelIndex < kennelTasks.length - 1) {
      setCurrentKennelIndex(prev => prev + 1)
    }
  }

  const previousKennel = () => {
    if (currentKennelIndex > 0) {
      setCurrentKennelIndex(prev => prev - 1)
    }
  }

  const completeKennelTasks = () => {
    setKennelTasks(prev => prev.map(kennel => 
      kennel.id === currentKennel.id 
        ? { ...kennel, tasks: { fed: true, walked: true, cleaned: true, waterChecked: true } }
        : kennel
    ))
    nextKennel()
  }

  const TaskButton = ({ 
    task, 
    label, 
    icon: Icon 
  }: { 
    task: boolean
    label: string
    icon: any 
  }) => (
    <Button
      variant={task ? "default" : "outline"}
      size="lg"
      className="h-20 flex-col gap-2"
      onClick={() => updateTask(currentKennel.id, task as keyof KennelTask['tasks'], !task)}
    >
      <Icon className="h-6 w-6" />
      <span>{label}</span>
      {task && <CheckCircle className="h-4 w-4 text-green-600" />}
    </Button>
  )

  if (!currentKennel) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Footprints className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('completed.title')}</h3>
              <p className="text-muted-foreground mb-4">{t('completed.description')}</p>
              <Button onClick={() => setCurrentKennelIndex(0)}>
                {t('completed.startNew')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isKennelComplete = Object.values(currentKennel.tasks).every(task => task === true)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description', { current: currentKennelIndex + 1, total: kennelTasks.length })}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">{t('progress')}</div>
          <div className="text-2xl font-bold">{Math.round(progress)}%</div>
        </div>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current Kennel Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {currentKennel.kennelName}
                </CardTitle>
                <CardDescription>
                  {currentKennel.zone} • {currentKennel.animalName} ({currentKennel.animalId})
                </CardDescription>
              </div>
              <Badge variant={isKennelComplete ? "default" : "secondary"}>
                {isKennelComplete ? t('status.complete') : t('status.inProgress')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {currentKennel.alerts && currentKennel.alerts.length > 0 && (
              <div className="space-y-2 mb-4">
                {currentKennel.alerts.map((alert, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm text-yellow-800">{alert}</span>
                  </div>
                ))}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <TaskButton
                task={currentKennel.tasks.fed}
                label={t('tasks.fed')}
                icon={Clock}
              />
              <TaskButton
                task={currentKennel.tasks.walked}
                label={t('tasks.walked')}
                icon={Footprints}
              />
              <TaskButton
                task={currentKennel.tasks.cleaned}
                label={t('tasks.cleaned')}
                icon={CheckCircle}
              />
              <TaskButton
                task={currentKennel.tasks.waterChecked}
                label={t('tasks.waterChecked')}
                icon={Clock}
              />
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions & Notes */}
        <Card>
          <CardHeader>
            <CardTitle>{t('quickActions.title')}</CardTitle>
            <CardDescription>{t('quickActions.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={completeKennelTasks}
              className="w-full h-12"
              disabled={isKennelComplete}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {t('quickActions.markComplete')}
            </Button>
            
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={previousKennel} disabled={currentKennelIndex === 0}>
                {t('navigation.previous')}
              </Button>
              <Button 
                variant="outline" 
                onClick={nextKennel}
                disabled={currentKennelIndex === kennelTasks.length - 1}
              >
                {t('navigation.next')}
              </Button>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">{t('notes.title')}</h4>
              <textarea 
                className="w-full p-3 border rounded-md resize-none"
                rows={3}
                placeholder={t('notes.placeholder')}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kennel List Overview */}
      <Card>
        <CardHeader>
          <CardTitle>{t('overview.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
            {kennelTasks.map((kennel, index) => (
              <div
                key={kennel.id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  index === currentKennelIndex 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setCurrentKennelIndex(index)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{kennel.kennelName}</span>
                  {Object.values(kennel.tasks).every(task => task === true) ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="text-sm text-muted-foreground">{kennel.animalName}</div>
                <Progress 
                  value={
                    Object.values(kennel.tasks).filter(task => task === true).length / 
                    Object.values(kennel.tasks).length * 100
                  } 
                  className="h-1 mt-2" 
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}