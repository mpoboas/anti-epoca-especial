import React, { useState } from 'react';
import { login, register } from '../lib/pocketbase';
import { Loader2, Mail, Lock, User, ArrowRight } from 'lucide-react';

interface AuthModalProps {
    onSuccess: () => void;
    onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onClose }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (isLogin) {
                await login(email, password);
            } else {
                await register(email, password, name);
            }
            onSuccess();
        } catch (err: any) {
            console.error(err);
            if (err.data?.data?.email?.message) {
                setError(err.data.data.email.message);
            } else if (err.data?.data?.password?.message) {
                setError(err.data.data.password.message);
            } else if (err.message) {
                setError(err.message);
            } else {
                setError(isLogin ? 'Credenciais inválidas' : 'Erro ao criar conta');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in border dark:border-slate-800">
                {/* Header */}
                <div className="bg-dark-gradient p-7 text-white border-b border-blue-950">
                    <h2 className="text-2xl font-bold tracking-tight">
                        {isLogin ? 'Bem-vindo de volta!' : 'Criar Conta'}
                    </h2>
                    <p className="text-blue-200/60 mt-2 text-sm">
                        {isLogin
                            ? 'Entra para aceder às tuas '
                            : 'Regista-te para guardar o teu '}
                        <span className="text-lime-400 font-semibold text-glow">
                            {isLogin ? 'estatísticas' : 'progresso'}
                        </span>
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {!isLogin && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nome</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="O teu nome"
                                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-slate-600"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="email@exemplo.com"
                                required
                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-slate-600"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={8}
                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-slate-600"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-dark-gradient text-white py-3.5 rounded-xl font-bold hover:shadow-[0_0_20px_rgba(30,27,75,0.4)] transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-blue-900/50"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <span className={isLogin ? "" : "text-white"}>{isLogin ? 'Entrar' : 'Criar Conta'}</span>
                                <ArrowRight className="w-5 h-5 text-lime-400" />
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="px-6 pb-6">
                    <div className="text-center text-sm text-gray-500 dark:text-slate-400">
                        {isLogin ? 'Não tens conta?' : 'Já tens conta?'}{' '}
                        <button
                            type="button"
                            onClick={() => { setIsLogin(!isLogin); setError(null); }}
                            className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                        >
                            {isLogin ? 'Criar conta' : 'Entrar'}
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full mt-4 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 text-sm py-2 transition-colors"
                    >
                        Continuar sem conta
                    </button>
                </div>
            </div>
        </div>
    );
};
