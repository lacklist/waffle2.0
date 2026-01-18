import { useState, useEffect } from 'react';
import { ChevronRight, Lock, Globe, Search, Eye, Trash2, Loader } from 'lucide-react';
import { ToastContainer } from './components/ToastContainer';
import { ConnectionStatus } from './components/ConnectionStatus';
import { ValidationErrorDisplay } from './components/ValidationError';
import { useToast } from './context/ToastContext';
import { DatabaseService } from './services/db';
import { TelegramService } from './services/telegram';
import { FileUploadService } from './services/FileUploadService';
import { supabase } from './services/supabaseClient';
import { DirectoryValidator, ValidationError } from './utils/validation';
import { User, Directory, Template, StoredFile } from './types';

function App() {
    const { addToast } = useToast();
    const [currentPage, setCurrentPage] = useState<'menu' | 'create' | 'browse' | 'status' | 'files'>('menu');
    const [step, setStep] = useState(1);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [myDirectories, setMyDirectories] = useState<Directory[]>([]);
    const [myFiles, setMyFiles] = useState<StoredFile[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [dirName, setDirName] = useState('');
    const [dirType, setDirType] = useState<'private' | 'public'>('private');
    const [mode, setMode] = useState<'template' | 'manual'>('template');
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [storageType, setStorageType] = useState('document');
    const [searchQuery, setSearchQuery] = useState('');
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [isFilesLoading, setIsFilesLoading] = useState(false);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);

    useEffect(() => {
        (async () => {
            try {
                TelegramService.initTelegramApp();
                TelegramService.logDebugInfo();

                const telegramUser = TelegramService.getTelegramUser();
                const profile = await DatabaseService.ensureUserProfile(telegramUser);
                setUser(profile);

                const loadedTemplates = await DatabaseService.getTemplates();
                setTemplates(loadedTemplates);
            } catch (error) {
                console.error('Error during app initialization:', error);
                addToast('Ошибка при загрузке приложения', 'error');
            } finally {
                setLoading(false);
            }
        })();
    }, [addToast]);

    const loadMyDirectories = async () => {
        try {
            if (!user) return;
            const dirs = await DatabaseService.getDirectories(user.id);
            setMyDirectories(dirs);
        } catch (error) {
            console.error('Error loading directories:', error);
            addToast('Ошибка при загрузке директорий', 'error');
        }
    };

    const loadMyFiles = async () => {
        try {
            if (!user) return;
            setIsFilesLoading(true);
            const { data, error } = await supabase
                .from('files')
                .select('*')
                .eq('owner_id', user.id)
                .eq('status', 'uploaded')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMyFiles((data ?? []) as StoredFile[]);
        } catch (error) {
            console.error('Error loading files:', error);
            addToast('Ошибка при загрузке файлов', 'error');
        } finally {
            setIsFilesLoading(false);
        }
    };

    const formatBytes = (bytes?: number | null) => {
        if (bytes == null) return '';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unit = 0;
        while (size >= 1024 && unit < units.length - 1) {
            size /= 1024;
            unit++;
        }
        const precision = unit === 0 ? 0 : 1;
        return `${size.toFixed(precision)} ${units[unit]}`;
    };

    const uploadSelectedFile = async () => {
        if (!selectedUploadFile) {
            addToast('Выберите файл для загрузки', 'warning');
            return;
        }
        try {
            setIsUploadingFile(true);
            await FileUploadService.uploadFile(selectedUploadFile, 'file');
            setSelectedUploadFile(null);
            addToast('Файл загружен', 'success');
            await loadMyFiles();
        } catch (error) {
            console.error('Upload failed:', error);
            addToast('Ошибка при загрузке файла', 'error');
        } finally {
            setIsUploadingFile(false);
        }
    };

    const downloadFile = async (f: StoredFile) => {
        try {
            const url = await FileUploadService.getSignedDownloadUrl(f.object_path, 60);
            window.open(url, '_blank');
        } catch (error) {
            console.error('Download failed:', error);
            addToast('Ошибка при скачивании файла', 'error');
        }
    };

    const deleteFile = async (f: StoredFile) => {
        try {
            await FileUploadService.deleteFile(f.object_path);
            addToast('Файл удален', 'success');
            await loadMyFiles();
        } catch (error) {
            console.error('Delete failed:', error);
            addToast('Ошибка при удалении файла', 'error');
        }
    };

    const createDirectory = async () => {
        try {
            setValidationErrors([]);

            const validationErrs = DirectoryValidator.validateDirectory({
                name: dirName,
                type: dirType,
                storageType: storageType,
            });

            if (validationErrs.length > 0) {
                setValidationErrors(validationErrs);
                addToast('Пожалуйста, исправьте ошибки в форме', 'warning');
                return;
            }

            if (!user) {
                addToast('Ошибка: пользователь не найден', 'error');
                return;
            }

            setIsCreating(true);
            const slug = dirName.toLowerCase().replace(/\s+/g, '-');

            const newDir = await DatabaseService.createDirectory({
                owner_id: user.id,
                name: dirName,
                slug,
                type: dirType,
                storage_type: storageType,
                template_type: selectedTemplate?.category || 'custom',
                theme,
                is_published: dirType === 'public',
            });

            if (newDir) {
                addToast('Директория успешно создана!', 'success');
                setDirName('');
                setSelectedTemplate(null);
                setStep(1);
                setMode('template');
                setCurrentPage('menu');
                await loadMyDirectories();
            } else {
                addToast('Ошибка при создании директории', 'error');
            }
        } catch (error) {
            console.error('Error creating directory:', error);
            addToast('Ошибка при создании директории', 'error');
        } finally {
            setIsCreating(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-100 flex items-center justify-center relative overflow-hidden">
                <ConnectionStatus />
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(59, 130, 246, 0.1) 35px, rgba(59, 130, 246, 0.1) 70px)'}}></div>
                </div>
                <div className="relative z-10 text-center">
                    <svg width="100" height="100" viewBox="0 0 100 100" className="mx-auto mb-4 animate-float-waffle">
                        <rect x="15" y="15" width="25" height="25" rx="3" fill="#3b82f6" opacity="0.8"/>
                        <rect x="60" y="15" width="25" height="25" rx="3" fill="#3b82f6" opacity="0.8"/>
                        <rect x="15" y="60" width="25" height="25" rx="3" fill="#3b82f6" opacity="0.8"/>
                        <rect x="60" y="60" width="25" height="25" rx="3" fill="#3b82f6" opacity="0.8"/>
                    </svg>
                    <p className="text-blue-700 font-semibold text-lg">Загрузка Waffle Data...</p>
                </div>
                <ToastContainer />
            </div>
        );
    }

    if (currentPage === 'menu') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <ConnectionStatus />
                <div className="absolute inset-0 overflow-hidden">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="absolute animate-float-waffle" style={{left: `${Math.random()*100}%`, top: `${Math.random()*100}%`, animationDelay: `${i*0.7}s`}}>
                            <svg width="40" height="40" viewBox="0 0 100 100">
                                <rect x="10" y="10" width="35" height="35" rx="3" fill="#3b82f6" opacity="0.1"/>
                                <rect x="55" y="10" width="35" height="35" rx="3" fill="#3b82f6" opacity="0.1"/>
                                <rect x="10" y="55" width="35" height="35" rx="3" fill="#3b82f6" opacity="0.1"/>
                                <rect x="55" y="55" width="35" height="35" rx="3" fill="#3b82f6" opacity="0.1"/>
                            </svg>
                        </div>
                    ))}
                </div>

                <div className="relative z-10 w-full max-w-md">
                    <div className="text-center mb-12 animate-scale-in">
                        <div className="inline-block p-6 bg-white/50 backdrop-blur-xl rounded-3xl mb-4 shadow-2xl border border-white/30">
                            <svg width="100" height="100" viewBox="0 0 100 100">
                                <rect x="10" y="10" width="35" height="35" rx="4" fill="#3b82f6"/>
                                <rect x="55" y="10" width="35" height="35" rx="4" fill="#3b82f6"/>
                                <rect x="10" y="55" width="35" height="35" rx="4" fill="#3b82f6"/>
                                <rect x="55" y="55" width="35" height="35" rx="4" fill="#3b82f6"/>
                            </svg>
                        </div>
                        <h1 className="text-5xl font-black text-blue-900 mb-3 tracking-tight">Waffle Data</h1>
                        <p className="text-blue-600 text-base font-medium">Облачное хранилище нового поколения</p>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                        <button onClick={() => { TelegramService.hapticFeedback('medium'); setCurrentPage('create'); setStep(1); }} className="group bg-white/70 backdrop-blur-xl hover:backdrop-blur-2xl rounded-3xl p-7 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 border border-white/40 hover:border-blue-300/50">
                            <div className="relative h-20 mb-3 flex items-center justify-center">
                                <div className={`absolute w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg animate-fire-flicker`}>
                                    <span className="text-3xl">🔥</span>
                                </div>
                            </div>
                            <span className="text-sm font-bold text-blue-900 block">Создать</span>
                        </button>

                        <button onClick={() => { TelegramService.hapticFeedback('medium'); loadMyDirectories(); setCurrentPage('browse'); }} className="group bg-white/70 backdrop-blur-xl hover:backdrop-blur-2xl rounded-3xl p-7 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 border border-white/40 hover:border-green-300/50">
                            <div className="relative h-20 mb-3 flex items-center justify-center">
                                <div className={`absolute w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg animate-sparkle-green`}>
                                    <span className="text-3xl">💾</span>
                                </div>
                            </div>
                            <span className="text-sm font-bold text-blue-900 block">Войти</span>
                        </button>

                        <button onClick={() => { TelegramService.hapticFeedback('medium'); loadMyFiles(); setCurrentPage('files'); }} className="group bg-white/70 backdrop-blur-xl hover:backdrop-blur-2xl rounded-3xl p-7 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 border border-white/40 hover:border-purple-300/50">
                            <div className="relative h-20 mb-3 flex items-center justify-center">
                                <div className={`absolute w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-fuchsia-600 flex items-center justify-center shadow-lg animate-sparkle-yellow`}>
                                    <span className="text-3xl">📎</span>
                                </div>
                            </div>
                            <span className="text-sm font-bold text-blue-900 block">Файлы</span>
                        </button>

                        <button onClick={() => { TelegramService.hapticFeedback('medium'); setCurrentPage('status'); }} className="group bg-white/70 backdrop-blur-xl hover:backdrop-blur-2xl rounded-3xl p-7 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 border border-white/40 hover:border-yellow-300/50">
                            <div className="relative h-20 mb-3 flex items-center justify-center">
                                <div className={`absolute w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg animate-sparkle-yellow`}>
                                    <span className="text-3xl">📊</span>
                                </div>
                            </div>
                            <span className="text-sm font-bold text-blue-900 block">Статус</span>
                        </button>

                        <button
                            onClick={async () => {
                                TelegramService.hapticFeedback('heavy');
                                await supabase.auth.signOut();
                                setUser(null);
                                setMyDirectories([]);
                                setMyFiles([]);
                                setCurrentPage('menu');
                            }}
                            className="group bg-white/70 backdrop-blur-xl hover:backdrop-blur-2xl rounded-3xl p-7 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 border border-white/40 hover:border-red-300/50"
                        >
                            <div className="relative h-20 mb-3 flex items-center justify-center">
                                <div className={`absolute w-14 h-14 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg animate-fire-flicker-red`}>
                                    <span className="text-3xl">❌</span>
                                </div>
                            </div>
                            <span className="text-sm font-bold text-blue-900 block">Выйти</span>
                        </button>
                    </div>
                </div>
                <ToastContainer />
            </div>
        );
    }

    if (currentPage === 'create' && step === 1) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-100 p-6">
                <ConnectionStatus />
                <button onClick={() => setCurrentPage('menu')} className="mb-6 flex items-center gap-2 text-blue-700 hover:text-blue-900 font-semibold transition-colors">
                    <ChevronRight className="w-5 h-5 rotate-180" /> Назад
                </button>
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-4xl font-black text-blue-900 mb-2">Создание директории</h1>
                    <p className="text-blue-600 mb-8">Шаг 1 из 5: Выберите тип директории</p>

                    <div className="space-y-4">
                        <button onClick={() => { setDirType('private'); TelegramService.hapticFeedback('light'); }} className={`w-full p-6 rounded-2xl border-2 transition-all ${dirType === 'private' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-blue-300 bg-white/50'} backdrop-blur-sm`}>
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl">🔒</div>
                                <div className="text-left">
                                    <h3 className="font-bold text-gray-900 text-lg">Частная директория</h3>
                                    <p className="text-sm text-gray-600">Доступ только по приглашению</p>
                                </div>
                            </div>
                        </button>

                        <button onClick={() => { setDirType('public'); TelegramService.hapticFeedback('light'); }} className={`w-full p-6 rounded-2xl border-2 transition-all ${dirType === 'public' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-blue-300 bg-white/50'} backdrop-blur-sm`}>
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white text-2xl">🌐</div>
                                <div className="text-left">
                                    <h3 className="font-bold text-gray-900 text-lg">Публичная директория</h3>
                                    <p className="text-sm text-gray-600">Открыта для всех пользователей</p>
                                </div>
                            </div>
                        </button>

                        <button onClick={() => { setStep(2); TelegramService.hapticFeedback('light'); }} className="w-full mt-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl font-bold hover:shadow-lg transition-all active:scale-95">
                            Продолжить <ChevronRight className="w-5 h-5 inline ml-2"/>
                        </button>
                    </div>
                </div>
                <ToastContainer />
            </div>
        );
    }

    if (currentPage === 'create' && step === 2) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-100 p-6">
                <ConnectionStatus />
                <button onClick={() => setStep(1)} className="mb-6 flex items-center gap-2 text-blue-700 hover:text-blue-900 font-semibold transition-colors">
                    <ChevronRight className="w-5 h-5 rotate-180" /> Назад
                </button>
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-4xl font-black text-blue-900 mb-2">Создание директории</h1>
                    <p className="text-blue-600 mb-8">Шаг 2 из 5: Выберите режим</p>

                    <div className="space-y-4">
                        <button onClick={() => { setMode('template'); TelegramService.hapticFeedback('light'); }} className={`w-full p-6 rounded-2xl border-2 transition-all ${mode === 'template' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-blue-300 bg-white/50'} backdrop-blur-sm`}>
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl">📋</div>
                                <div className="text-left">
                                    <h3 className="font-bold text-gray-900 text-lg">Использовать шаблон</h3>
                                    <p className="text-sm text-gray-600">Быстрый старт с готовым решением</p>
                                </div>
                            </div>
                        </button>

                        <button onClick={() => { setMode('manual'); TelegramService.hapticFeedback('light'); }} className={`w-full p-6 rounded-2xl border-2 transition-all ${mode === 'manual' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-blue-300 bg-white/50'} backdrop-blur-sm`}>
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-2xl">⚙️</div>
                                <div className="text-left">
                                    <h3 className="font-bold text-gray-900 text-lg">Ручной режим</h3>
                                    <p className="text-sm text-gray-600">Полная кастомизация под ваши нужды</p>
                                </div>
                            </div>
                        </button>

                        <button onClick={() => { setStep(mode === 'template' ? 3 : 4); TelegramService.hapticFeedback('light'); }} className="w-full mt-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl font-bold hover:shadow-lg transition-all active:scale-95">
                            Продолжить <ChevronRight className="w-5 h-5 inline ml-2"/>
                        </button>
                    </div>
                </div>
                <ToastContainer />
            </div>
        );
    }

    if (currentPage === 'create' && step === 3 && mode === 'template') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-100 p-6">
                <ConnectionStatus />
                <button onClick={() => setStep(2)} className="mb-6 flex items-center gap-2 text-blue-700 hover:text-blue-900 font-semibold transition-colors">
                    <ChevronRight className="w-5 h-5 rotate-180" /> Назад
                </button>
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-4xl font-black text-blue-900 mb-2">Создание директории</h1>
                    <p className="text-blue-600 mb-8">Шаг 3 из 5: Выберите шаблон</p>

                    <div className="space-y-3 mb-6">
                        {templates.length === 0 ? (
                            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 text-center">
                                <Loader className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
                                <p className="text-gray-600">Загрузка шаблонов...</p>
                            </div>
                        ) : (
                            templates.map(t => (
                                <button key={t.id} onClick={() => { setSelectedTemplate(t); TelegramService.hapticFeedback('light'); }} className={`w-full p-5 rounded-2xl border-2 transition-all ${selectedTemplate?.id === t.id ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-blue-300 bg-white/50'} backdrop-blur-sm text-left`}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-900">{t.name}</h3>
                                            <p className="text-sm text-gray-600">{t.description}</p>
                                        </div>
                                        {t.is_premium && <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-lg">Premium</span>}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-4 mb-6">
                        <label className="block text-sm font-bold text-gray-900 mb-3">Тема оформления</label>
                        <div className="flex gap-3">
                            {['light', 'dark'].map(t => (
                                <button key={t} onClick={() => setTheme(t as 'light' | 'dark')} className={`flex-1 py-2 rounded-lg font-semibold transition-all ${theme === t ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900'}`}>
                                    {t === 'light' ? '☀️ Светлая' : '🌙 Темная'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button onClick={() => { setStep(5); TelegramService.hapticFeedback('light'); }} disabled={!selectedTemplate} className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl font-bold hover:shadow-lg transition-all active:scale-95 disabled:opacity-50">
                        Продолжить <ChevronRight className="w-5 h-5 inline ml-2"/>
                    </button>
                </div>
                <ToastContainer />
            </div>
        );
    }

    if (currentPage === 'create' && step === 4 && mode === 'manual') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-100 p-6">
                <ConnectionStatus />
                <button onClick={() => setStep(2)} className="mb-6 flex items-center gap-2 text-blue-700 hover:text-blue-900 font-semibold transition-colors">
                    <ChevronRight className="w-5 h-5 rotate-180" /> Назад
                </button>
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-4xl font-black text-blue-900 mb-2">Конструктор директории</h1>
                    <p className="text-blue-600 mb-8">Шаг 4 из 5: Настройте параметры</p>

                    <ValidationErrorDisplay errors={validationErrors} />

                    <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Название директории</label>
                            <input type="text" value={dirName} onChange={(e) => setDirName(e.target.value)} placeholder="Мое хранилище" className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"/>
                            <p className="text-xs text-gray-500 mt-1">{dirName.length} / 50 символов</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Тип хранилища</label>
                            <select value={storageType} onChange={(e) => setStorageType(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none">
                                <option value="document">Документно-ориентированное</option>
                                <option value="hierarchical">Иерархическое</option>
                                <option value="columnar">Колоночное</option>
                                <option value="relational">Реляционное</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">Тема оформления</label>
                            <div className="flex gap-3">
                                {['light', 'dark'].map(t => (
                                    <button key={t} onClick={() => setTheme(t as 'light' | 'dark')} className={`flex-1 py-2 rounded-lg font-semibold transition-all ${theme === t ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900'}`}>
                                        {t === 'light' ? '☀️' : '🌙'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button onClick={() => { setStep(5); TelegramService.hapticFeedback('light'); }} disabled={!dirName} className="w-full mt-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl font-bold hover:shadow-lg transition-all active:scale-95 disabled:opacity-50">
                        Продолжить <ChevronRight className="w-5 h-5 inline ml-2"/>
                    </button>
                </div>
                <ToastContainer />
            </div>
        );
    }

    if (currentPage === 'create' && step === 5) {
        if (!dirName && mode === 'template') setDirName(selectedTemplate?.name || 'Новая директория');

        return (
            <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-100 p-6">
                <ConnectionStatus />
                <button onClick={() => setStep(mode === 'template' ? 3 : 4)} className="mb-6 flex items-center gap-2 text-blue-700 hover:text-blue-900 font-semibold transition-colors">
                    <ChevronRight className="w-5 h-5 rotate-180" /> Назад
                </button>
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-4xl font-black text-blue-900 mb-2">Завершение</h1>
                    <p className="text-blue-600 mb-8">Шаг 5 из 5: Подтвердите создание</p>

                    <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 mb-6 space-y-3">
                        <div className="flex justify-between items-center pb-3 border-b border-gray-300">
                            <span className="text-gray-700 font-semibold">Название:</span>
                            <span className="text-gray-900 font-bold">{dirName}</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b border-gray-300">
                            <span className="text-gray-700 font-semibold">Тип:</span>
                            <span className="text-gray-900 font-bold">{dirType === 'private' ? '🔒 Частная' : '🌐 Публичная'}</span>
                        </div>
                        <div className="flex justify-between items-center pb-3 border-b border-gray-300">
                            <span className="text-gray-700 font-semibold">Режим:</span>
                            <span className="text-gray-900 font-bold">{mode === 'template' ? '📋 Шаблон' : '⚙️ Ручной'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-700 font-semibold">Тема:</span>
                            <span className="text-gray-900 font-bold">{theme === 'light' ? '☀️ Светлая' : '🌙 Темная'}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button onClick={createDirectory} disabled={isCreating} className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl font-bold hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                            {isCreating ? (
                                <>
                                    <Loader className="w-5 h-5 animate-spin" />
                                    Создание...
                                </>
                            ) : (
                                <>
                                    ✓ Создать директорию
                                </>
                            )}
                        </button>
                        <button onClick={() => setStep(mode === 'template' ? 3 : 4)} disabled={isCreating} className="w-full py-3 bg-gray-200 text-gray-900 rounded-2xl font-bold hover:bg-gray-300 transition-all disabled:opacity-50">
                            Вернуться к редактированию
                        </button>
                    </div>
                </div>
                <ToastContainer />
            </div>
        );
    }

    if (currentPage === 'browse') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-100 p-6">
                <ConnectionStatus />
                <button onClick={() => setCurrentPage('menu')} className="mb-6 flex items-center gap-2 text-blue-700 hover:text-blue-900 font-semibold transition-colors">
                    <ChevronRight className="w-5 h-5 rotate-180" /> Главное меню
                </button>
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-4xl font-black text-blue-900 mb-8">Мои директории</h1>

                    <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-4 mb-6 flex items-center gap-3">
                        <Search className="w-5 h-5 text-gray-600"/>
                        <input type="text" placeholder="Поиск по названию..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-500"/>
                    </div>

                    <div className="space-y-4">
                        {myDirectories.length === 0 ? (
                            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-12 text-center">
                                <div className="text-4xl mb-3">📁</div>
                                <p className="text-gray-700 font-semibold">У вас еще нет директорий</p>
                                <p className="text-gray-600 text-sm mt-1">Создайте свою первую директорию, чтобы начать</p>
                            </div>
                        ) : (
                            myDirectories
                                .filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                .map(dir => (
                                    <div key={dir.id} className="bg-white/50 backdrop-blur-sm rounded-2xl p-5 hover:bg-white/70 transition-all cursor-pointer group">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="font-bold text-gray-900 text-lg">{dir.name}</h3>
                                                    {dir.type === 'private' ? <Lock className="w-4 h-4 text-gray-500"/> : <Globe className="w-4 h-4 text-green-500"/>}
                                                </div>
                                                <div className="flex gap-3 text-xs text-gray-600">
                                                    <span>{dir.template_type}</span>
                                                    <span>•</span>
                                                    <span>👁️ {dir.view_count}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-2 hover:bg-blue-100 rounded-lg"><Eye className="w-4 h-4 text-blue-600"/></button>
                                                <button className="p-2 hover:bg-red-100 rounded-lg"><Trash2 className="w-4 h-4 text-red-600"/></button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>
                </div>
                <ToastContainer />
            </div>
        );
    }

    if (currentPage === 'files') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-100 p-6">
                <ConnectionStatus />
                <button onClick={() => setCurrentPage('menu')} className="mb-6 flex items-center gap-2 text-blue-700 hover:text-blue-900 font-semibold transition-colors">
                    <ChevronRight className="w-5 h-5 rotate-180" /> Главное меню
                </button>

                <div className="max-w-4xl mx-auto">
                    <h1 className="text-4xl font-black text-blue-900 mb-8">Мои файлы</h1>

                    <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-5 mb-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex-1">
                                <label className="block text-sm font-bold text-gray-900 mb-2">Загрузить файл</label>
                                <input
                                    type="file"
                                    onChange={(e) => setSelectedUploadFile(e.target.files?.[0] ?? null)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white/70"
                                />
                                {selectedUploadFile && (
                                    <p className="text-xs text-gray-600 mt-2">
                                        Выбран: <span className="font-semibold">{selectedUploadFile.name}</span> ({formatBytes(selectedUploadFile.size)})
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={uploadSelectedFile}
                                    disabled={!selectedUploadFile || isUploadingFile}
                                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
                                >
                                    {isUploadingFile ? 'Загрузка...' : 'Загрузить'}
                                </button>
                                <button
                                    onClick={loadMyFiles}
                                    disabled={isFilesLoading}
                                    className="px-6 py-3 bg-white/70 text-gray-900 rounded-xl font-bold hover:bg-white transition-all border border-white/40 disabled:opacity-50"
                                >
                                    Обновить
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {isFilesLoading ? (
                            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-12 text-center">
                                <Loader className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
                                <p className="text-gray-600">Загрузка файлов...</p>
                            </div>
                        ) : myFiles.length === 0 ? (
                            <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-12 text-center">
                                <div className="text-4xl mb-3">📎</div>
                                <p className="text-gray-700 font-semibold">Файлов пока нет</p>
                                <p className="text-gray-600 text-sm mt-1">Загрузите первый файл, чтобы он появился в списке</p>
                            </div>
                        ) : (
                            myFiles.map((f) => (
                                <div key={f.id} className="bg-white/50 backdrop-blur-sm rounded-2xl p-5 hover:bg-white/70 transition-all">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-900 truncate">{f.original_name}</p>
                                            <div className="flex flex-wrap gap-2 text-xs text-gray-600 mt-2">
                                                <span className="px-2 py-1 bg-gray-100 rounded-lg">{formatBytes(f.size_bytes)}</span>
                                                {f.mime_type && <span className="px-2 py-1 bg-gray-100 rounded-lg">{f.mime_type}</span>}
                                                <span className="px-2 py-1 bg-gray-100 rounded-lg">{new Date(f.created_at).toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => downloadFile(f)}
                                                className="p-3 hover:bg-blue-100 rounded-xl transition-all"
                                                title="Скачать"
                                            >
                                                <Eye className="w-5 h-5 text-blue-600" />
                                            </button>
                                            <button
                                                onClick={() => deleteFile(f)}
                                                className="p-3 hover:bg-red-100 rounded-xl transition-all"
                                                title="Удалить"
                                            >
                                                <Trash2 className="w-5 h-5 text-red-600" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <ToastContainer />
            </div>
        );
    }

    if (currentPage === 'status') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-100 p-6">
                <ConnectionStatus />
                <button onClick={() => setCurrentPage('menu')} className="mb-6 flex items-center gap-2 text-blue-700 hover:text-blue-900 font-semibold transition-colors">
                    <ChevronRight className="w-5 h-5 rotate-180" /> Главное меню
                </button>
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-4xl font-black text-blue-900 mb-8">Статистика и аналитика</h1>

                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 text-center">
                            <div className="text-4xl mb-2">📊</div>
                            <div className="text-3xl font-black text-blue-900">{myDirectories.length}</div>
                            <p className="text-gray-600 text-sm mt-2">Всего директорий</p>
                        </div>
                        <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 text-center">
                            <div className="text-4xl mb-2">👁️</div>
                            <div className="text-3xl font-black text-blue-900">{myDirectories.reduce((sum, d) => sum + d.view_count, 0)}</div>
                            <p className="text-gray-600 text-sm mt-2">Общее количество просмотров</p>
                        </div>
                        <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 text-center">
                            <div className="text-4xl mb-2">🔒</div>
                            <div className="text-3xl font-black text-blue-900">{myDirectories.filter(d => d.type === 'private').length}</div>
                            <p className="text-gray-600 text-sm mt-2">Приватных директорий</p>
                        </div>
                    </div>

                    <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Инструменты анализа</h2>
                        <div className="space-y-3">
                            {[
                                { icon: '📜', title: 'История изменений', desc: 'Просмотр всех изменений' },
                                { icon: '👥', title: 'Управление доступом', desc: 'Делегация полномочий' },
                                { icon: '📈', title: 'Расширенная аналитика', desc: 'CTR, CPA, churn rate' }
                            ].map((tool, i) => (
                                <button key={i} className="w-full p-4 bg-blue-50/50 hover:bg-blue-100/50 rounded-xl transition-all text-left">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{tool.icon}</span>
                                        <div>
                                            <p className="font-bold text-gray-900">{tool.title}</p>
                                            <p className="text-sm text-gray-600">{tool.desc}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-amber-100 to-yellow-100 rounded-2xl p-6 border-2 border-amber-200">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-3xl">⭐</span>
                            <h3 className="text-xl font-bold text-gray-900">Расширенная аналитика</h3>
                        </div>
                        <p className="text-gray-700 mb-4">Получите доступ к полной статистике и всем инструментам анализа с подпиской Data+</p>
                        <button className="px-6 py-2 bg-gradient-to-r from-amber-400 to-yellow-500 text-white rounded-xl font-bold hover:shadow-lg transition-all">
                            Оформить подписку
                        </button>
                    </div>
                </div>
                <ToastContainer />
            </div>
        );
    }

    return null;
}

export default App;