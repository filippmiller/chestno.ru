/**
 * Forgot Password Page
 * 
 * Request password reset email.
 */
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthV2 } from './AuthProviderV2'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft } from 'lucide-react'

export function ForgotPasswordPage() {
    const navigate = useNavigate()
    const { resetPassword } = useAuthV2()

    const [email, setEmail] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsSubmitting(true)

        try {
            await resetPassword(email)
            setSuccess(true)
        } catch (err: any) {
            console.error('Reset password error:', err)
            setError('Произошла ошибка. Попробуйте позже.')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (success) {
        return (
            <div className="flex min-h-screen items-center justify-center px-4 py-12 bg-gradient-to-br from-blue-50 to-indigo-100">
                <Card className="w-full max-w-md shadow-lg">
                    <CardHeader>
                        <CardTitle>Проверьте почту</CardTitle>
                        <CardDescription>
                            Мы отправили письмо со ссылкой для восстановления пароля, если такой e-mail зарегистрирован в системе.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => navigate('/auth')} className="w-full">
                            Вернуться к входу
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen items-center justify-center px-4 py-12 bg-gradient-to-br from-blue-50 to-indigo-100">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate('/auth')}
                            className="p-0 h-auto"
                        >
                            <ArrowLeft className="h-4 w-4 mr-1" />
                            Назад
                        </Button>
                    </div>
                    <CardTitle>Восстановление пароля</CardTitle>
                    <CardDescription>
                        Введите ваш e-mail, и мы отправим ссылку для сброса пароля
                    </CardDescription>
                </CardHeader>
                <CardContent>
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

                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? 'Отправка...' : 'Отправить ссылку для восстановления'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
