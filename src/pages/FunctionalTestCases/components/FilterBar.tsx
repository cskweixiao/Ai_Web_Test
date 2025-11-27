import React, { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { FilterState } from '../types';
import { SystemOption } from '../../../types/test';

interface FilterBarProps {
    filters: FilterState;
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
    onSearch: () => void;
    onReset: () => void;
    systemOptions: SystemOption[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
    filters,
    setFilters,
    onSearch,
    onReset,
    systemOptions
}) => {
    const [showAdvanced, setShowAdvanced] = useState(false);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            onSearch();
        }
    };

    const handleChange = (key: keyof FilterState, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
            <div className="flex items-center gap-3">
                {/* Main Search */}
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search cases, descriptions, purposes..."
                        value={filters.search}
                        onChange={e => handleChange('search', e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg 
                     focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 
                     transition-all duration-200"
                    />
                </div>

                {/* Quick Filters */}
                <select
                    value={filters.system}
                    onChange={e => handleChange('system', e.target.value)}
                    className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
                   focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                    <option value="">All Systems</option>
                    {systemOptions.map(sys => (
                        <option key={sys.id} value={sys.name}>{sys.name}</option>
                    ))}
                </select>

                <select
                    value={filters.status}
                    onChange={e => handleChange('status', e.target.value)}
                    className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm
                   focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                    <option value="">All Status</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ARCHIVED">Archived</option>
                </select>

                {/* Actions */}
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className={clsx(
                        'inline-flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                        showAdvanced
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    )}
                >
                    <Filter className="w-4 h-4 mr-2" />
                    Filters
                </button>

                <button
                    onClick={onReset}
                    className="inline-flex items-center px-4 py-2.5 text-gray-600 hover:text-gray-900
                   border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                    <X className="w-4 h-4 mr-2" />
                    Reset
                </button>
            </div>

            {/* Advanced Filters */}
            <AnimatePresence>
                {showAdvanced && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="pt-4 mt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500">Module</label>
                                <input
                                    type="text"
                                    placeholder="Module name..."
                                    value={filters.module}
                                    onChange={e => handleChange('module', e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm
                           focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500">Priority</label>
                                <select
                                    value={filters.priority}
                                    onChange={e => handleChange('priority', e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm
                           focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                >
                                    <option value="">All Priorities</option>
                                    <option value="critical">Critical</option>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500">Risk Level</label>
                                <select
                                    value={filters.riskLevel}
                                    onChange={e => handleChange('riskLevel', e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm
                           focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                >
                                    <option value="">All Risks</option>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500">Created By</label>
                                <input
                                    type="text"
                                    placeholder="Username..."
                                    value={filters.createdBy}
                                    onChange={e => handleChange('createdBy', e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm
                           focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500">Source</label>
                                <select
                                    value={filters.source}
                                    onChange={e => handleChange('source', e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm
                           focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                >
                                    <option value="">All Sources</option>
                                    <option value="AI_GENERATED">AI Generated</option>
                                    <option value="MANUAL">Manual</option>
                                </select>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
