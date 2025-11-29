/**
 * Reset Password Page
 * 
 * Set new password after clicking the reset link in email.
 */
import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { PasswordInput } from './components/PasswordInput'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function ResetPasswordPage() {
    const navigate = useNavigate()
    const supabase = getSupabaseClient()

    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isValidSession, setIsValidSession] = useState(false)

    useEffect(() => {
        // Check if we have a valid recovery session
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                setIsValidSession(true)
            } else {
                setError('Ссылка недействительна или истекла. Запросите новую.')
            }
        }
        checkSession()
    }, [])

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError(null)

        if (newPassword !== confirmPassword) {
            setError('Пароли не совпадают')
            return
        }

        if (newPassword.length < 6) {
            setError('Пароль должен содержать минимум 6 символов')
            return
        }

        setIsSubmitting(true)

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            })

            if (updateError) throw updateError

            setSuccess(true)

            // Auto-redirect after 2 seconds
            setTimeout(() => navigate('/dashboard'), 2000)
        } catch (err: any) {
            console.error('Reset password error:', err)
            setError('Не удалось изменить пароль. Попробуйте позже.')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isValidSession && error) {
        return (
            <div className="flex min-h-screen items-center justify-center px-4 py-12 bg-gradient-to-br from-blue-50 to-indigo-100">
                <Card className="w-full max-w-md shadow-lg">
                    <CardHeader>
                        <CardTitle>Ошибка</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                        <Button onClick={() => navigate('/auth/forgot')} className="w-full">
                            Запросить новую ссылку
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (success) {
        return (
            <div className="flex min-h-screen items-center justify-center px-4 py-12 bg-gradient-to-br from-blue-50 to-indigo-100">
                <Card className="w-full max-w-md shadow-lg">
                    <CardHeader>
                        <CardTitle>Пароль успешно изменён!</CardTitle>
                        <CardDescription>
                            Вы будете перенаправлены в личный кабинет...
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => navigate('/dashboard')} className="w-full">
                            Перейти в личный кабинет
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
                    <CardTitle>Установите новый пароль</CardTitle>
                    <CardDescription>
                        Введите новый пароль для вашего аккаунта
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
                            <Label htmlFor="newPassword">Новый пароль</Label>
                            <PasswordInput
                                value={newPassword}
                                onChange={setNewPassword}
                                required
                                disabled={isSubmitting}
                                name="newPassword"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                            <PasswordInput
                                value={confirmPassword}
                                onChange={setConfirmPassword}
                                required
                                disabled={isSubmitting}
                                name="confirmPassword"
                            />
                        </div>

                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? 'Изменение...' : 'Изменить пароль'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
