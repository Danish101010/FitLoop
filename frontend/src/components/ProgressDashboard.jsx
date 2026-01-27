import { useState, useEffect } from 'react'
import { 
  Calendar, 
  TrendingUp, 
  Flame, 
  RefreshCw,
  Droplets,
  Dumbbell,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  Award,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Utensils
} from 'lucide-react'
import { PageHeader, PageContent, Card, CardBody, CardHeader } from './layout/AppLayout'
import { getWeeklyProgress, getMonthlyProgress, getTodayFullProgress } from '../services/api'
import { useAuth } from '../context/AuthContext'
import WaterTracking from './WaterTracking'
import WorkoutLogging from './WorkoutLogging'
import toast from 'react-hot-toast'

export default function ProgressDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('today')
  const [loading, setLoading] = useState(true)
  const [weeklyData, setWeeklyData] = useState(null)
  const [monthlyData, setMonthlyData] = useState(null)
  const [todayData, setTodayData] = useState(null)
  const [loadingMonthly, setLoadingMonthly] = useState(false)

  useEffect(() => {
    loadProgressData()
  }, [])

  // Load monthly data only when monthly tab is selected
  useEffect(() => {
    if (activeTab === 'monthly' && !monthlyData && !loadingMonthly) {
      loadMonthlyData()
    }
  }, [activeTab])

  const loadProgressData = async () => {
    setLoading(true)
    try {
      // Load today and weekly in parallel (skip monthly for faster initial load)
      const [today, weekly] = await Promise.all([
        getTodayFullProgress(),
        getWeeklyProgress()
      ])
      setTodayData(today)
      setWeeklyData(weekly)
    } catch (error) {
      console.error('Failed to load progress:', error)
      toast.error('Failed to load progress data')
    } finally {
      setLoading(false)
    }
  }

  const loadMonthlyData = async () => {
    setLoadingMonthly(true)
    try {
      const monthly = await getMonthlyProgress()
      setMonthlyData(monthly)
    } catch (error) {
      console.error('Failed to load monthly progress:', error)
      toast.error('Failed to load monthly data')
    } finally {
      setLoadingMonthly(false)
    }
  }

  // Safe defaults for today's data
  const safeToday = todayData || {
    calories_in: 0,
    calories_out: 0,
    net_calories: 0,
    calorie_target: 2000,
    calorie_status: 'on_track',
    nutrition: {
      calories: { consumed: 0, target: 2000 },
      protein: { consumed: 0, target: 150 },
      carbs: { consumed: 0, target: 250 },
      fat: { consumed: 0, target: 65 },
      meals_logged: 0
    },
    macro_balance: { protein_percent: 0, carbs_percent: 0, fat_percent: 0 },
    meal_breakdown: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
    water: { total_ml: 0, goal_ml: 2000, percent: 0, logs_count: 0 },
    workouts: { count: 0, duration_minutes: 0, calories_burned: 0 },
    status_level: 'ok',
    status_message: 'Keep logging to get personalized insights!',
    status_emoji: '👋',
    insights: []
  }
  
  const nutritionData = safeToday.nutrition || {
    calories: { consumed: 0, target: 2000 },
    protein: { consumed: 0, target: 150 },
    carbs: { consumed: 0, target: 250 },
    fat: { consumed: 0, target: 65 },
    meals_logged: 0
  }

  // Safe defaults for weekly data
  const safeWeekly = weeklyData || {
    days: Array(7).fill(null).map((_, i) => ({
      date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
      day_name: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.now() - (6 - i) * 86400000).getDay()],
      calories: 0,
      protein: 0,
      meals_logged: 0,
      calorie_goal_met: false,
      calorie_ratio: 0
    })),
    targets: { calories: 2000, protein: 150, carbs: 250, fat: 65 },
    averages: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    totals: { meals: 0, calories: 0 },
    wow_delta: { calories: 0, protein: 0, direction_calories: 'stable', direction_protein: 'stable' },
    streaks: { current_streak: 0, longest_streak: 0, days_logged_this_week: 0, water_goal_met_streak: 0 },
    top_foods: [],
    insights: [],
    goal_hit_days: 0,
    protein_goal_days: 0,
    days_logged: 0
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Progress" subtitle="Track your nutrition journey" />
        <PageContent>
          <div className="space-y-6 animate-pulse">
            {/* Skeleton for coaching card */}
            <Card>
              <CardBody>
                <div className="h-24 bg-gray-200 rounded-lg"></div>
              </CardBody>
            </Card>
            {/* Skeleton for quick stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => (
                <Card key={i}>
                  <CardBody>
                    <div className="h-16 bg-gray-200 rounded"></div>
                  </CardBody>
                </Card>
              ))}
            </div>
            {/* Skeleton for tabs */}
            <Card>
              <div className="h-12 bg-gray-100"></div>
            </Card>
          </div>
        </PageContent>
      </>
    )
  }

  return (
    <>
      <PageHeader 
        title="Progress" 
        subtitle="Your personal nutrition coach"
        actions={
          <button onClick={loadProgressData} className="btn-secondary btn-sm">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        }
      />
      
      <PageContent>
        <div className="space-y-6">
          {/* Coaching Status Card - The main hero */}
          <CoachingStatusCard 
            statusLevel={safeToday.status_level}
            statusMessage={safeToday.status_message}
            statusEmoji={safeToday.status_emoji}
            netCalories={safeToday.net_calories}
            calorieTarget={safeToday.calorie_target}
            calorieStatus={safeToday.calorie_status}
          />

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <NetCaloriesCard 
              caloriesIn={safeToday.calories_in}
              caloriesOut={safeToday.calories_out}
              netCalories={safeToday.net_calories}
              target={safeToday.calorie_target}
              status={safeToday.calorie_status}
            />
            <QuickStatCard 
              icon={Droplets}
              iconBg="bg-blue-100"
              iconColor="text-blue-500"
              value={`${Math.round(safeToday.water?.percent || 0)}%`}
              label="Hydration"
              subValue={`${safeToday.water?.total_ml || 0}ml`}
            />
            <QuickStatCard 
              icon={Dumbbell}
              iconBg="bg-green-100"
              iconColor="text-green-500"
              value={safeToday.workouts?.duration_minutes || 0}
              label="Exercise mins"
              subValue={`-${safeToday.workouts?.calories_burned || 0} cal`}
            />
            <QuickStatCard 
              icon={Utensils}
              iconBg="bg-purple-100"
              iconColor="text-purple-500"
              value={nutritionData.meals_logged}
              label="Meals logged"
              subValue="today"
            />
          </div>

          {/* Insights Section */}
          {(safeToday.insights?.length > 0) && (
            <InsightsSection insights={safeToday.insights} />
          )}

          {/* Tab Navigation */}
          <Card>
            <div className="flex border-b border-gray-100 overflow-x-auto">
              <TabButton active={activeTab === 'today'} onClick={() => setActiveTab('today')} icon={Flame} label="Nutrition" color="brand" />
              <TabButton active={activeTab === 'water'} onClick={() => setActiveTab('water')} icon={Droplets} label="Water" color="blue" />
              <TabButton active={activeTab === 'workouts'} onClick={() => setActiveTab('workouts')} icon={Dumbbell} label="Workouts" color="orange" />
              <TabButton active={activeTab === 'weekly'} onClick={() => setActiveTab('weekly')} icon={Calendar} label="Weekly" color="brand" />
              <TabButton active={activeTab === 'monthly'} onClick={() => setActiveTab('monthly')} icon={TrendingUp} label="Monthly" color="brand" />
            </div>
          </Card>

          {/* Today View */}
          {activeTab === 'today' && (
            <div className="space-y-6 animate-fade-in">
              {/* Macro Balance */}
              <MacroBalanceCard 
                macroBalance={safeToday.macro_balance}
                nutrition={nutritionData}
              />
              
              {/* Detailed Nutrition */}
              <Card>
                <CardBody>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="heading-3">Macros</h2>
                      <p className="text-muted">{nutritionData.meals_logged} meals logged</p>
                    </div>
                    <span className="text-muted">
                      {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <StatCard label="Calories" value={nutritionData.calories?.consumed || 0} target={nutritionData.calories?.target || 2000} unit="kcal" color="brand" />
                    <StatCard label="Protein" value={nutritionData.protein?.consumed || 0} target={nutritionData.protein?.target || 150} unit="g" color="blue" />
                    <StatCard label="Carbs" value={nutritionData.carbs?.consumed || 0} target={nutritionData.carbs?.target || 250} unit="g" color="amber" />
                    <StatCard label="Fat" value={nutritionData.fat?.consumed || 0} target={nutritionData.fat?.target || 65} unit="g" color="rose" />
                  </div>
                </CardBody>
              </Card>
              
              {/* Meal Distribution */}
              <MealDistributionCard mealBreakdown={safeToday.meal_breakdown} />
              
              {/* Workout calories offset */}
              {(safeToday.workouts?.calories_burned || 0) > 0 && (
                <Card>
                  <CardBody>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                          <Dumbbell className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">Exercise Offset</p>
                          <p className="text-sm text-gray-500">{safeToday.workouts?.count} workout(s) • {safeToday.workouts?.duration_minutes} mins</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">-{safeToday.workouts?.calories_burned}</p>
                        <p className="text-sm text-gray-500">calories burned</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>
          )}

          {/* Water Tracking View */}
          {activeTab === 'water' && (
            <div className="animate-fade-in">
              <WaterTracking />
            </div>
          )}

          {/* Workouts View */}
          {activeTab === 'workouts' && (
            <div className="animate-fade-in">
              <WorkoutLogging />
            </div>
          )}

          {/* Weekly View */}
          {activeTab === 'weekly' && (
            <div className="space-y-6 animate-fade-in">
              {/* Week-over-Week Trends */}
              <WeekTrendsCard 
                wowDelta={safeWeekly.wow_delta}
                streaks={safeWeekly.streaks}
                goalHitDays={safeWeekly.goal_hit_days}
                daysLogged={safeWeekly.days_logged}
              />
              
              {/* Weekly Insights */}
              {safeWeekly.insights?.length > 0 && (
                <InsightsSection insights={safeWeekly.insights} title="Weekly Insights" />
              )}

              {/* Weekly Chart */}
              <Card>
                <CardHeader>
                  <h3 className="heading-4">Daily Calories</h3>
                </CardHeader>
                <CardBody>
                  <div className="flex items-end justify-between gap-3 h-48">
                    {safeWeekly.days.map((day, index) => {
                      const percentage = Math.min((day.calories / safeWeekly.targets.calories) * 100, 120)
                      const isToday = index === 6
                      const isOverTarget = day.calories > safeWeekly.targets.calories * 1.1
                      const isOnTarget = day.calorie_goal_met
                      
                      return (
                        <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                          <div className="text-xs text-gray-400">{Math.round(day.calories)}</div>
                          <div className="w-full bg-gray-100 rounded-t relative" style={{ height: '120px' }}>
                            <div 
                              className={`absolute bottom-0 w-full rounded-t transition-all ${
                                isOverTarget 
                                  ? 'bg-red-400' 
                                  : isOnTarget 
                                    ? 'bg-green-500' 
                                    : day.calories > 0 
                                      ? 'bg-amber-400'
                                      : 'bg-gray-200'
                              } ${isToday ? 'ring-2 ring-brand-500 ring-offset-2' : ''}`}
                              style={{ height: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${isToday ? 'text-brand-600' : 'text-gray-500'}`}>
                            {day.day_name}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded" />
                      <span>On target</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-amber-400 rounded" />
                      <span>Under</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-400 rounded" />
                      <span>Over</span>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Weekly Averages */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <AverageCard label="Avg Calories" value={safeWeekly.averages.calories} target={safeWeekly.targets.calories} unit="kcal" />
                <AverageCard label="Avg Protein" value={safeWeekly.averages.protein} target={safeWeekly.targets.protein} unit="g" />
                <AverageCard label="Avg Carbs" value={safeWeekly.averages.carbs} target={safeWeekly.targets.carbs} unit="g" />
                <AverageCard label="Avg Fat" value={safeWeekly.averages.fat} target={safeWeekly.targets.fat} unit="g" />
              </div>

              {/* Top Foods This Week */}
              {safeWeekly.top_foods?.length > 0 && (
                <TopFoodsCard topFoods={safeWeekly.top_foods} />
              )}

              {/* Streaks & Consistency */}
              <StreaksCard streaks={safeWeekly.streaks} />
            </div>
          )}

          {/* Monthly View */}
          {activeTab === 'monthly' && loadingMonthly && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent mx-auto"></div>
                <p className="text-muted mt-3">Loading monthly data...</p>
              </div>
            </div>
          )}
          {activeTab === 'monthly' && !loadingMonthly && monthlyData && (
            <div className="space-y-6 animate-fade-in">
              <Card>
                <CardHeader>
                  <h3 className="heading-4">30-Day Activity</h3>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-7 gap-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-center text-xs text-gray-400 py-1">{day}</div>
                    ))}
                    {(monthlyData.days || []).map((day) => {
                      const percentage = day.calories / (monthlyData.targets?.calories || 2000)
                      const intensity = 
                        percentage === 0 ? 'bg-gray-100' :
                        percentage < 0.5 ? 'bg-brand-100' :
                        percentage < 0.8 ? 'bg-brand-200' :
                        percentage < 1 ? 'bg-brand-300' :
                        percentage <= 1.1 ? 'bg-green-400' :
                        'bg-red-300'
                      
                      return (
                        <div 
                          key={day.date}
                          className={`aspect-square rounded ${intensity} cursor-pointer hover:ring-2 hover:ring-brand-500 hover:ring-offset-1 transition-all`}
                          title={`${day.date}: ${Math.round(day.calories)} kcal`}
                        />
                      )
                    })}
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-500">
                    <span>Less</span>
                    <div className="w-3 h-3 bg-gray-100 rounded" />
                    <div className="w-3 h-3 bg-brand-100 rounded" />
                    <div className="w-3 h-3 bg-brand-200 rounded" />
                    <div className="w-3 h-3 bg-brand-300 rounded" />
                    <div className="w-3 h-3 bg-green-400 rounded" />
                    <span>Target</span>
                    <div className="w-3 h-3 bg-red-300 rounded" />
                    <span>Over</span>
                  </div>
                </CardBody>
              </Card>

              {/* Monthly Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardBody className="text-center">
                    <div className="text-3xl font-bold text-gray-900">{monthlyData.days_logged || 0}</div>
                    <div className="text-sm text-gray-500">Days Logged</div>
                    <div className="text-xs text-gray-400 mt-1">of 30 days</div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="text-center">
                    <div className="text-3xl font-bold text-gray-900">{Math.round(monthlyData.averages?.calories || 0)}</div>
                    <div className="text-sm text-gray-500">Avg Calories</div>
                    <div className="text-xs text-gray-400 mt-1">per day</div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="text-center">
                    <div className="text-3xl font-bold text-gray-900">{Math.round(monthlyData.averages?.protein || 0)}g</div>
                    <div className="text-sm text-gray-500">Avg Protein</div>
                    <div className="text-xs text-gray-400 mt-1">per day</div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="text-center">
                    <div className="text-3xl font-bold text-gray-900">{(monthlyData.totals?.meals || 0)}</div>
                    <div className="text-sm text-gray-500">Total Meals</div>
                    <div className="text-xs text-gray-400 mt-1">this month</div>
                  </CardBody>
                </Card>
              </div>
            </div>
          )}
        </div>
      </PageContent>
    </>
  )
}

// =============================================================================
// TAB BUTTON COMPONENT
// =============================================================================
function TabButton({ active, onClick, icon: Icon, label, color }) {
  const colorClasses = {
    brand: active ? 'border-brand-500 text-brand-600 bg-brand-50/50' : '',
    blue: active ? 'border-blue-500 text-blue-600 bg-blue-50/50' : '',
    orange: active ? 'border-orange-500 text-orange-600 bg-orange-50/50' : '',
  }
  
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
        active 
          ? colorClasses[color]
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

// =============================================================================
// COACHING STATUS CARD - Hero card with daily coaching feedback
// =============================================================================
function CoachingStatusCard({ statusLevel, statusMessage, statusEmoji, netCalories, calorieTarget, calorieStatus }) {
  const remaining = calorieTarget - netCalories
  const percentage = calorieTarget > 0 ? Math.round((netCalories / calorieTarget) * 100) : 0
  const isOver = remaining < 0
  
  // Determine actual status based on data
  const actualStatus = percentage > 115 ? 'critical' : percentage > 105 ? 'warning' : percentage >= 85 ? 'excellent' : 'ok'
  
  const statusConfig = {
    excellent: { 
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
      emoji: '🎯',
      label: 'On Target!'
    },
    ok: { 
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)',
      emoji: '📊',
      label: 'Tracking'
    },
    warning: { 
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 50%, #dc2626 100%)',
      emoji: '⚡',
      label: 'Slightly Over'
    },
    critical: { 
      gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)',
      emoji: '🔥',
      label: 'Over Target'
    }
  }
  
  const config = statusConfig[actualStatus]
  
  const getMessage = () => {
    if (actualStatus === 'excellent') return "You're crushing it! Perfect balance of intake and activity."
    if (actualStatus === 'warning') return `${Math.abs(remaining)} cal over — a short walk would balance this out!`
    if (actualStatus === 'critical') return `Consider lighter choices for your remaining meals today.`
    return "Keep logging to build a complete picture of your day!"
  }
  
  const progressPercent = Math.min(percentage, 100)
  const circumference = 2 * Math.PI * 52

  return (
    <div 
      style={{ 
        background: config.gradient,
        borderRadius: '16px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        overflow: 'hidden'
      }}
    >
      <div style={{ padding: '28px 32px', position: 'relative' }}>
        {/* Decorative element */}
        <div 
          style={{ 
            position: 'absolute',
            top: '-80px',
            right: '-40px',
            width: '200px',
            height: '200px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '50%',
            filter: 'blur(40px)'
          }}
        />
        
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '40px' }}>
          {/* Left content */}
          <div style={{ flex: 1 }}>
            {/* Status badge */}
            <div 
              style={{ 
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '50px',
                padding: '8px 16px 8px 12px',
                marginBottom: '16px'
              }}
            >
              <span style={{ fontSize: '28px', lineHeight: 1 }}>{config.emoji}</span>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '2px' }}>Status</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'white', lineHeight: 1.1 }}>{config.label}</div>
              </div>
            </div>
            
            {/* Message */}
            <p style={{ 
              color: 'white', 
              fontSize: '22px', 
              fontWeight: 500, 
              lineHeight: 1.4, 
              margin: '0 0 28px 0',
              maxWidth: '420px'
            }}>
              {getMessage()}
            </p>
            
            {/* Stats row */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div 
                style={{ 
                  background: 'rgba(255,255,255,0.18)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  minWidth: '130px'
                }}
              >
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Consumed</div>
                <div style={{ color: 'white', fontSize: '32px', fontWeight: 700, lineHeight: 1.1 }}>{Math.round(netCalories).toLocaleString()}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '4px' }}>net kcal</div>
              </div>
              
              <div 
                style={{ 
                  background: isOver ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.18)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  minWidth: '130px'
                }}
              >
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  {isOver ? 'Over by' : 'Remaining'}
                </div>
                <div style={{ color: 'white', fontSize: '32px', fontWeight: 700, lineHeight: 1.1 }}>
                  {isOver ? '+' : ''}{Math.abs(Math.round(remaining)).toLocaleString()}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '4px' }}>kcal</div>
              </div>
              
              <div 
                style={{ 
                  background: 'rgba(255,255,255,0.18)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  minWidth: '110px'
                }}
              >
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Target</div>
                <div style={{ color: 'white', fontSize: '32px', fontWeight: 700, lineHeight: 1.1 }}>{Math.round(calorieTarget).toLocaleString()}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '4px' }}>kcal/day</div>
              </div>
            </div>
          </div>
          
          {/* Right - Circular progress (hidden on mobile) */}
          <div className="hidden sm:block" style={{ flexShrink: 0 }}>
            <div style={{ position: 'relative', width: '140px', height: '140px' }}>
              <svg width="140" height="140" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background circle */}
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="10"
                  fill="none"
                />
                {/* Progress circle */}
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  stroke="white"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - (progressPercent / 100) * circumference}
                  style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                />
              </svg>
              {/* Center content */}
              <div style={{ 
                position: 'absolute', 
                inset: 0, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <span style={{ color: 'white', fontSize: '34px', fontWeight: 700, lineHeight: 1 }}>{percentage}%</span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: 500, marginTop: '4px' }}>of goal</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// NET CALORIES CARD - Detailed calorie breakdown
// =============================================================================
function NetCaloriesCard({ caloriesIn, caloriesOut, netCalories, target, status }) {
  const statusColors = {
    under: 'text-amber-600',
    on_track: 'text-green-600',
    over: 'text-red-600'
  }
  
  return (
    <Card hover>
      <CardBody className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
            <Flame className="w-5 h-5 text-orange-500" />
          </div>
          <div className={`text-xs font-medium px-2 py-1 rounded-full ${
            status === 'on_track' ? 'bg-green-100 text-green-700' :
            status === 'over' ? 'bg-red-100 text-red-700' :
            'bg-amber-100 text-amber-700'
          }`}>
            {status === 'on_track' ? '✓ On Track' : status === 'over' ? '↑ Over' : '↓ Under'}
          </div>
        </div>
        <div className={`text-2xl font-bold ${statusColors[status] || 'text-gray-900'}`}>
          {Math.round(netCalories)}
        </div>
        <div className="text-xs text-gray-500 mb-2">Net Calories</div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>+{caloriesIn}</span>
          <span>−{caloriesOut}</span>
        </div>
      </CardBody>
    </Card>
  )
}

// =============================================================================
// QUICK STAT CARD - Simple metric display
// =============================================================================
function QuickStatCard({ icon: Icon, iconBg, iconColor, value, label, subValue }) {
  return (
    <Card hover>
      <CardBody className="text-center p-4">
        <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center mx-auto mb-2`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
        {subValue && <div className="text-xs text-gray-400 mt-1">{subValue}</div>}
      </CardBody>
    </Card>
  )
}

// =============================================================================
// INSIGHTS SECTION - Actionable coaching tips
// =============================================================================
function InsightsSection({ insights, title = "Today's Insights" }) {
  const typeConfig = {
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100' },
    success: { bg: 'bg-green-50', border: 'border-green-200', iconBg: 'bg-green-100' },
    tip: { bg: 'bg-blue-50', border: 'border-blue-200', iconBg: 'bg-blue-100' },
    info: { bg: 'bg-gray-50', border: 'border-gray-200', iconBg: 'bg-gray-100' }
  }
  
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-500" />
        {title}
      </h3>
      <div className="grid gap-3 md:grid-cols-3">
        {insights.map((insight, index) => {
          const config = typeConfig[insight.type] || typeConfig.info
          
          return (
            <Card key={index} className={`${config.bg} ${config.border} border`}>
              <CardBody className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 ${config.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <span className="text-lg">{insight.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm">{insight.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{insight.message}</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// MACRO BALANCE CARD - Visual macro distribution
// =============================================================================
function MacroBalanceCard({ macroBalance, nutrition }) {
  const macros = [
    { name: 'Protein', percent: macroBalance?.protein_percent || 0, color: 'bg-blue-500', ideal: '25-35%' },
    { name: 'Carbs', percent: macroBalance?.carbs_percent || 0, color: 'bg-amber-500', ideal: '45-55%' },
    { name: 'Fat', percent: macroBalance?.fat_percent || 0, color: 'bg-rose-500', ideal: '20-35%' },
  ]
  
  const totalCal = (nutrition.calories?.consumed || 0)
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="heading-4">Macro Balance</h3>
          <span className="text-sm text-gray-500">{totalCal} kcal total</span>
        </div>
      </CardHeader>
      <CardBody>
        {/* Stacked bar visualization */}
        <div className="h-4 rounded-full overflow-hidden flex bg-gray-100 mb-4">
          {macros.map(macro => (
            <div
              key={macro.name}
              className={`${macro.color} transition-all duration-500`}
              style={{ width: `${macro.percent}%` }}
            />
          ))}
        </div>
        
        {/* Legend */}
        <div className="grid grid-cols-3 gap-4">
          {macros.map(macro => (
            <div key={macro.name} className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className={`w-3 h-3 rounded ${macro.color}`} />
                <span className="text-sm font-medium text-gray-700">{macro.name}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{Math.round(macro.percent)}%</div>
              <div className="text-xs text-gray-400">Ideal: {macro.ideal}</div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

// =============================================================================
// MEAL DISTRIBUTION CARD - Calories by meal type
// =============================================================================
function MealDistributionCard({ mealBreakdown }) {
  const meals = [
    { name: 'Breakfast', value: mealBreakdown?.breakfast || 0, emoji: '🌅', color: 'bg-orange-400' },
    { name: 'Lunch', value: mealBreakdown?.lunch || 0, emoji: '☀️', color: 'bg-yellow-400' },
    { name: 'Dinner', value: mealBreakdown?.dinner || 0, emoji: '🌙', color: 'bg-indigo-400' },
    { name: 'Snacks', value: mealBreakdown?.snack || 0, emoji: '🍎', color: 'bg-green-400' },
  ]
  
  const total = meals.reduce((sum, m) => sum + m.value, 0) || 1
  
  return (
    <Card>
      <CardHeader>
        <h3 className="heading-4">Meal Distribution</h3>
      </CardHeader>
      <CardBody>
        <div className="space-y-3">
          {meals.map(meal => (
            <div key={meal.name} className="flex items-center gap-3">
              <span className="text-xl w-8">{meal.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{meal.name}</span>
                  <span className="text-sm text-gray-500">{meal.value} kcal</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${meal.color} rounded-full transition-all duration-500`}
                    style={{ width: `${(meal.value / total) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-sm text-gray-400 w-12 text-right">
                {Math.round((meal.value / total) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

// =============================================================================
// WEEK TRENDS CARD - Week-over-week comparisons
// =============================================================================
function WeekTrendsCard({ wowDelta, streaks, goalHitDays, daysLogged }) {
  const TrendIcon = ({ direction }) => {
    if (direction === 'up') return <ArrowUpRight className="w-4 h-4 text-green-500" />
    if (direction === 'down') return <ArrowDownRight className="w-4 h-4 text-red-500" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }
  
  return (
    <Card>
      <CardHeader>
        <h3 className="heading-4">Week-over-Week Trends</h3>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendIcon direction={wowDelta?.direction_calories} />
              <span className={`text-sm font-semibold ${
                wowDelta?.direction_calories === 'up' ? 'text-green-600' :
                wowDelta?.direction_calories === 'down' ? 'text-red-600' :
                'text-gray-500'
              }`}>
                {wowDelta?.calories > 0 ? '+' : ''}{Math.round(wowDelta?.calories || 0)}%
              </span>
            </div>
            <div className="text-xs text-gray-500">Calories vs last week</div>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendIcon direction={wowDelta?.direction_protein} />
              <span className={`text-sm font-semibold ${
                wowDelta?.direction_protein === 'up' ? 'text-green-600' :
                wowDelta?.direction_protein === 'down' ? 'text-red-600' :
                'text-gray-500'
              }`}>
                {wowDelta?.protein > 0 ? '+' : ''}{Math.round(wowDelta?.protein || 0)}%
              </span>
            </div>
            <div className="text-xs text-gray-500">Protein vs last week</div>
          </div>
          
          <div className="p-4 bg-green-50 rounded-xl text-center">
            <div className="text-2xl font-bold text-green-600">{goalHitDays}/7</div>
            <div className="text-xs text-gray-500">Goal hit days</div>
          </div>
          
          <div className="p-4 bg-brand-50 rounded-xl text-center">
            <div className="text-2xl font-bold text-brand-600">{daysLogged}/7</div>
            <div className="text-xs text-gray-500">Days logged</div>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

// =============================================================================
// TOP FOODS CARD - Most frequently logged foods
// =============================================================================
function TopFoodsCard({ topFoods }) {
  const getRankStyle = (index) => {
    if (index === 0) return { background: '#fbbf24', color: 'white' } // Gold
    if (index === 1) return { background: '#9ca3af', color: 'white' } // Silver
    if (index === 2) return { background: '#cd7f32', color: 'white' } // Bronze
    return { background: '#e5e7eb', color: '#6b7280' }
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="heading-4">Top Foods This Week</h3>
      </CardHeader>
      <CardBody>
        <div className="space-y-3">
          {topFoods.map((food, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div 
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
                  ...getRankStyle(index)
                }}
              >
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-800">{food.name}</div>
                <div className="text-xs text-gray-500">Logged {food.frequency}x this week</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-800">{food.total_calories}</div>
                <div className="text-xs text-gray-500">total kcal</div>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

// =============================================================================
// STREAKS CARD - Consistency tracking
// =============================================================================
function StreaksCard({ streaks }) {
  const streakItems = [
    { label: 'Current Streak', value: streaks?.current_streak || 0, unit: 'days', icon: '🔥', color: 'bg-orange-100' },
    { label: 'Best Streak', value: streaks?.longest_streak || 0, unit: 'days', icon: '🏆', color: 'bg-amber-100' },
    { label: 'Water Streak', value: streaks?.water_goal_met_streak || 0, unit: 'days', icon: '💧', color: 'bg-blue-100' },
    { label: 'Workout Streak', value: streaks?.workout_streak || 0, unit: 'days', icon: '💪', color: 'bg-green-100' },
  ]
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          <h3 className="heading-4">Consistency & Streaks</h3>
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {streakItems.map((item, index) => (
            <div key={index} className={`${item.color} rounded-xl p-4 text-center`}>
              <span className="text-2xl">{item.icon}</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">{item.value}</div>
              <div className="text-xs text-gray-600">{item.unit}</div>
              <div className="text-xs text-gray-500 mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

// =============================================================================
// STAT CARD - Macro progress display
// =============================================================================
function StatCard({ label, value, target, unit, color }) {
  const percentage = Math.min((value / target) * 100, 100)
  const colorClasses = {
    brand: 'bg-brand-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  }
  
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900">
          {Math.round(value)}
        </span>
        <span className="text-sm text-gray-400">
          / {target} {unit}
        </span>
      </div>

      <div className="progress-bar">
        <div 
          className={`progress-fill ${colorClasses[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

// =============================================================================
// AVERAGE CARD - Weekly average display
// =============================================================================
function AverageCard({ label, value, target, unit }) {
  const percentage = Math.round((value / target) * 100)
  
  return (
    <Card>
      <CardBody className="text-center">
        <div className="text-sm text-gray-500 mb-1">{label}</div>
        <div className="text-2xl font-bold text-gray-900">
          {Math.round(value)}<span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
        </div>
        <div className="mt-2">
          <span className={`badge ${percentage >= 90 ? 'badge-green' : percentage >= 70 ? 'badge-yellow' : 'badge-gray'}`}>
            {percentage}% of goal
          </span>
        </div>
      </CardBody>
    </Card>
  )
}
