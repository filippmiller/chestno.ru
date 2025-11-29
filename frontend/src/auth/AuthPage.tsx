/**
 * Authentication Page
 * 
 * Combined login and registration page with tabs.
 * Supports email+password and OAuth (Google, Yandex).
 */
import { useState, type FormEvent, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { PasswordInput } from './components/PasswordInput'
import { SocialLoginButtons } from './components/SocialLoginButtons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'

type AuthMode = 'login' | 'register'

export function AuthPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { loginWithEmail, signupWithEmail, loginWithGoogle, loginWithYandex, status } = useAuth()

    const [mode, setMode] = useState<AuthMode>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [fullName, setFullName] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Redirect after successful auth
    const from = (location.state as any)?.from?.pathname || '/dashboard'

    // Redirect if already authenticated
    useEffect(() => {
        if (status === 'authenticated') {
            navigate(from, { replace: true })
        }
    }, [status, navigate, from])

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccessMessage(null)
        setIsSubmitting(true)

        try {
            if (mode === 'login') {
                await loginWithEmail(email, password)
                navigate(from, { replace: true })
            } else {
                await signupWithEmail(email, password, fullName || undefined)

                // Check if user needs to confirm email
                if (status === 'unauthenticated') {
                    setSuccessMessage('Регистрация успешна! Проверьте почту для подтверждения.')
                    setEmail('')
                    setPassword('')
                    setFullName('')
                } else {
                    navigate(from, { replace: true })
                }
            }
        } catch (err: any) {
            console.error('Auth error:', err)

            // Parse Supabase error messages
            if (err.message?.includes('Invalid login credentials')) {
                setError('Неверный e-mail или пароль')
            } else if (err.message?.includes('User already registered')) {
                setError('Этот e-mail уже зарегистрирован')
            } else if (err.message?.includes('Password should be at least')) {
                setError('Пароль слишком короткий (минимум 6 символов)')
            } else if (err.message?.includes('Invalid email')) {
                setError('Неверный формат e-mail')
            } else if (err.message?.includes('Network')) {
                setError('Не удалось подключиться. Проверьте интернет.')
            } else {
                setError('Произошла ошибка. Попробуйте позже.')
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleGoogleLogin = async () => {
        try {
            setError(null)
            await loginWithGoogle()
        } catch (err: any) {
            setError('Не удалось войти через Google')
        }
    }

    const handleYandexLogin = async () => {
        try {
            setError(null)
            await loginWithYandex()
        } catch (err: any) {
            setError('Не удалось войти через Яндекс')
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center px-4 py-12 bg-gradient-to-br from-blue-50 to-indigo-100">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl text-center">Работаем Честно!</CardTitle>
                    <CardDescription className="text-center">
                        Вход или регистрация в системе
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="login" onValueChange={(v) => setMode(v as AuthMode)}>
                        <TabsList className="grid w-full grid-cols-2 mb-6">
                            <TabsTrigger value="login">Вход</TabsTrigger>
                            <TabsTrigger value="register">Регистрация</TabsTrigger>
                        </TabsList>

                        <TabsContent value="login">
                            <div className="space-y-4">
                                <SocialLoginButtons
                                    onGoogleClick={handleGoogleLogin}
                                    onYandexClick={handleYandexLogin}
                                    disabled={isSubmitting}
                                />

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-background px-2 text-muted-foreground">или</span>
                                    </div>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {error && (
                                        <Alert variant="destructive">
                                            <AlertDescription>{error}</AlertDescription>
                                        </Alert>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="email">E-mail</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="you@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            disabled={isSubmitting}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password">Пароль</Label>
                                        <PasswordInput
                                            value={password}
                                            onChange={setPassword}
                                            required
                                            disabled={isSubmitting}
                                        />
                                    </div>

                                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                                        {isSubmitting ? 'Входим...' : 'Войти'}
                                    </Button>

                                    <div className="text-center">
                                        <Button
                                            type="button"
                                            variant="link"
                                            className="text-sm text-muted-foreground"
                                            onClick={() => navigate('/auth/forgot')}
                                        >
                                            Забыли пароль?
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </TabsContent>

                        <TabsContent value="register">
                            <div className="space-y-4">
                                <SocialLoginButtons
                                    onGoogleClick={handleGoogleLogin}
                                    onYandexClick={handleYandexLogin}
                                    disabled={isSubmitting}
                                />

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-background px-2 text-muted-foreground">или</span>
                                    </div>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {error && (
                                        <Alert variant="destructive">
                                            <AlertDescription>{error}</AlertDescription>
                                        </Alert>
                                    )}

                                    {successMessage && (
                                        <Alert>
                                            <AlertDescription>{successMessage}</AlertDescription>
                                        </Alert>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="fullName">Полное имя (необязательно)</Label>
                                        <Input
                                            id="fullName"
                                            type="text"
                                            placeholder="Иван Иванов"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            disabled={isSubmitting}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="email-register">E-mail</Label>
                                        <Input
                                            id="email-register"
                                            type="email"
                                            placeholder="you@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            disabled={isSubmitting}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password-register">Пароль</Label>
                                        <PasswordInput
                                            value={password}
                                            onChange={setPassword}
                                            required
                                            disabled={isSubmitting}
                                            name="password-register"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Минимум 6 символов
                                        </p>
                                    </div>

                                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                                        {isSubmitting ? 'Регистрация...' : 'Зарегистрироваться'}
                                    </Button>
                                </form>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}
