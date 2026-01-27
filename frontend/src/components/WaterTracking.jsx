import { useState, useEffect } from 'react'
import { Droplets, Plus, Minus, Settings, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { logWater, getTodayWater, deleteWaterLog, updateWaterGoal } from '../services/api'
import { Card, CardBody } from './layout/AppLayout'
import toast from 'react-hot-toast'

export default function WaterTracking() {
  const [todayData, setTodayData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logging, setLogging] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [newGoal, setNewGoal] = useState(2000)

  // Quick add amounts in ml
  const quickAmounts = [
    { label: 'Glass', sublabel: '250ml', value: 250 },
    { label: 'Bottle', sublabel: '500ml', value: 500 },
    { label: 'Large', sublabel: '750ml', value: 750 },
  ]

  useEffect(() => {
    fetchTodayWater()
  }, [])

  const fetchTodayWater = async () => {
    try {
      setLoading(true)
      const data = await getTodayWater()
      setTodayData(data)
      setNewGoal(data.goal_ml)
    } catch (err) {
      console.error('Failed to fetch water data:', err)
      toast.error('Failed to load water data')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickAdd = async (amount) => {
    try {
      setLogging(true)
      await logWater(amount)
      toast.success(`+${amount}ml logged`)
      await fetchTodayWater()
    } catch (err) {
      console.error('Failed to log water:', err)
      toast.error('Failed to log water')
    } finally {
      setLogging(false)
    }
  }

  const handleDeleteLog = async (logId) => {
    try {
      await deleteWaterLog(logId)
      toast.success('Entry removed')
      await fetchTodayWater()
    } catch (err) {
      console.error('Failed to delete log:', err)
      toast.error('Failed to delete')
    }
  }

  const handleUpdateGoal = async () => {
    try {
      await updateWaterGoal(newGoal)
      toast.success('Goal updated')
      setShowSettings(false)
      await fetchTodayWater()
    } catch (err) {
      console.error('Failed to update goal:', err)
      toast.error('Failed to update goal')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardBody>
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </CardBody>
      </Card>
    )
  }

  const percentComplete = Math.min(todayData?.percent_complete || 0, 100)
  const totalMl = todayData?.total_ml || 0
  const goalMl = todayData?.goal_ml || 2000
  const remaining = Math.max(0, goalMl - totalMl)
  const glasses = Math.floor(totalMl / 250)

  // Calculate water level for visual
  const waterLevel = Math.min(percentComplete, 100)

  return (
    <div className="space-y-4">
      {/* Main Water Card */}
      <Card>
        <CardBody>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Droplets className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Daily Hydration</h3>
                <p className="text-sm text-gray-500">{glasses} glasses today</p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="btn-icon"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Daily Goal
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setNewGoal(Math.max(500, newGoal - 250))}
                  className="btn-icon bg-white border border-gray-200"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex-1 text-center">
                  <span className="text-2xl font-bold text-gray-900">{newGoal}</span>
                  <span className="text-gray-500 ml-1">ml</span>
                </div>
                <button
                  onClick={() => setNewGoal(Math.min(5000, newGoal + 250))}
                  className="btn-icon bg-white border border-gray-200"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowSettings(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateGoal}
                  className="btn-primary flex-1"
                >
                  Save Goal
                </button>
              </div>
            </div>
          )}

          {/* Visual Progress - Water Glass */}
          <div className="flex items-center gap-6 mb-6">
            {/* Glass Visual */}
            <div className="relative w-24 h-32 flex-shrink-0">
              {/* Glass Container */}
              <div className="absolute inset-0 rounded-b-3xl rounded-t-lg border-4 border-blue-200 bg-blue-50/50 overflow-hidden">
                {/* Water Fill */}
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500 to-blue-400 transition-all duration-700 ease-out"
                  style={{ height: `${waterLevel}%` }}
                >
                  {/* Wave effect */}
                  <div className="absolute top-0 left-0 right-0 h-2 bg-blue-300/50 rounded-full transform -translate-y-1"></div>
                </div>
              </div>
              {/* Percentage overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-lg font-bold ${waterLevel > 50 ? 'text-white' : 'text-blue-600'}`}>
                  {Math.round(percentComplete)}%
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex-1 space-y-3">
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {(totalMl / 1000).toFixed(1)}
                  <span className="text-lg font-normal text-gray-500 ml-1">L</span>
                </div>
                <div className="text-sm text-gray-500">
                  of {(goalMl / 1000).toFixed(1)}L goal
                </div>
              </div>
              
              {percentComplete >= 100 ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  <span>🎉</span> Goal reached!
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-blue-600">{remaining}ml</span> more to go
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  percentComplete >= 100 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                }`}
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>

          {/* Quick Add Buttons */}
          <div className="grid grid-cols-3 gap-3">
            {quickAmounts.map((item) => (
              <button
                key={item.value}
                onClick={() => handleQuickAdd(item.value)}
                disabled={logging}
                className="group relative p-4 bg-gradient-to-b from-blue-50 to-blue-100/50 hover:from-blue-100 hover:to-blue-150 border border-blue-200 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex flex-col items-center">
                  <Plus className="w-5 h-5 text-blue-500 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-blue-700">{item.label}</span>
                  <span className="text-xs text-blue-500">{item.sublabel}</span>
                </div>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* History Card */}
      {todayData?.logs?.length > 0 && (
        <Card>
          <CardBody className="p-0">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">Today's Entries</span>
                <span className="badge badge-gray">{todayData.logs.length}</span>
              </div>
              {showHistory ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {showHistory && (
              <div className="border-t border-gray-100">
                {todayData.logs.map((log, index) => (
                  <div
                    key={log.id}
                    className={`flex items-center justify-between px-4 py-3 ${
                      index !== todayData.logs.length - 1 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Droplets className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">{log.amount_ml}ml</span>
                        {log.note && (
                          <span className="text-gray-400 ml-2">• {log.note}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {new Date(log.log_time).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="btn-icon text-gray-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
