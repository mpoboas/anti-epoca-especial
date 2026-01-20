import React, { useState, useRef } from 'react';
import { Course, Answer, QuestionInput, getCourses, createQuestions } from '../lib/pocketbase';
import {
    X, Upload, AlertTriangle, CheckCircle, Loader2, ChevronLeft,
    Library, Bot, Gamepad2, FileJson, Eye, Database, Tag
} from 'lucide-react';

interface AdminPanelProps {
    onClose: () => void;
    courses: Course[];
}

type SourceType = 'previous' | 'ai' | 'kahoots';

interface ParsedQuestion {
    text: string;
    answers: { text: string; value: string }[];
}

interface ValidationResult {
    valid: boolean;
    questions: ParsedQuestion[];
    errors: string[];
    detectedTheme?: string;
}

const SOURCE_CONFIG = {
    previous: { label: 'Exames Anteriores', icon: Library, color: 'indigo' },
    ai: { label: 'Gerados por IA', icon: Bot, color: 'fuchsia' },
    kahoots: { label: 'Kahoots', icon: Gamepad2, color: 'teal' },
};

const VALID_VALUES = ['++', '+', '-', '--'];

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose, courses }) => {
    const [selectedCourse, setSelectedCourse] = useState<string>('');
    const [selectedSource, setSelectedSource] = useState<SourceType>('previous');
    const [file, setFile] = useState<File | null>(null);
    const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [isValidated, setIsValidated] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<{ created: number; errors: string[] } | null>(null);
    const [detectedTheme, setDetectedTheme] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateJSON = (content: string): ValidationResult => {
        const errors: string[] = [];
        let questions: ParsedQuestion[] = [];
        let detectedTheme: string | undefined;

        try {
            const data = JSON.parse(content);

            // Check for theme in kahoot_info
            if (data.kahoot_info?.theme) {
                detectedTheme = data.kahoot_info.theme;
            }

            // Check for questions array (can be at root or inside 'questions' key)
            const questionsArray = Array.isArray(data) ? data : data.questions;

            if (!Array.isArray(questionsArray)) {
                errors.push('O ficheiro deve conter um array "questions" ou ser um array de perguntas.');
                return { valid: false, questions: [], errors, detectedTheme };
            }

            if (questionsArray.length === 0) {
                errors.push('O array de perguntas está vazio.');
                return { valid: false, questions: [], errors, detectedTheme };
            }

            questionsArray.forEach((q: any, index: number) => {
                const qNum = index + 1;

                // Check text field
                if (!q.text || typeof q.text !== 'string' || q.text.trim() === '') {
                    errors.push(`Pergunta ${qNum}: Campo "text" em falta ou vazio.`);
                }

                // Check answers array
                if (!Array.isArray(q.answers)) {
                    errors.push(`Pergunta ${qNum}: Campo "answers" deve ser um array.`);
                } else if (q.answers.length < 2) {
                    errors.push(`Pergunta ${qNum}: Deve ter pelo menos 2 respostas.`);
                } else {
                    let hasCorrect = false;
                    q.answers.forEach((a: any, aIndex: number) => {
                        if (!a.text || typeof a.text !== 'string' || a.text.trim() === '') {
                            errors.push(`Pergunta ${qNum}, Resposta ${aIndex + 1}: Campo "text" em falta ou vazio.`);
                        }
                        if (!a.value || !VALID_VALUES.includes(a.value)) {
                            errors.push(`Pergunta ${qNum}, Resposta ${aIndex + 1}: Campo "value" deve ser um de: ++, +, -, --`);
                        }
                        if (a.value === '++') hasCorrect = true;
                    });
                    if (!hasCorrect) {
                        errors.push(`Pergunta ${qNum}: Nenhuma resposta marcada como correta (++).`);
                    }
                }
            });

            if (errors.length === 0) {
                questions = questionsArray.map((q: any) => ({
                    text: q.text,
                    answers: q.answers.map((a: any) => ({ text: a.text, value: a.value })),
                }));
            }

            return { valid: errors.length === 0, questions, errors, detectedTheme };
        } catch (e: any) {
            errors.push(`Erro ao ler JSON: ${e.message}`);
            return { valid: false, questions: [], errors };
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setIsValidated(false);
        setParsedQuestions([]);
        setValidationErrors([]);
        setUploadResult(null);
        setDetectedTheme(null);

        const content = await selectedFile.text();
        const result = validateJSON(content);

        setParsedQuestions(result.questions);
        setValidationErrors(result.errors);
        setDetectedTheme(result.detectedTheme || null);
        setIsValidated(result.valid);
    };

    const handleUpload = async () => {
        if (!selectedCourse || !isValidated || parsedQuestions.length === 0) return;

        setUploading(true);
        setUploadResult(null);

        try {
            const questionsToCreate: QuestionInput[] = parsedQuestions.map(q => ({
                text: q.text,
                answers: q.answers as Answer[],
                ...(detectedTheme && { theme: detectedTheme }),
            }));

            const result = await createQuestions(selectedCourse, selectedSource, questionsToCreate);
            setUploadResult(result);

            if (result.errors.length === 0) {
                // Reset form on success
                setFile(null);
                setParsedQuestions([]);
                setIsValidated(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        } catch (e: any) {
            setUploadResult({ created: 0, errors: [e.message || 'Erro desconhecido'] });
        } finally {
            setUploading(false);
        }
    };

    const getValueBadge = (value: string) => {
        switch (value) {
            case '++': return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400';
            case '+': return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400';
            case '-': return 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400';
            case '--': return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400';
            default: return 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-400';
        }
    };

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-300 animate-fade-in custom-scrollbar">
            <div className="max-w-4xl mx-auto p-4 md:p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={onClose}
                        className="flex items-center gap-1 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span>Voltar</span>
                    </button>
                    <h1 className="text-xl font-bold text-gray-800 dark:text-white">Painel de Administração</h1>
                    <div className="w-20"></div>
                </div>

                {/* Upload Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        Importar Perguntas
                    </h2>

                    {/* Course Selection */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                            Curso
                        </label>
                        <select
                            value={selectedCourse}
                            onChange={(e) => setSelectedCourse(e.target.value)}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        >
                            <option value="">Selecionar curso...</option>
                            {courses.map(course => (
                                <option key={course.id} value={course.id}>{course.title}</option>
                            ))}
                        </select>
                    </div>

                    {/* Source Selection */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                            Tipo de Perguntas
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {(Object.keys(SOURCE_CONFIG) as SourceType[]).map(source => {
                                const config = SOURCE_CONFIG[source];
                                const Icon = config.icon;
                                const isSelected = selectedSource === source;

                                return (
                                    <button
                                        key={source}
                                        onClick={() => setSelectedSource(source)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all border-2 ${isSelected
                                            ? config.color === 'indigo'
                                                ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-500 text-indigo-700 dark:text-indigo-400'
                                                : config.color === 'fuchsia'
                                                    ? 'bg-fuchsia-100 dark:bg-fuchsia-900/40 border-fuchsia-500 text-fuchsia-700 dark:text-fuchsia-400'
                                                    : 'bg-teal-100 dark:bg-teal-900/40 border-teal-500 text-teal-700 dark:text-teal-400'
                                            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-600'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {config.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* File Upload */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                            Ficheiro JSON
                        </label>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${file
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600 bg-gray-50 dark:bg-slate-800/50'
                                }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            {file ? (
                                <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400">
                                    <FileJson className="w-6 h-6" />
                                    <span className="font-medium">{file.name}</span>
                                </div>
                            ) : (
                                <div className="text-gray-500 dark:text-slate-400">
                                    <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="font-medium">Clica para selecionar ficheiro</p>
                                    <p className="text-sm opacity-75">ou arrasta para aqui</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Validation Errors */}
                    {validationErrors.length > 0 && (
                        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium mb-2">
                                <AlertTriangle className="w-5 h-5" />
                                Erros de Validação ({validationErrors.length})
                            </div>
                            <ul className="text-sm text-red-600 dark:text-red-400 space-y-1 max-h-40 overflow-y-auto">
                                {validationErrors.map((error, i) => (
                                    <li key={i}>• {error}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Success Validation */}
                    {isValidated && parsedQuestions.length > 0 && (
                        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                                <CheckCircle className="w-5 h-5" />
                                {parsedQuestions.length} perguntas válidas prontas para importar
                            </div>
                            {detectedTheme && (
                                <div className="flex items-center gap-2 mt-2 text-sm text-green-600 dark:text-green-500">
                                    <Tag className="w-4 h-4" />
                                    <span>Tema detetado: <strong>{detectedTheme}</strong></span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Upload Result */}
                    {uploadResult && (
                        <div className={`mb-4 p-4 rounded-xl border ${uploadResult.errors.length === 0
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                            }`}>
                            <div className="flex items-center gap-2 font-medium mb-2">
                                {uploadResult.errors.length === 0 ? (
                                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                ) : (
                                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                                )}
                                <span className={uploadResult.errors.length === 0 ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'}>
                                    {uploadResult.created} perguntas adicionadas
                                </span>
                            </div>
                            {uploadResult.errors.length > 0 && (
                                <ul className="text-sm text-yellow-600 dark:text-yellow-400 space-y-1">
                                    {uploadResult.errors.map((error, i) => (
                                        <li key={i}>• {error}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        onClick={handleUpload}
                        disabled={!selectedCourse || !isValidated || parsedQuestions.length === 0 || uploading}
                        className="w-full flex items-center justify-center gap-2 bg-dark-gradient text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-blue-900/50"
                    >
                        {uploading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Database className="w-5 h-5 text-lime-400" />
                                Adicionar à Base de Dados
                            </>
                        )}
                    </button>
                </div>

                {/* Preview Card */}
                {isValidated && parsedQuestions.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                            <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            Pré-visualização ({parsedQuestions.length} perguntas)
                        </h2>

                        <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                            {parsedQuestions.map((q, qIndex) => (
                                <div key={qIndex} className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700">
                                    <div className="flex items-start gap-3">
                                        <span className="shrink-0 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                                            {qIndex + 1}
                                        </span>
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-800 dark:text-white mb-3">{q.text}</p>
                                            <div className="space-y-2">
                                                {q.answers.map((a, aIndex) => (
                                                    <div key={aIndex} className="flex items-center justify-between text-sm">
                                                        <span className="text-gray-600 dark:text-slate-400">{a.text}</span>
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getValueBadge(a.value)}`}>
                                                            {a.value}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
